/* enemies.js — enemy archetypes, flow-field movement, and the spawn director.
 * Phase 0: one Swarmer archetype that chases the player around walls. */
(function (global) {
  'use strict';

  const ENEMY_TYPES = {
    swarmer: { id: 'swarmer', r: 10, hp: 12, speed: 64, damage: 7, color: '#ff5a6e' }
  };

  function spawnEnemy(game, typeId, x, y) {
    const def = ENEMY_TYPES[typeId];
    const e = game.enemies.spawn();
    e.type = typeId; e.x = x; e.y = y; e.r = def.r;
    // gentle scaling over the run
    const scale = 1 + game.timeSec * 0.012;
    e.maxHp = def.hp * scale; e.hp = e.maxHp;
    e.speed = def.speed; e.damage = def.damage; e.color = def.color; e.hitFlash = 0;
    return e;
  }

  function updateMovement(game, dt) {
    const p = game.player, map = game.map, ff = game.ff, list = game.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.hitFlash > 0) e.hitFlash -= dt;

      // direction from flow field (routes around walls), fallback to straight line
      const tx = Math.floor(e.x / map.tile), ty = Math.floor(e.y / map.tile);
      let dir = ff.dirAtTile(tx, ty);
      let dx = dir.x, dy = dir.y;
      if (dx === 0 && dy === 0) {
        dx = p.x - e.x; dy = p.y - e.y;
        const l = Math.sqrt(dx * dx + dy * dy) || 1; dx /= l; dy /= l;
      }
      let vx = dx * e.speed, vy = dy * e.speed;

      // light separation so they don't perfectly stack
      let sx = 0, sy = 0;
      game.enemyHash.queryCircle(e.x, e.y, e.r * 2.4, (o) => {
        if (o === e || !o._active) return;
        const ox = e.x - o.x, oy = e.y - o.y, d2 = ox * ox + oy * oy;
        const rr = e.r + o.r;
        if (d2 > 0 && d2 < rr * rr) { const d = Math.sqrt(d2); sx += ox / d; sy += oy / d; }
      });
      vx += sx * e.speed * 0.5; vy += sy * e.speed * 0.5;

      // move with per-axis wall collision
      const nx = e.x + vx * dt;
      if (!game.hitsWall(nx, e.y, e.r)) e.x = nx;
      const ny = e.y + vy * dt;
      if (!game.hitsWall(e.x, ny, e.r)) e.y = ny;

      // contact damage to player
      const pr = e.r + p.r;
      if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < pr * pr) {
        if (p.invuln <= 0) { p.hp -= e.damage * dt; p.hitFlash = 0.12; }
      }
    }
  }

  function updateSpawning(game, dt) {
    const p = game.player, t = game.timeSec;
    const MAX = 360;
    game.spawnTimer -= dt;
    if (game.spawnTimer > 0) return;

    const interval = Math.max(0.16, 1.0 - t * 0.012);
    game.spawnTimer += interval;
    if (game.enemies.count >= MAX) return;

    const batch = 1 + Math.floor(t / 25);
    const diag = Math.sqrt(global.Engine.width * global.Engine.width + global.Engine.height * global.Engine.height);
    const minR = diag * 0.5 + 40, maxR = minR + 280;
    for (let b = 0; b < batch && game.enemies.count < MAX; b++) {
      const pos = game.map.randomFloorRingWorld(game.rng, p.x, p.y, minR, maxR);
      spawnEnemy(game, 'swarmer', pos.x, pos.y);
    }
  }

  global.ENEMY_TYPES = ENEMY_TYPES;
  global.Enemies = { ENEMY_TYPES, spawnEnemy, updateMovement, updateSpawning };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Enemies;
})(typeof window !== 'undefined' ? window : globalThis);
