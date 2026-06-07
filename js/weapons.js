/* weapons.js — weapon definitions, auto-firing, and projectile stepping.
 * Phase 0: Pulse Blaster (fires at nearest enemy). More weapons land in Phase 2. */
(function (global) {
  'use strict';

  const WEAPONS = {
    pulse: {
      id: 'pulse', name: 'Pulse Blaster',
      cooldown: 0.55, damage: 16, speed: 460, projR: 5, life: 1.3, range: 460,
      pierce: 0, color: '#38e8ff'
    }
  };

  function findNearestEnemy(game, x, y, maxRange) {
    let best = null, bestD2 = maxRange * maxRange;
    const list = game.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    return best;
  }

  // up to n distinct nearest enemies within range
  function findNearestEnemies(game, x, y, maxRange, n) {
    const list = game.enemies.active, max2 = maxRange * maxRange;
    const cand = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d2 <= max2) cand.push({ e, d2 });
    }
    cand.sort((a, b) => a.d2 - b.d2);
    const out = [];
    for (let i = 0; i < cand.length && i < n; i++) out.push(cand[i].e);
    return out;
  }

  function fireAll(game, dt) {
    const p = game.player, st = p.stats;
    for (let i = 0; i < p.weapons.length; i++) {
      const w = p.weapons[i];
      const def = w.def;
      w.timer -= dt;
      if (w.timer > 0) continue;
      w.timer += def.cooldown * st.cooldownMult;
      const count = Math.max(1, st.count | 0);
      const targets = findNearestEnemies(game, p.x, p.y, def.range, count);
      if (!targets.length) { w.timer = Math.min(w.timer, 0.12); continue; } // nothing in range, retry soon
      const damage = def.damage * st.damageMult;
      for (let k = 0; k < count; k++) {
        const target = targets[k % targets.length];
        let dx = target.x - p.x, dy = target.y - p.y;
        const l = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= l; dy /= l;
        // if reusing a target (more shots than enemies), fan the extras out slightly
        if (k >= targets.length) {
          const a = ((k - targets.length + 1) * 0.18) * (k % 2 ? 1 : -1);
          const c = Math.cos(a), s = Math.sin(a);
          const rx = dx * c - dy * s, ry = dx * s + dy * c; dx = rx; dy = ry;
        }
        const pr = game.projectiles.spawn();
        pr.x = p.x; pr.y = p.y;
        pr.vx = dx * def.speed; pr.vy = dy * def.speed;
        pr.r = def.projR; pr.damage = damage; pr.life = def.life;
        pr.pierce = def.pierce; pr.color = def.color;
      }
    }
  }

  function updateProjectiles(game, dt) {
    const projs = game.projectiles.active;
    const map = game.map;
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0 || map.isWallWorld(pr.x, pr.y)) { game.projectiles.release(pr); continue; }
      // enemy collision
      let dead = false;
      game.enemyHash.queryCircle(pr.x, pr.y, pr.r + 14, (e) => {
        if (dead || !e._active) return;
        const rr = pr.r + e.r;
        if ((e.x - pr.x) * (e.x - pr.x) + (e.y - pr.y) * (e.y - pr.y) <= rr * rr) {
          e.hp -= pr.damage; e.hitFlash = 0.08;
          if (e.hp <= 0) game.killEnemy(e);
          if (pr.pierce > 0) { pr.pierce--; }
          else { dead = true; }
        }
      });
      if (dead) game.projectiles.release(pr);
    }
  }

  global.WEAPONS = WEAPONS;
  global.Weapons = { WEAPONS, fireAll, updateProjectiles, findNearestEnemy, findNearestEnemies };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Weapons;
})(typeof window !== 'undefined' ? window : globalThis);
