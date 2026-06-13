/* net.js — LAN co-op (experimental): WebRTC DataChannel + deterministic lockstep.
 *
 * Serverless by design so the game stays deployable on GitHub Pages: the two
 * browsers exchange a pair of compressed "link codes" (SDP offer/answer) by
 * copy-paste / any messenger, then talk directly over the LAN. No backend.
 *
 * Netcode is delay-based lockstep: both sims are identical (fixed timestep +
 * seeded RNG); only quantized inputs cross the wire. Each tick simulates only
 * once inputs from BOTH players are buffered for it. Periodic state hashes
 * detect desync (e.g. differing Math.sin implementations across browsers).
 */
(function (global) {
  'use strict';

  const NEUTRAL = { mx: 0, my: 0, b: 0, pk: -1 };

  const Net = {
    active: false,      // channel open, co-op session live
    isHost: false,
    localIdx: 0,        // player slot: host=0, guest=1
    peerGone: false,    // peer disconnected mid-run: their pawn idles
    desync: false,
    DELAY: 5,           // input delay in ticks (~83ms @60Hz; LAN-friendly)
    pc: null, dc: null,
    onOpen: null, onStart: null, onClose: null,
    inputs: [new Map(), new Map()],   // tick -> input record, per player
    hashes: new Map(),                // tick -> our hash (for cross-check)
    _lastScheduled: -1,
    diag: [],                         // rolling handshake log (surfaced in the lobby)
    onDiag: null
  };

  /* ---------------- handshake diagnostics ---------------- */
  // The LAN handshake has several failure points (signaling socket, ICE
  // gathering, ICE connectivity, datachannel). Log each transition so a stuck
  // pairing can be diagnosed from the screen instead of a hidden console.
  function diag(msg) {
    const t = (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000).toFixed(1);
    Net.diag.push(t + 's  ' + msg);
    if (Net.diag.length > 50) Net.diag.shift();
    if (Net.onDiag) Net.onDiag(Net.diag);
  }
  Net.diag = []; // ensure array even if frozen elsewhere
  Net.diagReset = function () {
    Net.diag = [];
    if (typeof navigator !== 'undefined') {
      diag('secureContext=' + (typeof isSecureContext !== 'undefined' ? isSecureContext : '?') +
           '  RTC=' + (typeof RTCPeerConnection !== 'undefined') +
           '  compress=' + (typeof CompressionStream !== 'undefined'));
    }
  };
  Net.diagText = function () { return Net.diag.join('\n'); };

  /* ---------------- link codes (compressed base64url SDP) ---------------- */
  function b64encode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decode(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function compress(str) {
    const data = new TextEncoder().encode(str);
    if (typeof CompressionStream === 'undefined') return 'P0' + b64encode(data);
    const cs = new CompressionStream('deflate-raw');
    const buf = await new Response(new Blob([data]).stream().pipeThrough(cs)).arrayBuffer();
    return 'P1' + b64encode(new Uint8Array(buf));
  }
  async function decompress(code) {
    code = code.trim();
    const tag = code.slice(0, 2), body = b64decode(code.slice(2));
    if (tag === 'P0') return new TextDecoder().decode(body);
    const ds = new DecompressionStream('deflate-raw');
    const buf = await new Response(new Blob([body]).stream().pipeThrough(ds)).arrayBuffer();
    return new TextDecoder().decode(buf);
  }

  /* ---------------- room codes (free public signaling relay) ----------------
   * Speaks the PeerJS cloud server's WebSocket protocol directly (no library):
   * the relay only ferries the ~1KB SDP handshake, then gameplay traffic runs
   * peer-to-peer over the LAN. Net.host/join (manual link codes) remain as the
   * no-internet fallback. */
  const SIGNAL_URL = 'wss://0.peerjs.com/peerjs';
  const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

  function makeCode(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    return s;
  }

  function signalOpen(id) {
    return new Promise((resolve, reject) => {
      const token = Math.random().toString(36).slice(2, 10);
      diag('signaling: connecting as ' + id);
      const ws = new WebSocket(`${SIGNAL_URL}?key=peerjs&id=${id}&token=${token}`);
      const timer = setTimeout(() => { diag('signaling: TIMEOUT (no OPEN in 8s)'); try { ws.close(); } catch (e) {} reject(new Error('signaling timeout')); }, 8000);
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.type === 'OPEN') { diag('signaling: OPEN'); clearTimeout(timer); resolve(ws); }
        else if (m.type === 'ID-TAKEN' || m.type === 'ERROR') { diag('signaling: ' + m.type); clearTimeout(timer); ws.close(); reject(new Error(m.type)); }
      };
      ws.onerror = () => { diag('signaling: socket ERROR (unreachable/blocked)'); clearTimeout(timer); reject(new Error('signaling unreachable')); };
    });
  }
  function startHeartbeat(ws) {
    const hb = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
      else clearInterval(hb);
    }, 5000);
    ws.addEventListener('close', () => clearInterval(hb));
  }
  function closeSignaling() {
    if (Net._ws) { try { Net._ws.close(); } catch (e) {} Net._ws = null; }
  }

  /* Keep the screen awake while pairing. On mobile, if the host's screen
   * sleeps (or Chrome backgrounds) while the guest is scanning, the host's JS
   * suspends and never answers the offer — the #1 cause of "no reply". */
  let wakeLock = null;
  async function acquireWake() {
    try {
      if (typeof navigator !== 'undefined' && navigator.wakeLock && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { /* unsupported or blocked — best effort */ }
  }
  function releaseWake() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
  if (typeof document !== 'undefined') {
    // wake locks drop when the tab is hidden; re-acquire when it returns while pairing
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && Net._pairing) acquireWake();
    });
  }

  // host: opens a room and returns its 4-letter code; resolves the moment the
  // room exists (the guest connects later, whenever they enter the code)
  Net.hostRoom = async function (onStatus) {
    Net.isHost = true; Net.localIdx = 0;
    let code = null, ws = null;
    for (let attempt = 0; attempt < 3 && !ws; attempt++) {
      code = makeCode(4);
      try { ws = await signalOpen('perils-' + code + '-h'); }
      catch (e) { if (e.message !== 'ID-TAKEN' || attempt === 2) throw e; }
    }
    startHeartbeat(ws);
    Net._ws = ws;
    Net._pairing = true; acquireWake();
    const pc = Net.pc = makePC();
    pc.ondatachannel = (e) => wireChannel(e.channel); // the guest offers + owns the channel
    let answering = false;
    ws.onmessage = async (m0) => {
      let m; try { m = JSON.parse(m0.data); } catch (e) { return; }
      if (m.type !== 'OFFER' || !m.payload || !m.payload.sdp) return;
      // the guest re-sends its offer until it hears back; once we've answered,
      // just re-send the cached answer rather than redo the handshake
      if (answering) {
        if (pc.localDescription) { diag('host: re-sending ANSWER'); ws.send(JSON.stringify({ type: 'ANSWER', dst: m.src, payload: { sdp: pc.localDescription } })); }
        return;
      }
      answering = true;
      try {
        diag('host: received guest OFFER');
        if (onStatus) onStatus('partner found — linking…');
        await pc.setRemoteDescription(m.payload.sdp);
        await pc.setLocalDescription(await pc.createAnswer());
        await gathered(pc);
        ws.send(JSON.stringify({ type: 'ANSWER', dst: m.src, payload: { sdp: pc.localDescription } }));
        diag('host: sent ANSWER');
      } catch (err) {
        answering = false;
        diag('host: ANSWER failed — ' + ((err && err.message) || err));
      }
    };
    return code;
  };

  // guest: joins a host's room by code; resolves when the handshake completes
  Net.joinRoom = async function (code) {
    Net.isHost = false; Net.localIdx = 1;
    code = (code || '').trim().toUpperCase();
    if (code.length < 4) throw new Error('enter the 4-letter room code');
    const ws = await signalOpen('perils-' + code + '-g' + Math.random().toString(36).slice(2, 6));
    startHeartbeat(ws);
    Net._ws = ws;
    Net._pairing = true; acquireWake();
    const pc = Net.pc = makePC();
    wireChannel(pc.createDataChannel('perils', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const offerMsg = JSON.stringify({ type: 'OFFER', dst: 'perils-' + code + '-h', payload: { sdp: pc.localDescription } });
    // re-send the offer on an interval: if the host phone was briefly asleep or
    // backgrounded, it can still pick up a later offer once it wakes
    await new Promise((resolve, reject) => {
      let tries = 0;
      const sendOffer = () => {
        try { ws.send(offerMsg); } catch (e) {}
        diag(tries === 0 ? 'guest: sent OFFER to ' + code + ', waiting for ANSWER…'
                         : 'guest: resending OFFER (' + tries + ') — host not answering yet');
      };
      sendOffer();
      const retry = setInterval(() => {
        if (++tries > 9) { // ~30s total
          clearInterval(retry);
          reject(new Error('no reply — make sure the host is on the HOST ROOM screen with the phone awake'));
          return;
        }
        sendOffer();
      }, 3000);
      ws.onmessage = async (m0) => {
        let m; try { m = JSON.parse(m0.data); } catch (e) { return; }
        if (m.type === 'ANSWER' && m.payload && m.payload.sdp) {
          clearInterval(retry);
          diag('guest: received host ANSWER');
          await pc.setRemoteDescription(m.payload.sdp);
          resolve();
        } else if (m.type === 'EXPIRE' || m.type === 'LEAVE') {
          clearInterval(retry);
          diag('guest: room ' + m.type + ' — host is not in that room');
          reject(new Error('room not found — check the code, and that the host tapped HOST ROOM'));
        }
      };
    }).catch((err) => { Net._pairing = false; releaseWake(); throw err; });
  };

  /* ---------------- connection ---------------- */
  function makePC(noStun) {
    // STUN lets the relay flow work across networks; for same-LAN QR pairing we
    // skip it so only host/mDNS candidates are gathered — a smaller SDP (smaller
    // QR, easier to scan) and faster gathering.
    const pc = new RTCPeerConnection(noStun ? {} : { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    // tally candidate types: host=LAN, srflx=STUN-reflexive, relay=TURN.
    // No srflx => STUN blocked; no host => something is hiding the LAN address.
    const cand = {};
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const ty = e.candidate.type || (/ typ (\w+)/.exec(e.candidate.candidate) || [])[1] || '?';
        cand[ty] = (cand[ty] || 0) + 1;
      } else {
        const sum = Object.keys(cand).map(k => k + ':' + cand[k]).join(' ') || '(none!)';
        diag('ICE candidates gathered → ' + sum);
      }
    };
    pc.onicecandidateerror = (e) => diag('ICE candidate error ' + (e.errorCode || '') + ' ' + (e.url || ''));
    pc.oniceconnectionstatechange = () => diag('ICE state: ' + pc.iceConnectionState);
    pc.onconnectionstatechange = () => diag('peer connection: ' + pc.connectionState);
    return pc;
  }
  function gathered(pc) {
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const done = () => { if (pc.iceGatheringState === 'complete') res(); };
      pc.addEventListener('icegatheringstatechange', done);
      setTimeout(res, 2500); // LAN candidates arrive fast; don't wait forever
    });
  }
  function wireChannel(dc) {
    Net.dc = dc;
    dc.onopen = () => { diag('datachannel OPEN — connected ✔'); Net.active = true; Net.peerGone = false; Net._pairing = false; releaseWake(); closeSignaling(); if (Net.onOpen) Net.onOpen(); };
    dc.onclose = () => { diag('datachannel closed'); Net.peerGone = true; if (Net.onClose) Net.onClose(); };
    dc.onerror = () => { diag('datachannel error'); Net.peerGone = true; };
    dc.onmessage = (e) => handle(JSON.parse(e.data));
  }

  // host: returns the offer code to give to the guest. `local` skips STUN for
  // LAN-only pairing (used by the QR flow to keep the code/QR small).
  Net.host = async function (local) {
    Net.isHost = true; Net.localIdx = 0;
    Net._pairing = true; acquireWake();
    const pc = Net.pc = makePC(local);
    wireChannel(pc.createDataChannel('perils', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return compress(JSON.stringify(pc.localDescription));
  };
  // guest: takes the host's offer code, returns the answer code to send back
  Net.join = async function (offerCode, local) {
    Net.isHost = false; Net.localIdx = 1;
    Net._pairing = true; acquireWake();
    const pc = Net.pc = makePC(local);
    pc.ondatachannel = (e) => wireChannel(e.channel);
    await pc.setRemoteDescription(JSON.parse(await decompress(offerCode)));
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return compress(JSON.stringify(pc.localDescription));
  };
  // host: completes the handshake with the guest's answer code
  Net.acceptAnswer = async function (answerCode) {
    await Net.pc.setRemoteDescription(JSON.parse(await decompress(answerCode)));
  };

  Net.send = function (o) {
    if (Net.dc && Net.dc.readyState === 'open') Net.dc.send(JSON.stringify(o));
  };
  Net.close = function () {
    try { if (Net.dc) Net.dc.close(); if (Net.pc) Net.pc.close(); } catch (e) { /* already gone */ }
    Net.active = false; Net.dc = null; Net.pc = null;
    Net._pairing = false; releaseWake();
  };

  function handle(m) {
    if (m.t === 'in') {
      Net.inputs[m.p].set(m.k, m);
    } else if (m.t === 'start') {
      if (Net.onStart) Net.onStart(m);
    } else if (m.t === 'hash') {
      const mine = Net.hashes.get(m.k);
      if (mine !== undefined && mine !== m.h) Net.desync = true;
    }
  }

  /* ---------------- lockstep ---------------- */
  Net.resetRun = function () {
    Net.inputs = [new Map(), new Map()];
    Net.hashes = new Map();
    Net.desync = false;
    Net._lastScheduled = -1;
    // pre-fill the first DELAY ticks so both sims can start immediately
    for (let k = 0; k < Net.DELAY; k++) {
      Net.inputs[0].set(k, Object.assign({ k }, NEUTRAL));
      Net.inputs[1].set(k, Object.assign({ k }, NEUTRAL));
    }
  };

  // capture the local input once per tick number; echoes to the peer
  Net.scheduleLocal = function (tick, sample) {
    const k = tick + Net.DELAY;
    if (k <= Net._lastScheduled) return;
    Net._lastScheduled = k;
    const rec = { t: 'in', p: Net.localIdx, k,
      mx: Math.max(-100, Math.min(100, Math.round(sample.mx * 100))),
      my: Math.max(-100, Math.min(100, Math.round(sample.my * 100))),
      b: sample.b | 0, pk: sample.pk == null ? -1 : sample.pk };
    Net.inputs[Net.localIdx].set(k, rec);
    Net.send(rec);
  };

  Net.ready = function (tick) {
    if (!Net.inputs[Net.localIdx].has(tick)) return false;
    return Net.peerGone || Net.inputs[1 - Net.localIdx].has(tick);
  };
  Net.get = function (tick, p) {
    return Net.inputs[p].get(tick) || NEUTRAL;
  };
  Net.gc = function (tick) {
    if (tick % 300 !== 0) return;
    for (const map of Net.inputs) for (const k of map.keys()) if (k < tick - 60) map.delete(k);
    for (const k of Net.hashes.keys()) if (k < tick - 1200) Net.hashes.delete(k);
  };

  // periodic state hash exchange (both directions) to catch desync
  Net.checkSync = function (tick, hash) {
    Net.hashes.set(tick, hash);
    Net.send({ t: 'hash', k: tick, h: hash });
  };

  global.Net = Net;
  if (typeof module !== 'undefined' && module.exports) module.exports = Net;
})(typeof window !== 'undefined' ? window : globalThis);
