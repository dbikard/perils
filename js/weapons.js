/* weapons.js — weapon definitions (data-driven), auto-firing, and projectile/mine stepping.
 * Each weapon instance is { id, def, level, timer, state }. def.update() runs every frame
 * (handles its own cooldown or continuous behaviour). Six weapons with distinct patterns. */
(function (global) {
  'use strict';

  // global multipliers (passives + Overload special)
  function eff(game) {
    const p = game.player, o = p.overload > 0;
    return {
      dmg: p.stats.damageMult * (o ? 1.6 : 1),
      cd: p.stats.cooldownMult * (o ? 0.55 : 1),
      extra: Math.max(0, (p.stats.count | 0) - 1) // bonus projectiles from Munitions Splitter
    };
  }

  function spawnProjectile(game, x, y, dx, dy, speed, r, damage, life, pierce, color) {
    const pr = game.projectiles.spawn();
    pr.x = x; pr.y = y; pr.vx = dx * speed; pr.vy = dy * speed;
    pr.r = r; pr.damage = damage; pr.life = life; pr.pierce = pierce; pr.color = color;
    return pr;
  }

  // nearest up-to-n enemies within range; when los=true, only those with a clear line of sight
  // (no wall between) from (x,y) — so weapons never target enemies hidden behind walls.
  function findNearestEnemies(game, x, y, maxRange, n, los) {
    const list = game.enemies.active, max2 = maxRange * maxRange, cand = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d2 <= max2) cand.push({ e, d2 });
    }
    cand.sort((a, b) => a.d2 - b.d2);
    const out = [], map = game.map;
    for (let i = 0; i < cand.length && out.length < n; i++) {
      const e = cand[i].e;
      if (los && !map.lineClear(x, y, e.x, e.y)) continue; // checked nearest-first, so cost is bounded
      out.push(e);
    }
    return out;
  }
  function findNearestEnemy(game, x, y, maxRange, los) {
    const a = findNearestEnemies(game, x, y, maxRange, 1, los);
    return a.length ? a[0] : null;
  }
  function nearestExcluding(game, x, y, range, set, los) {
    let best = null, bestD2 = range * range;
    const list = game.enemies.active, map = game.map;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (set.has(e)) continue;
      const d2 = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
      if (d2 >= bestD2) continue;
      if (los && !map.lineClear(x, y, e.x, e.y)) continue;
      best = e; bestD2 = d2;
    }
    return best;
  }

  function aimDir(game, fallbackFacing, range) {
    const p = game.player;
    const t = findNearestEnemy(game, p.x, p.y, range, true); // line-of-sight target
    if (t) { const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; }
    if (fallbackFacing) { const l = Math.hypot(p.facingX, p.facingY) || 1; return { x: p.facingX / l, y: p.facingY / l }; }
    return null;
  }

  const WEAPONS = {
    pulse: {
      id: 'pulse', name: 'Pulse Blaster', icon: '◦', color: '#38e8ff', maxLevel: 8,
      blurb: 'Bolts at the nearest hostile',
      stats: (l) => ({ cooldown: Math.max(0.28, 0.6 - 0.035 * (l - 1)), damage: 14 + 4 * (l - 1),
        count: 1 + Math.floor((l - 1) / 3), pierce: Math.floor((l - 1) / 4), speed: 470, projR: 5, life: 1.3, range: 520 }),
      update(game, w, dt) {
        const p = game.player, e = eff(game), s = this.stats(w.level);
        w.timer -= dt; if (w.timer > 0) return; w.timer += s.cooldown * e.cd;
        const count = s.count + e.extra;
        const targets = findNearestEnemies(game, p.x, p.y, s.range, count, true);
        if (!targets.length) { w.timer = Math.min(w.timer, 0.12); return; }
        const dmg = s.damage * e.dmg;
        for (let k = 0; k < count; k++) {
          const t = targets[k % targets.length];
          let dx = t.x - p.x, dy = t.y - p.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
          if (k >= targets.length) { const a = ((k - targets.length + 1) * 0.18) * (k % 2 ? 1 : -1), c = Math.cos(a), si = Math.sin(a); const rx = dx * c - dy * si, ry = dx * si + dy * c; dx = rx; dy = ry; }
          spawnProjectile(game, p.x, p.y, dx, dy, s.speed, s.projR, dmg, s.life, s.pierce, this.color);
        }
        const m0 = targets[0], mdx = m0.x - p.x, mdy = m0.y - p.y, ml = Math.hypot(mdx, mdy) || 1;
        game.addEffect({ type: 'muzzle', x: p.x + mdx / ml * p.r * 1.2, y: p.y + mdy / ml * p.r * 1.2, angle: Math.atan2(mdy, mdx), life: 0.07, maxLife: 0.07, color: this.color });
        if (global.SFX) global.SFX.shoot();
      }
    },

    scatter: {
      id: 'scatter', name: 'Scatter Gun', icon: '≪', color: '#ffd166', maxLevel: 8,
      blurb: 'Cone of pellets in your heading',
      stats: (l) => ({ cooldown: Math.max(0.5, 0.95 - 0.04 * (l - 1)), damage: 8 + 2 * (l - 1),
        pellets: 4 + Math.floor((l - 1) / 2), spread: 0.75, speed: 430, projR: 4, life: 0.42 }),
      update(game, w, dt) {
        const p = game.player, e = eff(game), s = this.stats(w.level);
        w.timer -= dt; if (w.timer > 0) return; w.timer += s.cooldown * e.cd;
        const dir = aimDir(game, true, 560); if (!dir) return;
        const base = Math.atan2(dir.y, dir.x), pellets = s.pellets + e.extra, dmg = s.damage * e.dmg;
        for (let i = 0; i < pellets; i++) {
          const t = pellets === 1 ? 0.5 : i / (pellets - 1);
          const a = base + (t - 0.5) * s.spread;
          spawnProjectile(game, p.x, p.y, Math.cos(a), Math.sin(a), s.speed, s.projR, dmg, s.life, 0, this.color);
        }
        game.addEffect({ type: 'muzzle', x: p.x + dir.x * p.r * 1.2, y: p.y + dir.y * p.r * 1.2, angle: base, life: 0.07, maxLife: 0.07, color: this.color });
        if (global.SFX) global.SFX.shoot();
      }
    },

    arc: {
      id: 'arc', name: 'Arc Coil', icon: '⌁', color: '#a9b8ff', maxLevel: 8,
      blurb: 'Lightning that chains between foes',
      stats: (l) => ({ cooldown: Math.max(0.6, 1.2 - 0.06 * (l - 1)), damage: 12 + 3 * (l - 1),
        chains: 2 + Math.floor((l - 1) / 2), jump: 160, range: 360 }),
      update(game, w, dt) {
        const p = game.player, e = eff(game), s = this.stats(w.level);
        w.timer -= dt; if (w.timer > 0) return; w.timer += s.cooldown * e.cd;
        let cur = findNearestEnemy(game, p.x, p.y, s.range, true);
        if (!cur) { w.timer = Math.min(w.timer, 0.15); return; }
        let fromX = p.x, fromY = p.y, dmg = s.damage * e.dmg, hops = s.chains;
        const seen = new Set();
        while (cur && hops > 0) {
          game.addEffect({ type: 'trail', x0: fromX, y0: fromY, x1: cur.x, y1: cur.y, life: 0.14, maxLife: 0.14, color: this.color });
          cur.hp -= dmg; cur.hitFlash = 0.08; seen.add(cur);
          if (global.Particles) global.Particles.spark(game, cur.x, cur.y, this.color);
          fromX = cur.x; fromY = cur.y;
          if (cur.hp <= 0) game.killEnemy(cur);
          dmg *= 0.85; hops--;
          cur = nearestExcluding(game, fromX, fromY, s.jump, seen, true);
        }
      }
    },

    beam: {
      id: 'beam', name: 'Rail Beam', icon: '═', color: '#54ff9f', maxLevel: 8,
      blurb: 'Piercing beam at the nearest hostile',
      stats: (l) => ({ cooldown: Math.max(0.7, 1.4 - 0.07 * (l - 1)), damage: 20 + 6 * (l - 1),
        width: 10 + 2 * (l - 1), range: 540 }),
      update(game, w, dt) {
        const p = game.player, e = eff(game), s = this.stats(w.level);
        w.timer -= dt; if (w.timer > 0) return; w.timer += s.cooldown * e.cd;
        const dir = aimDir(game, false, s.range); if (!dir) { w.timer = Math.min(w.timer, 0.15); return; }
        const dmg = s.damage * e.dmg, half = s.width / 2;
        const ex = p.x + dir.x * s.range, ey = p.y + dir.y * s.range;
        game.addEffect({ type: 'trail', x0: p.x, y0: p.y, x1: ex, y1: ey, life: 0.12, maxLife: 0.12, color: this.color });
        game.addEffect({ type: 'muzzle', x: p.x + dir.x * p.r * 1.2, y: p.y + dir.y * p.r * 1.2, angle: Math.atan2(dir.y, dir.x), life: 0.08, maxLife: 0.08, color: this.color });
        if (global.SFX) global.SFX.shoot();
        const list = game.enemies.active;
        for (let i = list.length - 1; i >= 0; i--) {
          const en = list[i];
          const rx = en.x - p.x, ry = en.y - p.y;
          const proj = rx * dir.x + ry * dir.y;            // distance along beam
          if (proj < 0 || proj > s.range) continue;
          const perp = Math.abs(rx * dir.y - ry * dir.x);  // perpendicular distance
          if (perp <= half + en.r) { en.hp -= dmg; en.hitFlash = 0.08; if (global.Particles) global.Particles.spark(game, en.x, en.y, this.color); if (en.hp <= 0) game.killEnemy(en); }
        }
      }
    },

    orbiter: {
      id: 'orbiter', name: 'Orbiters', icon: '◍', color: '#7fd8ff', maxLevel: 8,
      blurb: 'Drones that circle and shred contact',
      stats: (l) => ({ bodies: 2 + Math.floor((l - 1) / 2), dps: 26 + 6 * (l - 1),
        radius: 72 + 4 * (l - 1), bodyR: 12, spin: 2.2 }),
      update(game, w, dt) {
        const p = game.player, e = eff(game), s = this.stats(w.level);
        w.state.angle = (w.state.angle || 0) + s.spin * dt;
        const n = s.bodies, dps = s.dps * e.dmg * dt;
        const pos = w.state.positions || (w.state.positions = []);
        pos.length = 0;
        for (let i = 0; i < n; i++) {
          const a = w.state.angle + i * (Math.PI * 2 / n);
          const ox = p.x + Math.cos(a) * s.radius, oy = p.y + Math.sin(a) * s.radius;
          pos.push(ox, oy);
          game.enemyHash.queryCircle(ox, oy, s.bodyR + 16, (en) => {
            if (!en._active) return;
            const rr = s.bodyR + en.r;
            if ((en.x - ox) * (en.x - ox) + (en.y - oy) * (en.y - oy) <= rr * rr) {
              en.hp -= dps; en.hitFlash = 0.06; if (en.hp <= 0) game.killEnemy(en);
            }
          });
        }
        w.state.bodyR = s.bodyR;
      }
    },

    mine: {
      id: 'mine', name: 'Mine Layer', icon: '◆', color: '#ff5a6e', maxLevel: 8,
      blurb: 'Drops proximity mines that blast an area',
      stats: (l) => ({ cooldown: Math.max(0.8, 1.8 - 0.08 * (l - 1)), damage: 36 + 8 * (l - 1),
        radius: 55 + 4 * (l - 1), triggerR: 24, life: 16 }),
      update(game, w, dt) {
        const p = game.player, s = this.stats(w.level), e = eff(game);
        w.timer -= dt; if (w.timer > 0) return; w.timer += s.cooldown * e.cd;
        const m = game.mines.spawn();
        m.x = p.x; m.y = p.y; m.r = 7; m.arm = 0.4; m.damage = s.damage * e.dmg;
        m.radius = s.radius; m.triggerR = s.triggerR; m.life = s.life;
      }
    }
  };

  function acquire(game, id) {
    if (game.player.weapons.some(w => w.id === id)) return false;
    game.player.weapons.push({ id, def: WEAPONS[id], level: 1, timer: 0, state: {} });
    return true;
  }

  function update(game, dt) {
    const ws = game.player.weapons;
    for (let i = 0; i < ws.length; i++) ws[i].def.update(game, ws[i], dt);
  }

  function updateProjectiles(game, dt) {
    const projs = game.projectiles.active, map = game.map;
    for (let i = projs.length - 1; i >= 0; i--) {
      const pr = projs[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0 || map.isWallWorld(pr.x, pr.y)) { game.projectiles.release(pr); continue; }
      let dead = false;
      game.enemyHash.queryCircle(pr.x, pr.y, pr.r + 16, (en) => {
        if (dead || !en._active) return;
        const rr = pr.r + en.r;
        if ((en.x - pr.x) * (en.x - pr.x) + (en.y - pr.y) * (en.y - pr.y) <= rr * rr) {
          en.hp -= pr.damage; en.hitFlash = 0.08;
          if (global.Particles) global.Particles.spark(game, pr.x, pr.y, pr.color);
          if (en.hp <= 0) game.killEnemy(en);
          if (pr.pierce > 0) pr.pierce--; else dead = true;
        }
      });
      if (dead) game.projectiles.release(pr);
    }
  }

  function updateMines(game, dt) {
    const mines = game.mines.active;
    for (let i = mines.length - 1; i >= 0; i--) {
      const m = mines[i];
      if (m.arm > 0) m.arm -= dt;
      m.life -= dt;
      if (m.life <= 0) { game.mines.release(m); continue; }
      if (m.arm > 0) continue;
      let trip = false;
      game.enemyHash.queryCircle(m.x, m.y, m.triggerR + 14, (en) => {
        if (trip || !en._active) return;
        const rr = m.triggerR + en.r;
        if ((en.x - m.x) * (en.x - m.x) + (en.y - m.y) * (en.y - m.y) <= rr * rr) trip = true;
      });
      if (!trip) continue;
      // explode
      game.addEffect({ type: 'ring', x: m.x, y: m.y, r0: 8, r1: m.radius, life: 0.35, maxLife: 0.35, color: '#ff7a5a' });
      if (global.Particles) global.Particles.burst(game, m.x, m.y, '#ff7a5a', 14, 210);
      global.Engine.shake(5);
      if (global.SFX) global.SFX.hit();
      const list = game.enemies.active, rad2 = m.radius * m.radius;
      for (let j = list.length - 1; j >= 0; j--) {
        const en = list[j];
        if ((en.x - m.x) * (en.x - m.x) + (en.y - m.y) * (en.y - m.y) <= rad2) {
          en.hp -= m.damage; en.hitFlash = 0.1; if (en.hp <= 0) game.killEnemy(en);
        }
      }
      game.mines.release(m);
    }
  }

  global.WEAPONS = WEAPONS;
  global.Weapons = { WEAPONS, acquire, update, updateProjectiles, updateMines, findNearestEnemy, findNearestEnemies };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Weapons;
})(typeof window !== 'undefined' ? window : globalThis);
