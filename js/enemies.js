/* enemies.js — enemy archetypes, flow-field movement, ranged fire, and the spawn director. */
(function (global) {
  'use strict';
  const E = global.Engine;

  const ENEMY_TYPES = {
    swarmer:  { r: 10, hp: 12,  speed: 64,  damage: 7,  color: '#ff5a6e', shape: 'circle' },
    sprinter: { r: 8,  hp: 9,   speed: 122, damage: 6,  color: '#ff8a5a', shape: 'tri' },
    hulk:     { r: 18, hp: 78,  speed: 38,  damage: 16, color: '#c0466e', shape: 'square' },
    spitter:  { r: 11, hp: 20,  speed: 50,  damage: 5,  color: '#ffb347', shape: 'diamond',
                ranged: true, fireRange: 340, fireCd: 2.4, projSpeed: 210, projDmg: 9 },
    boss:     { r: 34, hp: 1200, speed: 44, damage: 24, color: '#ff3b5e', shape: 'square', boss: true }
  };

  function spawnEnemy(game, typeId, x, y) {
    const def = ENEMY_TYPES[typeId];
    const e = game.enemies.spawn();
    const hpScale = 1 + game.timeSec * 0.013;
    const dmgScale = 1 + game.timeSec * 0.004;
    e.type = typeId; e.x = x; e.y = y; e.r = def.r;
    e.maxHp = def.hp * hpScale; e.hp = e.maxHp;
    e.speed = def.speed; e.damage = def.damage * dmgScale;
    e.color = def.color; e.shape = def.shape;
    e.hitFlash = 0; e.stun = 0;
    e.ranged = !!def.ranged; e.fireRange = def.fireRange || 0; e.fireCd = def.fireCd || 0;
    e.fireTimer = def.fireCd ? def.fireCd * 0.5 : 0;
    e.projSpeed = def.projSpeed || 0; e.projDmg = (def.projDmg || 0) * dmgScale;
    e.boss = !!def.boss;
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
        if (!hold) {
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

      // contact damage
      const pr = e.r + p.r;
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < pr * pr) {
        if (p.invuln <= 0) { p.hp -= e.damage * dt; p.hitFlash = 0.12; }
      }
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
        if (p.invuln <= 0) { p.hp -= ep.damage; p.hitFlash = 0.14; }
        game.enemyProjectiles.release(ep);
      }
    }
  }

  function pickType(game) {
    const t = game.timeSec, r = game.rng();
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
    const MAX = 380;

    // boss waves every ~120s
    game.bossTimer -= dt;
    if (game.bossTimer <= 0) {
      game.bossTimer = 120;
      if (game.enemies.count < MAX) {
        const pos = spawnRing(game);
        spawnEnemy(game, 'boss', pos.x, pos.y);
        if (game.announce) game.announce('⚠ HEAVY UNIT INBOUND', 2.5);
      }
    }

    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;
    let interval = Math.max(0.16, 1.0 - t * 0.012);
    let batch = 1 + Math.floor(t / 25);
    if (escaping) { interval *= 0.55; batch = Math.ceil(batch * 1.6); }
    game.spawnTimer += interval;
    if (game.enemies.count >= MAX) return;

    for (let b = 0; b < batch && game.enemies.count < MAX; b++) {
      const pos = spawnRing(game);
      spawnEnemy(game, pickType(game), pos.x, pos.y);
    }
  }

  global.ENEMY_TYPES = ENEMY_TYPES;
  global.Enemies = { ENEMY_TYPES, spawnEnemy, updateMovement, updateEnemyProjectiles, updateSpawning };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Enemies;
})(typeof window !== 'undefined' ? window : globalThis);
