/* particles.js — lightweight pooled particle juice (death bursts, hit sparks,
 * pickup sparkles, dash trail). Additive pixel squares. Operates on game.particles. */
(function (global) {
  'use strict';
  const CAP = 700;
  const Particles = {};

  function add(game, x, y, vx, vy, life, size, color, drag) {
    const a = game.particles;
    if (!a || a.length >= CAP) return;
    a.push({ x, y, vx, vy, life, maxLife: life, size, color, drag: drag == null ? 0.88 : drag });
  }

  // radial burst (enemy death)
  Particles.burst = function (game, x, y, color, count, spd) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const s = spd * (0.4 + Math.random() * 0.8);
      add(game, x, y, Math.cos(ang) * s, Math.sin(ang) * s, 0.28 + Math.random() * 0.3, 2 + Math.random() * 2, color, 0.85);
    }
  };
  // small spark (projectile/beam impact)
  Particles.spark = function (game, x, y, color) {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2, s = 60 + Math.random() * 130;
      add(game, x, y, Math.cos(ang) * s, Math.sin(ang) * s, 0.14 + Math.random() * 0.12, 1.5 + Math.random() * 1.5, color, 0.8);
    }
  };
  // upward sparkle (xp pickup)
  Particles.sparkle = function (game, x, y, color) {
    add(game, x, y, (Math.random() - 0.5) * 36, -34 - Math.random() * 30, 0.4, 2, color, 0.92);
  };
  // directional puff (blink trail)
  Particles.puff = function (game, x, y, color, count) {
    for (let i = 0; i < (count || 5); i++) {
      add(game, x, y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60, 0.3, 2, color, 0.85);
    }
  };

  Particles.update = function (game, dt) {
    const a = game.particles;
    if (!a) return;
    for (let i = a.length - 1; i >= 0; i--) {
      const p = a[i];
      p.life -= dt;
      if (p.life <= 0) { a[i] = a[a.length - 1]; a.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; p.vy *= p.drag;
    }
  };

  Particles.draw = function (ctx, game) {
    const a = game.particles;
    if (!a || !a.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const al = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = al;
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + al * 0.6);
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  global.Particles = Particles;
})(typeof window !== 'undefined' ? window : globalThis);
