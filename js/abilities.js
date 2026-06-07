/* abilities.js — active abilities.
 * Blink (everyone), a build-chosen Special (one of five), and the Ultimate (Orbital Strike).
 * Also owns the lightweight effects-driven status changes (stun/slow/overload) and sentry drones. */
(function (global) {
  'use strict';
  const E = global.Engine;

  /* ---- build-chosen Special abilities ---- */
  const SPECIALS = {
    emp: {
      id: 'emp', name: 'EMP Pulse', icon: '◌', color: '#7fd8ff', maxLevel: 5,
      blurb: 'Knockback + stun nearby hostiles',
      stats: (l) => ({ cd: Math.max(5, 9 - 0.7 * (l - 1)), radius: 180 + 22 * (l - 1), stun: 1.0 + 0.2 * (l - 1), push: 90 }),
      activate(game, sp) {
        const p = game.player, s = this.stats(sp.level), R2 = s.radius * s.radius;
        const list = game.enemies.active;
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          const dx = e.x - p.x, dy = e.y - p.y, d2 = dx * dx + dy * dy;
          if (d2 <= R2) {
            const d = Math.sqrt(d2) || 1;
            const nx = e.x + dx / d * s.push, ny = e.y + dy / d * s.push;
            if (!game.hitsWall(nx, e.y, e.r)) e.x = nx;
            if (!game.hitsWall(e.x, ny, e.r)) e.y = ny;
            e.stun = Math.max(e.stun, s.stun);
          }
        }
        game.addEffect({ type: 'ring', x: p.x, y: p.y, r0: 10, r1: s.radius, life: 0.4, maxLife: 0.4, color: this.color });
      }
    },
    deflector: {
      id: 'deflector', name: 'Deflector Field', icon: '❖', color: '#9af0ff', maxLevel: 5,
      blurb: 'Brief invulnerable bubble',
      stats: (l) => ({ cd: Math.max(7, 12 - 0.8 * (l - 1)), dur: 1.6 + 0.35 * (l - 1) }),
      activate(game, sp) {
        const p = game.player, s = this.stats(sp.level);
        p.invuln = Math.max(p.invuln, s.dur);
        game.addEffect({ type: 'ring', x: p.x, y: p.y, r0: p.r + 6, r1: p.r + 38, life: 0.5, maxLife: 0.5, color: this.color });
      }
    },
    overload: {
      id: 'overload', name: 'Reactor Overload', icon: '⚛', color: '#ffd166', maxLevel: 5,
      blurb: 'Surge: +damage & +fire rate',
      stats: (l) => ({ cd: Math.max(8, 14 - 1.0 * (l - 1)), dur: 4 + 0.6 * (l - 1) }),
      activate(game, sp) {
        const p = game.player, s = this.stats(sp.level);
        p.overload = Math.max(p.overload, s.dur);
        game.addEffect({ type: 'flash', life: 0.2, maxLife: 0.2, color: '255,209,102' });
      }
    },
    sentry: {
      id: 'sentry', name: 'Sentry Drone', icon: '⊡', color: '#54ff9f', maxLevel: 5,
      blurb: 'Deploy an auto-firing turret',
      stats: (l) => ({ cd: Math.max(6, 12 - 1.0 * (l - 1)), life: 8 + 1.5 * (l - 1), damage: 12 + 3 * (l - 1), cdFire: 0.4, range: 320 }),
      activate(game, sp) {
        const p = game.player, s = this.stats(sp.level);
        game.sentries.push({ x: p.x, y: p.y, life: s.life, fire: 0, cdFire: s.cdFire, damage: s.damage, range: s.range });
      }
    },
    timewarp: {
      id: 'timewarp', name: 'Time Dilation', icon: '◷', color: '#a9b8ff', maxLevel: 5,
      blurb: 'Slow all hostiles briefly',
      stats: (l) => ({ cd: Math.max(8, 14 - 1.0 * (l - 1)), dur: 3 + 0.5 * (l - 1) }),
      activate(game, sp) {
        const s = this.stats(sp.level);
        game.enemySlow = Math.max(game.enemySlow, s.dur);
        game.addEffect({ type: 'flash', life: 0.25, maxLife: 0.25, color: '169,184,255' });
      }
    }
  };

  function blink(game) {
    const p = game.player;
    if (p.blink.cd > 0) return false;
    let dx = p.facingX, dy = p.facingY;
    const mv = E.input.moveVector();
    if (mv.x !== 0 || mv.y !== 0) { const l = Math.hypot(mv.x, mv.y) || 1; dx = mv.x / l; dy = mv.y / l; }
    const ox = p.x, oy = p.y, dist = p.blink.dist, steps = Math.ceil(dist / 6);
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
    if (global.Particles) { global.Particles.puff(game, ox, oy, '#9af0ff', 6); global.Particles.puff(game, fx, fy, '#9af0ff', 6); }
    if (global.SFX) global.SFX.blink();
    return true;
  }

  function special(game) {
    const p = game.player;
    if (!p.special || p.special.cd > 0) return false;
    p.special.def.activate(game, p.special);
    p.special.cd = p.special.def.stats(p.special.level).cd;
    if (global.SFX) global.SFX.special();
    E.shake(4);
    return true;
  }

  function ultimate(game) {
    const p = game.player;
    if (p.ult.charge < 1) return false;
    p.ult.charge = 0;
    const diag = Math.hypot(E.width, E.height), R = diag * p.ult.radiusFactor, R2 = R * R;
    const list = game.enemies.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) <= R2) {
        e.hp -= p.ult.damage; if (e.hp <= 0) game.killEnemy(e);
      }
    }
    game.addEffect({ type: 'ring', x: p.x, y: p.y, r0: 12, r1: R, life: 0.5, maxLife: 0.5, color: '#ffd166' });
    game.addEffect({ type: 'flash', life: 0.22, maxLife: 0.22, color: '255,209,102' });
    if (global.Particles) global.Particles.burst(game, p.x, p.y, '#ffd166', 30, 260);
    if (global.SFX) global.SFX.ult();
    E.shake(14);
    return true;
  }

  function addUltCharge(game, amount) {
    const u = game.player.ult;
    u.charge = Math.min(1, u.charge + amount * u.mult);
  }

  function setSpecial(game, id) {
    game.player.special = { id, def: SPECIALS[id], level: 1, cd: 0 };
  }

  function updateSentries(game, dt) {
    const list = game.sentries;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.life -= dt;
      if (s.life <= 0) { list.splice(i, 1); continue; }
      s.fire -= dt;
      if (s.fire <= 0) {
        const t = global.Weapons.findNearestEnemy(game, s.x, s.y, s.range, true);
        if (t) {
          s.fire = s.cdFire;
          let dx = t.x - s.x, dy = t.y - s.y; const l = Math.hypot(dx, dy) || 1;
          const pr = game.projectiles.spawn();
          pr.x = s.x; pr.y = s.y; pr.vx = dx / l * 430; pr.vy = dy / l * 430;
          pr.r = 4; pr.damage = s.damage * game.player.stats.damageMult; pr.life = 1.0; pr.pierce = 0; pr.color = '#54ff9f';
        }
      }
    }
  }

  function update(game, dt) {
    const p = game.player;
    if (p.blink.cd > 0) p.blink.cd -= dt;
    if (p.special && p.special.cd > 0) p.special.cd -= dt;
    if (p.overload > 0) p.overload -= dt;

    const taps = E.input.consumeTaps();
    for (let i = 0; i < taps.length; i++) {
      if (taps[i] === 'blink') blink(game);
      else if (taps[i] === 'special') special(game);
      else if (taps[i] === 'ultimate') ultimate(game);
    }
    const keys = E.input.consumeKeyTaps();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k === ' ') blink(game);
      else if (k === 'q') special(game);
      else if (k === 'e' || k === 'enter') ultimate(game);
    }
    updateSentries(game, dt);
  }

  global.SPECIALS = SPECIALS;
  global.Abilities = { SPECIALS, blink, special, ultimate, addUltCharge, setSpecial, update };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Abilities;
})(typeof window !== 'undefined' ? window : globalThis);
