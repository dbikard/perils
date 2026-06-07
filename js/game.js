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
    if (global.Particles) global.Particles.burst(game, e.x, e.y, e.color || '#ff5a6e', e.boss ? 26 : 6, e.boss ? 230 : 150);
    if (global.SFX) global.SFX.kill();
    if (e.boss) E.shake(11);
    // drop an XP crystal
    const c = game.crystals.spawn();
    c.x = e.x; c.y = e.y; c.r = 5; c.value = 1;
    game.enemies.release(e);
  };

  game.effects = [];
  game.addEffect = function (e) { game.effects.push(e); };
  game.announce = function (text, dur) { game.banner = { text, life: dur || 2.5 }; };

  // apply damage to the player, reduced by armour tier (capped); respects i-frames
  game.damagePlayer = function (amount) {
    const p = game.player;
    if (p.invuln > 0) return;
    const reduction = Math.min(0.6, p.armor * 0.07);
    p.hp -= amount * (1 - reduction);
    p.hitFlash = 0.12;
    if (global.SFX) global.SFX.hurt();           // throttled internally
    if (amount >= 2) E.shake(4);                  // discrete hits (bolts/spikes), not melee tick
  };

  const WARP_TIME = 300; // seconds of siege before the warp drive is ready (tunable)

  function startGame() {
    E.seed(Math.floor(Math.random() * 1e9));
    game.rng = E.rng;

    game.map = global.MapGen.generate({ rng: game.rng });
    game.ff = new E.FlowField(game.map);

    game.enemies = new global.Entities.Pool(global.Entities.newEnemy);
    game.projectiles = new global.Entities.Pool(global.Entities.newProjectile);
    game.enemyProjectiles = new global.Entities.Pool(global.Entities.newEnemyProjectile);
    game.mines = new global.Entities.Pool(global.Entities.newMine);
    game.crystals = new global.Entities.Pool(global.Entities.newCrystal);
    game.enemyHash = new E.SpatialHash(56);
    game.sentries = [];

    const p = global.Entities.createPlayer();
    p.x = game.map.spawn.x; p.y = game.map.spawn.y;
    game.player = p;
    global.Weapons.acquire(game, 'pulse'); // starting weapon

    game.timeSec = 0; game.spawnTimer = 0.5; game.ffTimer = 0; game.kills = 0;
    game.warp = 0; game.bossTimer = 120; game.enemySlow = 0; game.banner = null;
    game.effects = [];
    game.particles = [];
    if (global.SFX) { global.SFX.init(); global.SFX.resume(); }
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
    if (global.SFX) global.SFX.over();
    E.stop();
    const menu = document.getElementById('menu');
    document.getElementById('hud').classList.add('hidden');
    menu.querySelector('h1').textContent = 'SHIP LOST';
    menu.querySelector('.tagline').textContent =
      `You survived ${formatTime(game.timeSec)} and downed ${game.kills} hostiles.`;
    document.getElementById('start-btn').textContent = 'RELAUNCH';
    menu.classList.remove('hidden');
  }

  function victory() {
    game.phase = 'VICTORY';
    if (global.SFX) global.SFX.victory();
    E.stop();
    const menu = document.getElementById('menu');
    document.getElementById('hud').classList.add('hidden');
    menu.querySelector('h1').textContent = 'ESCAPED';
    menu.querySelector('.tagline').textContent =
      `You fled the wreck in ${formatTime(game.timeSec)} — ${game.kills} hostiles down. The Vessel is behind you.`;
    document.getElementById('start-btn').textContent = 'RUN AGAIN';
    menu.classList.remove('hidden');
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  /* ---------------- main loop ---------------- */
  function update(dt) {
    if (game.phase !== 'PLAYING' && game.phase !== 'ESCAPE') return;
    const p = game.player, map = game.map;
    game.timeSec += dt;

    // warp drive charges during the siege; when full, the run flips to the escape
    if (game.phase === 'PLAYING') {
      game.warp += dt / WARP_TIME;
      if (game.warp >= 1) { game.warp = 1; game.phase = 'ESCAPE'; game.announce('WARP DRIVE ONLINE — REACH THE AIRLOCK', 3.5); }
    }
    if (game.enemySlow > 0) game.enemySlow -= dt;
    if (game.banner && game.banner.life > 0) game.banner.life -= dt;

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
    p.moving = (mv.x !== 0 || mv.y !== 0);
    if (p.moving) {
      p.facingX = mv.x; p.facingY = mv.y;
      if (mv.x !== 0) p.faceLeft = mv.x < 0;
      p.animTime += dt;
    }
    const step = p.speed * p.stats.speedMult * dt;
    const nx = p.x + mv.x * step;
    if (!game.hitsWall(nx, p.y, p.r)) p.x = nx;
    const ny = p.y + mv.y * step;
    if (!game.hitsWall(p.x, ny, p.r)) p.y = ny;

    // abilities (Blink / Ultimate from taps + keys)
    global.Abilities.update(game, dt);

    // weapons + projectiles + mines
    global.Weapons.update(game, dt);
    global.Weapons.updateProjectiles(game, dt);
    global.Weapons.updateMines(game, dt);

    // enemies
    global.Enemies.updateMovement(game, dt);
    global.Enemies.updateEnemyProjectiles(game, dt);
    global.Enemies.updateSpawning(game, dt);

    // escape: reaching the airlock wins the run
    if (game.phase === 'ESCAPE') {
      const ex = map.exit, rr = p.r + 30;
      if ((p.x - ex.x) * (p.x - ex.x) + (p.y - ex.y) * (p.y - ex.y) < rr * rr) { victory(); return; }
    }

    // crystal magnet/pickup → leveling
    updateCrystals(game, dt);
    if (game.pendingLevels > 0) { if (global.SFX) global.SFX.level(); global.UI.openLevelUp(game); }

    // age visual effects + particles + screen shake
    const fx = game.effects;
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
    if (global.Particles) global.Particles.update(game, dt);
    if (E.shakeTime > 0) { E.shakeTime -= dt; E.shakeMag *= 0.86; if (E.shakeTime <= 0) E.shakeMag = 0; }

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
        if (global.Particles) global.Particles.sparkle(game, c.x, c.y, '#54ff9f');
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
    global.Sprites.load();
    const v = document.querySelector('#menu .version');
    if (v) v.textContent = 'v' + (global.GAME_VERSION || '0.0.0');
    document.getElementById('start-btn').addEventListener('click', startGame);

    // audio unlock on first gesture
    global.addEventListener('pointerdown', () => { if (global.SFX) { global.SFX.init(); global.SFX.resume(); } }, { once: true });
    // mute toggle (button + M key)
    const mute = document.getElementById('mute');
    const sync = (m) => { if (mute) mute.textContent = m ? '🔇' : '🔊'; };
    if (mute) mute.addEventListener('click', (ev) => { ev.stopPropagation(); sync(global.SFX ? global.SFX.toggle() : true); });
    global.addEventListener('keydown', (e) => { if (e.key && e.key.toLowerCase() === 'm' && global.SFX) sync(global.SFX.toggle()); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.startGame = startGame;
})(typeof window !== 'undefined' ? window : globalThis);
