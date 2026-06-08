/* sfx.js — procedural sound effects synthesized with the Web Audio API (no asset files).
 * Defensive: no-ops if audio is unavailable. Throttled so the bullet-heaven doesn't roar.
 * Must init on a user gesture (called from the LAUNCH button). */
(function (global) {
  'use strict';
  const SFX = { muted: false };
  let ctx = null, master = null;
  const last = {};

  SFX.init = function () {
    if (ctx) return;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
  };
  SFX.resume = function () { try { if (ctx && ctx.state === 'suspended') ctx.resume(); } catch (e) {} };
  SFX.toggle = function () { SFX.muted = !SFX.muted; if (!SFX.muted) SFX.resume(); return SFX.muted; };

  function ok(name, gap) {
    if (!ctx || SFX.muted) return false;
    const t = ctx.currentTime;
    if (gap) { if (last[name] && t - last[name] < gap) return false; last[name] = t; }
    return true;
  }
  function tone(f, dur, type, vol, slideTo, when) {
    const t = (when || ctx.currentTime);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise(dur, vol, type, freq) {
    const t = ctx.currentTime;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq || 800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + dur);
  }

  SFX.shoot = function () { if (!ok('shoot', 0.07)) return; tone(680, 0.06, 'square', 0.09, 320); };
  SFX.kill = function () { if (!ok('kill', 0.045)) return; tone(220, 0.11, 'square', 0.13, 80); };
  SFX.hit = function () { if (!ok('hit', 0.03)) return; tone(440, 0.04, 'square', 0.06, 300); };
  SFX.hurt = function () { if (!ok('hurt', 0.3)) return; tone(150, 0.18, 'sawtooth', 0.16, 70); };
  SFX.level = function () { if (!ok('level', 0.1)) return; tone(523, 0.12, 'square', 0.16); tone(784, 0.16, 'square', 0.14, null, ctx.currentTime + 0.09); };
  SFX.pickup = function () { if (!ok('pickup', 0.08)) return; tone(660, 0.09, 'sine', 0.14, 990); tone(990, 0.12, 'sine', 0.1, null, ctx.currentTime + 0.07); };
  SFX.blink = function () { if (!ok('blink', 0.05)) return; noise(0.12, 0.1, 'bandpass', 1400); tone(900, 0.1, 'sine', 0.06, 1700); };
  SFX.special = function () { if (!ok('special', 0.05)) return; tone(300, 0.2, 'sawtooth', 0.14, 1300); };
  SFX.ult = function () { if (!ok('ult', 0.1)) return; noise(0.45, 0.28, 'lowpass', 700); tone(120, 0.5, 'sawtooth', 0.2, 40); };
  SFX.boss = function () { if (!ok('boss', 0.1)) return; tone(90, 0.5, 'sawtooth', 0.2, 60); tone(70, 0.6, 'square', 0.1, 50); };
  SFX.victory = function () { if (!ctx || SFX.muted) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'square', 0.18, null, ctx.currentTime + i * 0.13)); };
  SFX.over = function () { if (!ctx || SFX.muted) return; [400, 300, 200, 120].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.16, null, ctx.currentTime + i * 0.14)); };

  global.SFX = SFX;
})(typeof window !== 'undefined' ? window : globalThis);
