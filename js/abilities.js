/* abilities.js — active abilities.
 * Phase 1: Blink (dash + i-frames) and Ultimate (Orbital Strike, charges from kills).
 * SPECIALS (build-chosen EMP/Deflector/Overload/Sentry/TimeDilation) arrive in Phase 2. */
(function (global) {
  'use strict';
  const E = global.Engine;

  // Build-chosen Special abilities — defined in Phase 2 (slot reserved here).
  const SPECIALS = {};

  function blink(game) {
    const p = game.player;
    if (p.blink.cd > 0) return false;
    // direction: current movement input, else last facing
    let dx = p.facingX, dy = p.facingY;
    const mv = E.input.moveVector();
    if (mv.x !== 0 || mv.y !== 0) { const l = Math.hypot(mv.x, mv.y) || 1; dx = mv.x / l; dy = mv.y / l; }

    const ox = p.x, oy = p.y;
    const dist = p.blink.dist;
    const steps = Math.ceil(dist / 6);
    let fx = p.x, fy = p.y;
    for (let i = 1; i <= steps; i++) {
      const tx = ox + dx * (dist * i / steps), ty = oy + dy * (dist * i / steps);
      if (game.hitsWall(tx, ty, p.r)) break;
      fx = tx; fy = ty;
    }
    p.x = fx; p.y = fy;
    p.invuln = Math.max(p.invuln, p.blink.invuln);
    p.blink.cd = p.blink.cdMax * p.blink.cdMult;
    game.addEffect({ type: 'trail', x0: ox, y0: oy, x1: fx, y1: fy, life: 0.25, maxLife: 0.25, color: '#9af0ff' });
    return true;
  }

  function ultimate(game) {
    const p = game.player;
    if (p.ult.charge < 1) return false;
    p.ult.charge = 0;
    const diag = Math.hypot(E.width, E.height);
    const R = diag * p.ult.radiusFactor, R2 = R * R;
    const list = game.enemies.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) <= R2) {
        e.hp -= p.ult.damage;
        if (e.hp <= 0) game.killEnemy(e);
      }
    }
    game.addEffect({ type: 'ring', x: p.x, y: p.y, r0: 12, r1: R, life: 0.5, maxLife: 0.5, color: '#ffd166' });
    game.addEffect({ type: 'flash', life: 0.22, maxLife: 0.22, color: '255,209,102' });
    return true;
  }

  function addUltCharge(game, amount) {
    const u = game.player.ult;
    u.charge = Math.min(1, u.charge + amount * u.mult);
  }

  function update(game, dt) {
    const p = game.player;
    if (p.blink.cd > 0) p.blink.cd -= dt;
    // act on tapped buttons / keys
    const taps = E.input.consumeTaps();
    for (let i = 0; i < taps.length; i++) {
      if (taps[i] === 'blink') blink(game);
      else if (taps[i] === 'ultimate') ultimate(game);
    }
    const keys = E.input.consumeKeyTaps();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] === ' ') blink(game);
      else if (keys[i] === 'e' || keys[i] === 'enter') ultimate(game);
    }
  }

  global.SPECIALS = SPECIALS;
  global.Abilities = { SPECIALS, blink, ultimate, addUltCharge, update };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Abilities;
})(typeof window !== 'undefined' ? window : globalThis);
