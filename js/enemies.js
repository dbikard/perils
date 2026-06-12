/* enemies.js — enemy archetypes, flow-field movement, ranged fire, and the spawn director. */
(function (global) {
  'use strict';
  const E = global.Engine;

  const ENEMY_TYPES = {
    swarmer:  { r: 10, hp: 12,  speed: 64,  damage: 9,  xp: 1, color: '#ff5a6e', shape: 'circle' },
    sprinter: { r: 8,  hp: 9,   speed: 122, damage: 8,  xp: 1, color: '#ff8a5a', shape: 'tri' },
    hulk:     { r: 18, hp: 78,  speed: 38,  damage: 16, xp: 4, color: '#c0466e', shape: 'square' },
    spitter:  { r: 11, hp: 20,  speed: 50,  damage: 5,  xp: 2, color: '#ffb347', shape: 'diamond',
                ranged: true, fireRange: 340, fireCd: 2.4, projSpeed: 210, projDmg: 9 },
    // wraith (Helios Station): phases straight through bulkheads — corridors
    // are not cover against it, and weapons can't target it behind walls
    wraith:   { r: 11, hp: 30,  speed: 64,  damage: 11, xp: 3, color: '#c48eff', shape: 'circle', ghost: true },
    // boss: collision radius must fit the 2-tile (64px) corridors; drawn larger.
    // Its mortar slams arc over walls — cover blocks bullets, not the barrage.
    boss:     { r: 26, hp: 700, speed: 44, damage: 24, xp: 30, color: '#ff3b5e', shape: 'square', boss: true,
                slamCd: 3.2, slamRange: 520, slamRadius: 70, slamDmg: 20 }
  };

  function spawnEnemy(game, typeId, x, y, elite) {
    const def = ENEMY_TYPES[typeId];
    const e = game.enemies.spawn();
    // gentle linear HP growth, then a quadratic late-game wall (a maxed build
    // should still feel hunted at minute 5 — threat must outpace power slightly)
    const t = game.timeSec;
    const hpScale = (1 + t * 0.007 + Math.max(0, t - 150) * Math.max(0, t - 150) * 0.0003)
      * ((game.stageDef && game.stageDef.hpMult) || 1);
    const dmgScale = 1 + game.timeSec * 0.003;
    e.type = typeId; e.x = x; e.y = y; e.r = def.r;
    e.maxHp = def.hp * hpScale; e.hp = e.maxHp;
    e.speed = def.speed; e.damage = def.damage * dmgScale;
    e.color = def.color; e.shape = def.shape;
    e.hitFlash = 0; e.stun = 0;
    e.ranged = !!def.ranged; e.fireRange = def.fireRange || 0; e.fireCd = def.fireCd || 0;
    e.fireTimer = def.fireCd ? def.fireCd * 0.5 : 0;
    e.projSpeed = def.projSpeed || 0; e.projDmg = (def.projDmg || 0) * dmgScale;
    e.boss = !!def.boss;
    e.ghost = !!def.ghost;
    if (def.boss) {
      e.slamCd = def.slamCd; e.slamRange = def.slamRange; e.slamRadius = def.slamRadius;
      e.slamDmg = def.slamDmg * dmgScale;
      e.slamTimer = 2.5; // grace period after the spawn warning
    }
    e.elite = false; e.xpValue = def.xp || 1;
    if (elite) {
      // elite: tanky, faster, juicy bounty — worth diving into the swarm for
      e.elite = true; e.r = def.r * 1.3;
      e.maxHp *= 4; e.hp = e.maxHp;
      e.speed *= 1.15; e.damage *= 1.5;
      e.xpValue = Math.max(6, e.xpValue * 5);
    }
    return e;
  }

  function fireEnemyProjectile(game, e, dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    const ep = game.enemyProjectiles.spawn();
    ep.x = e.x; ep.y = e.y; ep.vx = dx / l * e.projSpeed; ep.vy = dy / l * e.projSpeed;
    ep.r = 6; ep.damage = e.projDmg; ep.life = 4; ep.color = '#ffb347';
  }

  function updateMovement(game, dt) {
    const p = game.player, map = game.map, ff = game.ff, list = game.enemies.active;
    const slow = game.enemySlow > 0 ? 0.4 : 1;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      if (e.stun > 0) {
        e.stun -= dt;
      } else {
        let hold = false;
        if (e.ranged) {
          const dx = p.x - e.x, dy = p.y - e.y, d2 = dx * dx + dy * dy;
          if (d2 < e.fireRange * e.fireRange && map.lineClear(e.x, e.y, p.x, p.y)) {
            hold = true; e.fireTimer -= dt;
            if (e.fireTimer <= 0) { e.fireTimer = e.fireCd; fireEnemyProjectile(game, e, dx, dy); }
          }
        }
        if (!hold && e.ghost) {
          // wraiths drift straight at the player, walls be damned
          const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
          e.x += dx / l * e.speed * slow * dt;
          e.y += dy / l * e.speed * slow * dt;
        } else if (!hold) {
          const tx = Math.floor(e.x / map.tile), ty = Math.floor(e.y / map.tile);
          let dir = ff.dirAtTile(tx, ty), dx = dir.x, dy = dir.y;
          if (dx === 0 && dy === 0) { dx = p.x - e.x; dy = p.y - e.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l; }
          let vx = dx * e.speed * slow, vy = dy * e.speed * slow;
          // light separation
          let sx = 0, sy = 0;
          game.enemyHash.queryCircle(e.x, e.y, e.r * 2.4, (o) => {
            if (o === e || !o._active) return;
            const ox = e.x - o.x, oy = e.y - o.y, dd = ox * ox + oy * oy, rr = e.r + o.r;
            if (dd > 0 && dd < rr * rr) { const d = Math.sqrt(dd); sx += ox / d; sy += oy / d; }
          });
          vx += sx * e.speed * 0.5; vy += sy * e.speed * 0.5;
          const nx = e.x + vx * dt; if (!game.hitsWall(nx, e.y, e.r)) e.x = nx;
          const ny = e.y + vy * dt; if (!game.hitsWall(e.x, ny, e.r)) e.y = ny;
        }
      }

      // boss mortar: lob a slam at the player's position — no line of sight
      // needed, so hiding behind walls (or camping the airlock) stays dangerous
      if (e.boss && e.stun <= 0) {
        e.slamTimer -= dt;
        const dxp = p.x - e.x, dyp = p.y - e.y;
        if (e.slamTimer <= 0 && dxp * dxp + dyp * dyp < e.slamRange * e.slamRange) {
          e.slamTimer = e.slamCd;
          game.slams.push({ x: p.x, y: p.y, t: 0, delay: 1.2, radius: e.slamRadius, damage: e.slamDmg });
          game.addEffect({ type: 'ring', x: e.x, y: e.y, r0: e.r, r1: e.r + 26, life: 0.3, maxLife: 0.3, color: '#ff3b5e' });
          if (global.SFX) global.SFX.shoot();
        }
      }

      // contact damage
      const pr = e.r + p.r;
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < pr * pr) {
        game.damagePlayer(e.damage * dt);
      }
    }
  }

  // telegraphed boss mortar blasts: detonate after the delay, walls don't help
  function updateSlams(game, dt) {
    const list = game.slams, p = game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      s.t += dt;
      if (s.t < s.delay) continue;
      const rr = s.radius + p.r * 0.5;
      if ((p.x - s.x) * (p.x - s.x) + (p.y - s.y) * (p.y - s.y) < rr * rr) game.damagePlayer(s.damage);
      game.addEffect({ type: 'ring', x: s.x, y: s.y, r0: 12, r1: s.radius, life: 0.32, maxLife: 0.32, color: '#ff3b5e' });
      if (global.Particles) global.Particles.burst(game, s.x, s.y, '#ff3b5e', 12, 200);
      if (global.SFX) global.SFX.hit();
      E.shake(4);
      list.splice(i, 1);
    }
  }

  function updateEnemyProjectiles(game, dt) {
    const list = game.enemyProjectiles.active, map = game.map, p = game.player;
    for (let i = list.length - 1; i >= 0; i--) {
      const ep = list[i];
      ep.x += ep.vx * dt; ep.y += ep.vy * dt; ep.life -= dt;
      if (ep.life <= 0 || map.isWallWorld(ep.x, ep.y)) { game.enemyProjectiles.release(ep); continue; }
      const rr = ep.r + p.r;
      if ((ep.x - p.x) * (ep.x - p.x) + (ep.y - p.y) * (ep.y - p.y) < rr * rr) {
        game.damagePlayer(ep.damage);
        game.enemyProjectiles.release(ep);
      }
    }
  }

  function pickType(game) {
    const t = game.timeSec, r = game.rng();
    if (game.stageDef && game.stageDef.wraiths && t > 45 && r < 0.22) return 'wraith';
    if (t > 240) { // late mix punishes pure kiting: ranged + fast dominate
      if (r < 0.15) return 'hulk';
      if (r < 0.50) return 'spitter';
      if (r < 0.80) return 'sprinter';
      return 'swarmer';
    }
    if (t > 180 && r < 0.12) return 'hulk';
    if (t > 90 && r < 0.30) return 'spitter';
    if (t > 30 && r < 0.42) return 'sprinter';
    return 'swarmer';
  }

  function spawnRing(game) {
    const p = game.player;
    const diag = Math.hypot(E.width, E.height);
    return game.map.randomFloorRingWorld(game.rng, p.x, p.y, diag * 0.5 + 40, diag * 0.5 + 320);
  }

  function updateSpawning(game, dt) {
    const t = game.timeSec, escaping = game.phase === 'ESCAPE';
    const MAX = 300;

    // boss waves: every ~120s, tightening to 90s late
    game.bossTimer -= dt;
    if (game.bossTimer <= 0) {
      game.bossTimer = t > 240 ? 90 : 120;
      if (game.enemies.count < MAX) {
        const pos = spawnRing(game);
        spawnEnemy(game, 'boss', pos.x, pos.y);
        if (game.announce) game.announce('⚠ HEAVY UNIT INBOUND', 2.5);
        if (global.SFX) global.SFX.boss();
        E.shake(7);
      }
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;
    // pressure/release: ramping spawn rate with a surge at the top of each
    // minute and a lull at the end (breathe, collect XP) — flow theory.
    // enemies/sec: shallow ramp through the midgame, sharp ramp after 3min
    let rate = 0.85 + t * 0.010 + Math.max(0, t - 180) * 0.022; // 0.85 → ~2.7 @3min → ~6.5 @5min
    const phase = t % 60;
    if (phase >= 48) rate *= 0.35;           // lull
    else if (t > 60 && phase < 8) rate *= 1.4; // surge
    if (escaping) rate *= 2.5;               // the escape is the hardest moment by design
    rate *= (game.stageDef && game.stageDef.rateMult) || 1;
    const batch = 1 + Math.floor(t / 75);
    game.spawnTimer += batch / rate;
    if (game.enemies.count >= MAX) return;

    for (let b = 0; b < batch && game.enemies.count < MAX; b++) {
      // late game, some hostiles crawl out of the vents anywhere on the ship —
      // open space stops being guaranteed-safe, so pure kiting isn't enough
      const vent = (t > 150 || escaping) && game.rng.chance(escaping ? 0.55 : 0.35);
      const pos = vent
        ? game.map.randomFloorRingWorld(game.rng, game.player.x, game.player.y, 280, 1e9)
        : spawnRing(game);
      const elite = t > 90 && game.rng.chance(0.04);
      spawnEnemy(game, pickType(game), pos.x, pos.y, elite);
    }
  }

  // immediate wave around the player (escape kickoff etc.)
  function burst(game, n) {
    for (let b = 0; b < n && game.enemies.count < 300; b++) {
      const pos = spawnRing(game);
      spawnEnemy(game, pickType(game), pos.x, pos.y);
    }
  }

  global.ENEMY_TYPES = ENEMY_TYPES;
  global.Enemies = { ENEMY_TYPES, spawnEnemy, updateMovement, updateEnemyProjectiles, updateSpawning, updateSlams, burst };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Enemies;
})(typeof window !== 'undefined' ? window : globalThis);
