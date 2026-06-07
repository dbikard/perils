/* game.js — run lifecycle + main update/render wiring (orchestrates all systems). */
(function (global) {
  'use strict';
  const E = global.Engine;

  const game = {
    phase: 'MENU',          // MENU | PLAYING | GAME_OVER (ESCAPE/VICTORY in Phase 2)
    map: null, ff: null, rng: null,
    player: null,
    enemies: null, projectiles: null, crystals: null,
    enemyHash: null,
    timeSec: 0,
    spawnTimer: 0,
    ffTimer: 0,
    kills: 0,
    _fps: 60
  };
  global.game = game;

  /* circle-vs-wall collision against the tile grid */
  game.hitsWall = function (x, y, r) {
    const map = game.map, t = map.tile;
    const minTx = Math.floor((x - r) / t), maxTx = Math.floor((x + r) / t);
    const minTy = Math.floor((y - r) / t), maxTy = Math.floor((y + r) / t);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!map.isWallTile(tx, ty)) continue;
        const rx = tx * t, ry = ty * t;
        const cx = x < rx ? rx : (x > rx + t ? rx + t : x);
        const cy = y < ry ? ry : (y > ry + t ? ry + t : y);
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
    return false;
  };

  game.killEnemy = function (e) {
    if (!e._active) return;
    game.kills++;
    global.Abilities.addUltCharge(game, game.player.ult.perKill);
    // drop an XP crystal
    const c = game.crystals.spawn();
    c.x = e.x; c.y = e.y; c.r = 5; c.value = 1;
    game.enemies.release(e);
  };

  game.effects = [];
  game.addEffect = function (e) { game.effects.push(e); };

  function startGame() {
    E.seed(Math.floor(Math.random() * 1e9));
    game.rng = E.rng;

    game.map = global.MapGen.generate({ rng: game.rng });
    game.ff = new E.FlowField(game.map);

    game.enemies = new global.Entities.Pool(global.Entities.newEnemy);
    game.projectiles = new global.Entities.Pool(global.Entities.newProjectile);
    game.crystals = new global.Entities.Pool(global.Entities.newCrystal);
    game.enemyHash = new E.SpatialHash(56);

    const p = global.Entities.createPlayer();
    p.x = game.map.spawn.x; p.y = game.map.spawn.y;
    p.weapons = [{ def: global.WEAPONS.pulse, timer: 0 }];
    game.player = p;

    game.timeSec = 0; game.spawnTimer = 0.5; game.ffTimer = 0; game.kills = 0;
    game.effects = [];
    game.upgradeLevels = {};
    game.pendingLevels = 0;
    game._choices = null;
    global.UI.layoutButtons(game);
    E.paused = false;
    game.phase = 'PLAYING';

    // initial flow field toward spawn
    const st = game.map.tileAtWorld(p.x, p.y);
    game.ff.compute(st.tx, st.ty);

    E.camera.x = p.x; E.camera.y = p.y;

    document.getElementById('menu').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');

    if (!E.running) E.start(update, render);
  }

  function gameOver() {
    game.phase = 'GAME_OVER';
    E.stop();
    const menu = document.getElementById('menu');
    document.getElementById('hud').classList.add('hidden');
    menu.querySelector('h1').textContent = 'SHIP LOST';
    menu.querySelector('.tagline').textContent =
      `You survived ${formatTime(game.timeSec)} and downed ${game.kills} hostiles.`;
    document.getElementById('start-btn').textContent = 'RELAUNCH';
    menu.classList.remove('hidden');
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  /* ---------------- main loop ---------------- */
  function update(dt) {
    if (game.phase !== 'PLAYING') return;
    const p = game.player, map = game.map;
    game.timeSec += dt;

    // flow field recompute toward player (throttled)
    game.ffTimer -= dt;
    if (game.ffTimer <= 0) {
      game.ffTimer = 0.2;
      const st = map.tileAtWorld(p.x, p.y);
      game.ff.compute(st.tx, st.ty);
    }

    // rebuild enemy spatial hash
    game.enemyHash.clear();
    const elist = game.enemies.active;
    for (let i = 0; i < elist.length; i++) game.enemyHash.insert(elist[i]);

    // ability buttons layout (keeps tap regions current after resize)
    global.UI.layoutButtons(game);

    // player movement (per-axis wall collision)
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.regen > 0 && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    const mv = E.input.moveVector();
    if (mv.x !== 0 || mv.y !== 0) { p.facingX = mv.x; p.facingY = mv.y; }
    const step = p.speed * p.stats.speedMult * dt;
    const nx = p.x + mv.x * step;
    if (!game.hitsWall(nx, p.y, p.r)) p.x = nx;
    const ny = p.y + mv.y * step;
    if (!game.hitsWall(p.x, ny, p.r)) p.y = ny;

    // abilities (Blink / Ultimate from taps + keys)
    global.Abilities.update(game, dt);

    // weapons + projectiles
    global.Weapons.fireAll(game, dt);
    global.Weapons.updateProjectiles(game, dt);

    // enemies
    global.Enemies.updateMovement(game, dt);
    global.Enemies.updateSpawning(game, dt);

    // crystal magnet/pickup → leveling
    updateCrystals(game, dt);
    if (game.pendingLevels > 0) global.UI.openLevelUp(game);

    // age visual effects
    const fx = game.effects;
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }

    // camera follow (clamped to map)
    const halfW = E.width / 2, halfH = E.height / 2;
    E.camera.x = map.worldW > E.width ? E.clamp(p.x, halfW, map.worldW - halfW) : map.worldW / 2;
    E.camera.y = map.worldH > E.height ? E.clamp(p.y, halfH, map.worldH - halfH) : map.worldH / 2;

    // HUD
    document.getElementById('hud-timer').textContent = formatTime(game.timeSec);
    game._fps += ((1 / Math.max(dt, 1e-4)) - game._fps) * 0.1;
    document.getElementById('hud-debug').textContent =
      `LV ${p.level}  ·  ${game.enemies.count} hostiles  ·  ${game.kills} kills  ·  ${Math.round(game._fps)} fps`;

    if (p.hp <= 0) { p.hp = 0; gameOver(); }
  }

  // pull crystals within magnet radius toward the player; collect on contact; queue level-ups
  function updateCrystals(game, dt) {
    const p = game.player, list = game.crystals.active;
    const mag2 = p.magnet * p.magnet;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < mag2) {
        const d = Math.sqrt(d2) || 1;
        const pull = 200 + (1 - d / p.magnet) * 260; // accelerate as it nears
        c.x += dx / d * pull * dt; c.y += dy / d * pull * dt;
      }
      if (d2 < (p.r + c.r + 4) * (p.r + c.r + 4)) {
        p.xp += c.value;
        while (p.xp >= p.xpNext) {
          p.xp -= p.xpNext; p.level++;
          p.xpNext = Math.floor(p.xpNext * 1.35 + 2);
          game.pendingLevels++;
        }
        game.crystals.release(c);
      }
    }
  }

  function render() { global.Render.draw(game); }

  /* ---------------- boot ---------------- */
  function boot() {
    E.initCanvas(document.getElementById('game'));
    const v = document.querySelector('#menu .version');
    if (v) v.textContent = 'v' + (global.GAME_VERSION || '0.0.0');
    document.getElementById('start-btn').addEventListener('click', startGame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.startGame = startGame;
})(typeof window !== 'undefined' ? window : globalThis);
