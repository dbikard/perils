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
    _lastScheduled: -1
  };

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

  /* ---------------- connection ---------------- */
  function makePC() {
    // STUN is optional for same-LAN play (host candidates suffice) but lets
    // the same flow work across networks for free
    return new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
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
    dc.onopen = () => { Net.active = true; Net.peerGone = false; if (Net.onOpen) Net.onOpen(); };
    dc.onclose = () => { Net.peerGone = true; if (Net.onClose) Net.onClose(); };
    dc.onerror = () => { Net.peerGone = true; };
    dc.onmessage = (e) => handle(JSON.parse(e.data));
  }

  // host: returns the offer code to give to the guest
  Net.host = async function () {
    Net.isHost = true; Net.localIdx = 0;
    const pc = Net.pc = makePC();
    wireChannel(pc.createDataChannel('perils', { ordered: true }));
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return compress(JSON.stringify(pc.localDescription));
  };
  // guest: takes the host's offer code, returns the answer code to send back
  Net.join = async function (offerCode) {
    Net.isHost = false; Net.localIdx = 1;
    const pc = Net.pc = makePC();
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
