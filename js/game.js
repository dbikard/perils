/* game.js — run lifecycle + main update/render wiring (orchestrates all systems). */
(function (global) {
  'use strict';
  const E = global.Engine;
  const hasDOM = typeof document !== 'undefined';

  const game = {
    phase: 'MENU',          // MENU | PLAYING | GAME_OVER (ESCAPE/VICTORY in Phase 2)
    map: null, ff: null, rng: null,
    player: null,
    enemies: null, projectiles: null, crystals: null, pickups: null,
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
    // drop an XP crystal worth the enemy's bounty (big foes = big payouts).
    // Past a soft cap, fold the value into an existing crystal instead of spawning more.
    const value = e.xpValue || 1;
    if (game.crystals.count >= 350) {
      const list = game.crystals.active;
      const c = list[Math.floor(game.rng() * list.length)];
      c.value += value; c.r = crystalRadius(c.value);
    } else {
      const c = game.crystals.spawn();
      c.x = e.x; c.y = e.y; c.value = value; c.r = crystalRadius(value);
    }
    // occasionally drop a healing pack — bosses/elites always, others rarely
    if (e.boss || e.elite || game.rng() < 0.025) {
      const hp = game.pickups.spawn();
      hp.x = e.x; hp.y = e.y; hp.r = 9; hp.kind = 'heal';
      hp.heal = e.boss ? 45 : 25; hp.life = 18;
    }
    game.enemies.release(e);
  };

  function crystalRadius(value) { return Math.min(11, 4 + Math.sqrt(value) * 1.4); }

  game.effects = [];
  game.addEffect = function (e) { game.effects.push(e); };
  game.announce = function (text, dur, color) { game.banner = { text, life: dur || 2.5, color }; };

  // apply damage to a player, reduced by armour tier (capped); respects i-frames
  game.damagePlayer = function (p, amount) {
    if (p.dead || p.invuln > 0) return;
    const reduction = Math.min(0.6, p.armor * 0.07);
    p.hp -= amount * (1 - reduction);
    p.hitFlash = 0.12;
    if (p === game.localPlayer) {
      if (global.SFX) global.SFX.hurt();         // throttled internally
      if (amount >= 2) E.shake(4);                // discrete hits (bolts/spikes), not melee tick
    }
  };

  const WARP_TIME = 300;     // default siege length (stages can override)
  const EXIT_HOLD_TIME = 6;  // seconds the exit pad must be held while it cycles

  /* ---------------- stages (story + map + mechanics) ---------------- */
  const STAGES = {
    1: {
      id: 1, name: 'THE VESSEL', next: 2, warpTime: 300,
      map: { cols: 72, rows: 52, rooms: 14 },
      theme: { floor: '#0b1422', edge: 'rgba(56,232,255,0.55)', grid: 'rgba(56,232,255,0.06)' },
      caches: 3, vents: 0, wraiths: false, rateMult: 1,
      survivors: [{ name: 'DR. LIN' }],
      exitLabel: 'AIRLOCK',
      warpText: 'WARP DRIVE ONLINE — REACH THE AIRLOCK',
      intro: 'The ship is lost. Survive until the warp drive charges — then run.',
      victoryText: (g) => `You blow the airlock and dock at Helios Station${crewText(g)}. But the station is dark…`,
      comms: [
        { t: 6,   text: '📡 …all decks breached. They are in the vents.' },
        { t: 40,  text: '📡 DR. LIN: “Is anyone alive? I’m sealed in. Find me.”' },
        { t: 120, text: '📡 SHIP AI: armament caches unlocked — check your map' },
        { t: 200, text: '📡 SHIP AI: warp drive past two-thirds charge' }
      ]
    },
    2: {
      id: 2, name: 'HELIOS STATION', next: null, warpTime: 300,
      map: { cols: 86, rows: 62, rooms: 18, roomMin: 5, roomMax: 13 },
      theme: { floor: '#140f1f', edge: 'rgba(196,142,255,0.55)', grid: 'rgba(196,142,255,0.06)' },
      caches: 4, vents: 12, wraiths: true, rateMult: 1.1, hpMult: 1.5,
      survivors: [{ name: 'CHIEF VANCE' }, { name: 'SPC. OKAFOR' }],
      exitLabel: 'SHUTTLE',
      warpText: 'SHUTTLE PREFLIGHT COMPLETE — REACH THE DOCK',
      intro: 'Helios Station is silent. Hull breaches vent to space, and something walks through walls. Find the crew. Reach the shuttle.',
      victoryText: (g) => `The shuttle tears free of Helios${crewText(g)}. Whatever owns the dark out here — it’s still hungry.`,
      comms: [
        { t: 6,   text: '📡 STATION LOG: day 41 — the walls are not holding them anymore' },
        { t: 35,  text: '📡 CHIEF VANCE: “Reactor deck. The breaches vent on a cycle — time your runs.”' },
        { t: 90,  text: '📡 SPC. OKAFOR: “They phase through bulkheads. Nowhere is sealed. Hurry.”' },
        { t: 210, text: '📡 STATION AI: shuttle preflight at two-thirds' }
      ]
    }
  };
  function crewText(g) {
    const saved = (g.survivors || []).filter(s => s.state === 'following').map(s => s.name);
    return saved.length ? ` with ${saved.join(' and ')} aboard` : ', alone';
  }

  /* scatter caches / survivors / vents across the ship by walk distance from
   * spawn — the good stuff lives in the far rooms (exploration pays) */
  function placeFeatures(game, def) {
    const map = game.map, rng = game.rng;
    const st = map.tileAtWorld(map.spawn.x, map.spawn.y);
    const bfs = global.MapGen.bfsFrom(map, st.tx, st.ty);
    const maxD = Math.max(1, bfs.farD);
    const pickAt = (loD, hiD, avoid, minSep) => {
      for (let tries = 0; tries < 80; tries++) {
        const t = map.randomFloorTile(rng);
        const d = bfs.dist[t.ty * map.cols + t.tx];
        if (d < loD * maxD || d > hiD * maxD) continue;
        const w = map.tileCenterWorld(t.tx, t.ty);
        if (Math.abs(t.tx - map.exit.tx) + Math.abs(t.ty - map.exit.ty) < 4) continue;
        if (avoid.some(a => (a.x - w.x) * (a.x - w.x) + (a.y - w.y) * (a.y - w.y) < minSep * minSep)) continue;
        return w;
      }
      return null;
    };
    game.caches = [];
    for (let i = 0; i < def.caches; i++) {
      const w = pickAt(0.4, 0.85, game.caches, 320);
      if (w) game.caches.push({ x: w.x, y: w.y, taken: false });
    }
    game.survivors = [];
    for (const s of def.survivors) {
      const w = pickAt(0.45, 0.9, game.caches.concat(game.survivors), 280);
      if (w) game.survivors.push({ name: s.name, x: w.x, y: w.y, r: 12, hp: 70, maxHp: 70,
        state: 'waiting', fire: 0, found: false });
    }
    game.vents = [];
    for (let i = 0; i < def.vents; i++) {
      const w = pickAt(0.1, 0.95, game.vents, 230);
      if (w) game.vents.push({ x: w.x, y: w.y, phase: 'idle', timer: 3 + rng() * 7 });
    }
  }

  function startGame(opts) {
    const seed = (opts && typeof opts.seed === 'number') ? opts.seed : Math.floor(Math.random() * 1e9);
    E.seed(seed);
    game.seed = seed;
    game.rng = E.rng;
    game.stage = (opts && opts.stage) || game.menuStage || 1;
    game.stageDef = STAGES[game.stage] || STAGES[1];

    game.map = global.MapGen.generate(Object.assign({ rng: game.rng }, game.stageDef.map));
    game.map.theme = game.stageDef.theme;
    game.ff = new E.FlowField(game.map);

    game.enemies = new global.Entities.Pool(global.Entities.newEnemy);
    game.projectiles = new global.Entities.Pool(global.Entities.newProjectile);
    game.enemyProjectiles = new global.Entities.Pool(global.Entities.newEnemyProjectile);
    game.mines = new global.Entities.Pool(global.Entities.newMine);
    game.crystals = new global.Entities.Pool(global.Entities.newCrystal);
    game.pickups = new global.Entities.Pool(global.Entities.newPickup);
    game.enemyHash = new E.SpatialHash(56);
    game.sentries = [];

    // players: solo = 1; LAN co-op = 2 (lockstep-synced, identical on both peers)
    game.mp = !!(opts && opts.mp);
    const numPlayers = game.mp ? 2 : 1;
    game.players = [];
    for (let i = 0; i < numPlayers; i++) {
      const pl = global.Entities.createPlayer(i);
      pl.x = game.map.spawn.x + i * 26; pl.y = game.map.spawn.y;
      game.players.push(pl);
      global.Weapons.acquire(game, 'pulse', pl); // starting weapon
    }
    const p = game.players[0];
    game.player = p; // player 0 alias (sim + single-player paths)
    game.localPlayer = game.players[game.mp && global.Net ? global.Net.localIdx : 0];
    game.ff2 = numPlayers > 1 ? new E.FlowField(game.map) : null;
    // virtual view used by gameplay rules (ult radius, spawn ring) — fixed in
    // co-op so different screen sizes can't desync or change difficulty
    game.viewW = game.mp ? 390 : E.width;
    game.viewH = game.mp ? 700 : E.height;
    game.tick = 0;
    game.inputs = [null, null];
    game.choiceQueues = [[], []];
    game._mpModalOpen = false; game._localPick = -1; game._desyncWarned = false;
    if (game.mp && global.Net) global.Net.resetRun();

    game.timeSec = 0; game.spawnTimer = 0.5; game.ffTimer = 0; game.kills = 0;
    game.warp = 0; game.bossTimer = 150; game.enemySlow = 0; game.banner = null;
    game.exitHold = 0; game.slams = []; game.commsIdx = 0;
    placeFeatures(game, game.stageDef);
    game.effects = [];
    game.particles = [];
    if (global.SFX) { global.SFX.init(); global.SFX.resume(); }
    game.pendingLevels = 0;
    game._choices = null;
    if (global.UI) global.UI.layoutButtons(game);
    E.paused = false;
    game.phase = 'PLAYING';

    // initial flow field toward spawn
    const st = game.map.tileAtWorld(p.x, p.y);
    game.ff.compute(st.tx, st.ty);
    if (game.ff2) game.ff2.compute(st.tx, st.ty);

    E.camera.x = p.x; E.camera.y = p.y;

    if (hasDOM) {
      document.getElementById('menu').classList.add('hidden');
      document.getElementById('hud').classList.remove('hidden');
      if (!E.running) E.start(update, render);
    }
  }

  function gameOver() {
    game.phase = 'GAME_OVER';
    if (global.SFX) global.SFX.over();
    E.stop();
    if (!hasDOM) return;
    const rec = global.Meta ? global.Meta.record(game, false) : null;
    const menu = document.getElementById('menu');
    document.getElementById('hud').classList.add('hidden');
    menu.querySelector('h1').textContent = (rec && rec.newBestTime) ? 'NEW RECORD' : 'YOU FELL';
    menu.querySelector('.tagline').textContent =
      `${game.stageDef.name}: you survived ${formatTime(game.timeSec)} and downed ${game.kills} hostiles.`
      + ((rec && rec.newBestTime) ? ' Personal best!' : '');
    document.getElementById('start-btn').textContent = 'RELAUNCH';
    if (global.Meta) global.Meta.renderMenuStats();
    menu.classList.remove('hidden');
  }

  function victory() {
    game.phase = 'VICTORY';
    if (global.SFX) global.SFX.victory();
    E.stop();
    if (!hasDOM) return;
    const rec = global.Meta ? global.Meta.record(game, true) : null;
    const menu = document.getElementById('menu');
    document.getElementById('hud').classList.add('hidden');
    menu.querySelector('h1').textContent = (rec && rec.firstEscape) ? 'FIRST ESCAPE' : 'ESCAPED';
    menu.querySelector('.tagline').textContent =
      `${formatTime(game.timeSec)} — ${game.kills} hostiles down. ` + game.stageDef.victoryText(game);
    const next = game.stageDef.next;
    if (next && global.Meta && global.Meta.unlockedStage(next)) {
      game.menuStage = next;
      document.getElementById('start-btn').textContent = `CONTINUE → ${STAGES[next].name}`;
    } else {
      document.getElementById('start-btn').textContent = 'RUN AGAIN';
    }
    if (global.Meta) global.Meta.renderMenuStats();
    menu.classList.remove('hidden');
  }

  function formatTime(s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  }

  /* ---------------- input providers ---------------- */
  // one place reads the DOM input; the sim reads E.input too, so bots Just Work
  function captureLocal() {
    const mv = E.input.moveVector();
    let b = 0;
    for (const t of E.input.consumeTaps()) {
      if (t === 'blink') b |= 1; else if (t === 'special') b |= 2; else if (t === 'ultimate') b |= 4;
    }
    for (const k of E.input.consumeKeyTaps()) {
      if (k === ' ') b |= 1; else if (k === 'q') b |= 2; else if (k === 'e' || k === 'enter') b |= 4;
    }
    const pk = game._localPick; game._localPick = -1;
    return { mx: mv.x, my: mv.y, b, pk };
  }
  function toInput(rec) {
    return { mx: rec.mx, my: rec.my, blink: !!(rec.b & 1), special: !!(rec.b & 2),
      ult: !!(rec.b & 4), pick: rec.pk == null ? -1 : rec.pk };
  }

  // a queued level-up/cache pick lands here at its lockstep tick (both peers)
  function applyPick(i, idx) {
    const item = game.choiceQueues[i].shift();
    if (!item) return;
    const choice = item.choices[idx] || item.choices[0];
    global.Upgrades.applyChoice(game, choice, game.players[i]);
  }

  // FNV-style state digest exchanged between peers to detect desync
  function stateHash() {
    let h = 0x811c9dc5 >>> 0;
    const mix = (v) => { h = (h ^ (v | 0)) >>> 0; h = Math.imul(h, 16777619) >>> 0; };
    for (const pl of game.players) { mix(Math.round(pl.x * 8)); mix(Math.round(pl.y * 8)); mix(Math.round(pl.hp * 4)); mix(pl.level); }
    mix(game.enemies.count); mix(game.kills);
    mix(game.rng.getState ? game.rng.getState() : 0);
    return h;
  }

  /* ---------------- main loop ---------------- */
  function update(dt) {
    if (game.phase !== 'PLAYING' && game.phase !== 'ESCAPE') return;
    if (game.mp && global.Net) {
      const Net = global.Net;
      Net.scheduleLocal(game.tick, captureLocal());
      if (!Net.ready(game.tick)) return; // lockstep stall: wait for peer input
      for (let i = 0; i < 2; i++) {
        const inp = toInput(Net.get(game.tick, i));
        game.inputs[i] = inp;
        if (inp.pick >= 0) applyPick(i, inp.pick);
      }
      Net.gc(game.tick);
      simUpdate(dt);
      game.tick++;
      if (game.tick % 120 === 0) Net.checkSync(game.tick, stateHash());
      if (Net.desync && !game._desyncWarned) {
        game._desyncWarned = true;
        game.announce('⚠ SYNC LOST — runs have diverged', 5);
      }
    } else {
      game.inputs[0] = toInput(captureLocal());
      simUpdate(dt);
      game.tick++;
    }
  }

  function simUpdate(dt) {
    const map = game.map;
    game.timeSec += dt;

    // warp drive charges during the siege; when full, the run flips to the escape
    if (game.phase === 'PLAYING') {
      game.warp += dt / (game.stageDef.warpTime || WARP_TIME);
      if (game.warp >= 1) {
        game.warp = 1; game.phase = 'ESCAPE';
        game.announce(game.stageDef.warpText, 3.5);
        global.Enemies.burst(game, 14); // the ship knows you're leaving
      }
    }

    // story beats over the comms
    const comms = game.stageDef.comms;
    while (game.commsIdx < comms.length && comms[game.commsIdx].t <= game.timeSec) {
      game.announce(comms[game.commsIdx].text, 4, '#7fd8ff');
      game.commsIdx++;
    }
    if (game.enemySlow > 0) game.enemySlow -= dt;
    if (game.banner && game.banner.life > 0) game.banner.life -= dt;

    // flow field recompute toward each player (throttled)
    game.ffTimer -= dt;
    if (game.ffTimer <= 0) {
      game.ffTimer = 0.2;
      const p0 = game.players[0].dead && game.players[1] ? game.players[1] : game.players[0];
      const st = map.tileAtWorld(p0.x, p0.y);
      game.ff.compute(st.tx, st.ty);
      if (game.ff2 && game.players[1]) {
        const p1 = game.players[1].dead ? p0 : game.players[1];
        const st1 = map.tileAtWorld(p1.x, p1.y);
        game.ff2.compute(st1.tx, st1.ty);
      }
    }

    // rebuild enemy spatial hash
    game.enemyHash.clear();
    const elist = game.enemies.active;
    for (let i = 0; i < elist.length; i++) game.enemyHash.insert(elist[i]);

    // ability buttons layout (keeps tap regions current after resize)
    if (global.UI) global.UI.layoutButtons(game);

    // player movement (per-axis wall collision), per player from its input slot
    for (const pl of game.players) {
      if (pl.hitFlash > 0) pl.hitFlash -= dt;
      if (pl.invuln > 0) pl.invuln -= dt;
      if (pl.dead) {
        // co-op: fallen players are recovered by their partner after a delay
        if (pl.respawn > 0) {
          pl.respawn -= dt;
          const mate = game.players[1 - pl.idx];
          if (pl.respawn <= 0 && mate && !mate.dead) {
            pl.dead = false; pl.hp = pl.maxHp * 0.5; pl.invuln = 2;
            pl.x = mate.x; pl.y = mate.y;
            game.announce(`${pl.idx === 0 ? 'ACE' : 'NOVA'} BACK IN THE FIGHT`, 2.5, '#7fd8ff');
          }
        }
        continue;
      }
      if (pl.regen > 0 && pl.hp > 0) pl.hp = Math.min(pl.maxHp, pl.hp + pl.regen * dt);
      const inp = game.inputs[pl.idx] || { mx: 0, my: 0 };
      pl.moving = (inp.mx !== 0 || inp.my !== 0);
      if (pl.moving) {
        pl.facingX = inp.mx; pl.facingY = inp.my;
        if (inp.mx !== 0) pl.faceLeft = inp.mx < 0;
        pl.animTime += dt;
      }
      const step = pl.speed * pl.stats.speedMult * dt;
      const nx = pl.x + inp.mx * step;
      if (!game.hitsWall(nx, pl.y, pl.r)) pl.x = nx;
      const ny = pl.y + inp.my * step;
      if (!game.hitsWall(pl.x, ny, pl.r)) pl.y = ny;
    }

    // abilities (Blink / Ultimate from taps + keys)
    global.Abilities.update(game, dt);

    // weapons + projectiles + mines
    global.Weapons.update(game, dt);
    global.Weapons.updateProjectiles(game, dt);
    global.Weapons.updateMines(game, dt);

    // enemies
    global.Enemies.updateMovement(game, dt);
    global.Enemies.updateEnemyProjectiles(game, dt);
    global.Enemies.updateSlams(game, dt);
    global.Enemies.updateSpawning(game, dt);

    // escape: hold the airlock pad while it cycles — the final stand
    if (game.phase === 'ESCAPE') {
      const ex = map.exit;
      let onPad = false;
      for (const pl of game.players) {
        if (pl.dead) continue;
        const rr = pl.r + 34;
        if ((pl.x - ex.x) * (pl.x - ex.x) + (pl.y - ex.y) * (pl.y - ex.y) < rr * rr) { onPad = true; break; }
      }
      if (onPad) {
        if (game.exitHold === 0) {
          game.announce('AIRLOCK CYCLING — HOLD POSITION', 2.5);
          global.Enemies.burst(game, 8); // everything converges on the breach
        }
        game.exitHold += dt;
        if (game.exitHold >= EXIT_HOLD_TIME) { victory(); return; }
      } else if (game.exitHold > 0) {
        game.exitHold = Math.max(0, game.exitHold - dt * 0.5);
      }
    }

    // crystal magnet/pickup → leveling
    updateCrystals(game, dt);
    updatePickups(game, dt);
    updateCaches(game);
    updateSurvivors(game, dt);
    updateVents(game, dt);
    // level-ups: solo pauses into the pick modal; co-op queues choices and the
    // owning player picks without pausing (the pick syncs via lockstep input)
    if (!game.mp) {
      if (game.players[0].pendingLevels > 0) {
        game.pendingLevels = game.players[0].pendingLevels;
        if (global.SFX) global.SFX.level();
        global.UI.openLevelUp(game);
      }
    } else {
      for (const pl of game.players) {
        while (pl.pendingLevels > 0) {
          pl.pendingLevels--;
          game.choiceQueues[pl.idx].push({ kind: 'level', choices: global.Upgrades.generateChoices(game, 3, pl) });
        }
      }
      const li = global.Net ? global.Net.localIdx : 0;
      const q = game.choiceQueues[li];
      if (q.length && !game._mpModalOpen && global.UI && global.UI.openChoiceMP) {
        game._mpModalOpen = true;
        if (global.SFX) global.SFX.level();
        global.UI.openChoiceMP(game, q[0], (idx) => { game._localPick = idx; game._mpModalOpen = false; });
      }
    }

    // age visual effects + particles + screen shake
    const fx = game.effects;
    for (let i = fx.length - 1; i >= 0; i--) { fx[i].life -= dt; if (fx[i].life <= 0) fx.splice(i, 1); }
    if (global.Particles) global.Particles.update(game, dt);
    if (E.shakeTime > 0) { E.shakeTime -= dt; E.shakeMag *= 0.86; if (E.shakeTime <= 0) E.shakeMag = 0; }

    // camera follows the local player (their partner while they're down)
    let cp = game.localPlayer;
    if (cp.dead && game.players.length > 1 && !game.players[1 - cp.idx].dead) cp = game.players[1 - cp.idx];
    const halfW = E.width / 2, halfH = E.height / 2;
    E.camera.x = map.worldW > E.width ? E.clamp(cp.x, halfW, map.worldW - halfW) : map.worldW / 2;
    E.camera.y = map.worldH > E.height ? E.clamp(cp.y, halfH, map.worldH - halfH) : map.worldH / 2;

    // HUD
    if (hasDOM) {
      document.getElementById('hud-timer').textContent = formatTime(game.timeSec);
      game._fps += ((1 / Math.max(dt, 1e-4)) - game._fps) * 0.1;
      document.getElementById('hud-debug').textContent =
        `LV ${game.localPlayer.level}  ·  ${game.enemies.count} hostiles  ·  ${game.kills} kills  ·  ${Math.round(game._fps)} fps`;
    }

    // deaths: co-op partners can be recovered; the run ends when no one stands
    let anyAlive = false;
    for (const pl of game.players) {
      if (!pl.dead && pl.hp <= 0) {
        pl.hp = 0; pl.dead = true;
        if (game.players.length > 1) {
          pl.respawn = 15;
          game.announce(`${pl.idx === 0 ? 'ACE' : 'NOVA'} IS DOWN — recovery in 15s`, 3);
          if (global.Particles) global.Particles.burst(game, pl.x, pl.y, '#7fd8ff', 20, 220);
        }
      }
      if (!pl.dead) anyAlive = true;
    }
    if (!anyAlive) { gameOver(); }
  }

  // nearest living player to a point (local helper for pickups/features)
  function nearestAlive(game, x, y) {
    let best = null, bestD2 = Infinity;
    for (const pl of game.players) {
      if (pl.dead) continue;
      const d2 = (pl.x - x) * (pl.x - x) + (pl.y - y) * (pl.y - y);
      if (d2 < bestD2) { bestD2 = d2; best = pl; }
    }
    return best;
  }

  // pull crystals within magnet radius toward the nearest player; collecting
  // grants the XP to EVERY player (co-op shares progression, no competition)
  function updateCrystals(game, dt) {
    const list = game.crystals.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const c = list[i];
      const p = nearestAlive(game, c.x, c.y);
      if (!p) return;
      const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < p.magnet * p.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 200 + (1 - d / p.magnet) * 260; // accelerate as it nears
        c.x += dx / d * pull * dt; c.y += dy / d * pull * dt;
      }
      if (d2 < (p.r + c.r + 4) * (p.r + c.r + 4)) {
        if (global.Particles) global.Particles.sparkle(game, c.x, c.y, '#54ff9f');
        for (const pl of game.players) {
          pl.xp += c.value;
          while (pl.xp >= pl.xpNext) {
            pl.xp -= pl.xpNext; pl.level++;
            pl.xpNext = Math.floor(pl.xpNext * 1.27 + 2);
            pl.pendingLevels++;
          }
        }
        game.crystals.release(c);
      }
    }
  }

  // healing packs: gently drawn in by the magnet, expire over time; heal the collector
  function updatePickups(game, dt) {
    const list = game.pickups.active;
    for (let i = list.length - 1; i >= 0; i--) {
      const hp = list[i];
      hp.life -= dt;
      if (hp.life <= 0) { game.pickups.release(hp); continue; }
      const p = nearestAlive(game, hp.x, hp.y);
      if (!p) return;
      const dx = p.x - hp.x, dy = p.y - hp.y, d2 = dx * dx + dy * dy;
      if (d2 < p.magnet * p.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 120 + (1 - d / p.magnet) * 180;
        hp.x += dx / d * pull * dt; hp.y += dy / d * pull * dt;
      }
      if (d2 < (p.r + hp.r + 4) * (p.r + hp.r + 4)) {
        p.hp = Math.min(p.maxHp, p.hp + hp.heal);
        if (global.Particles) global.Particles.sparkle(game, hp.x, hp.y, '#ff6a78');
        if (global.SFX && global.SFX.pickup) global.SFX.pickup();
        game.pickups.release(hp);
      }
    }
  }

  // weapon caches: walk up to one to crack it open and choose a new armament.
  // In co-op the opener gets the pick (queued + lockstep-synced, no pause).
  function updateCaches(game) {
    for (const c of game.caches) {
      if (c.taken) continue;
      let p = null;
      for (const pl of game.players) {
        if (pl.dead) continue;
        const rr = pl.r + 20;
        if ((pl.x - c.x) * (pl.x - c.x) + (pl.y - c.y) * (pl.y - c.y) < rr * rr) { p = pl; break; }
      }
      if (!p) continue;
      c.taken = true;
      if (global.Particles) global.Particles.burst(game, c.x, c.y, '#ffd166', 14, 180);
      const choices = global.Upgrades.generateWeaponChoices(game, 3, p);
      if (!choices.length) {
        // arsenal already full — cache holds field repairs instead
        p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
        game.announce('CACHE: FIELD REPAIRS +40%', 2.5, '#ffd166');
      } else if (game.mp) {
        game.choiceQueues[p.idx].push({ kind: 'cache', choices });
      } else if (global.UI && global.UI.openCache) {
        if (global.SFX) global.SFX.level();
        global.UI.openCache(game, choices);
      }
      return; // one per frame; the solo modal pauses the game anyway
    }
  }

  // survivors: rescue by reaching them; they follow and add fire support —
  // keep them alive and they board with you at the end
  function updateSurvivors(game, dt) {
    const map = game.map;
    for (const s of game.survivors) {
      if (s.state === 'dead') continue;
      const p = nearestAlive(game, s.x, s.y);
      if (!p) return;
      const dx = p.x - s.x, dy = p.y - s.y, d2 = dx * dx + dy * dy;
      if (s.state === 'waiting') {
        if (!s.found && d2 < 460 * 460) { s.found = true; game.announce(`DISTRESS SIGNAL NEARBY — ${s.name}`, 3, '#7fd8ff'); }
        if (d2 < (p.r + s.r + 14) * (p.r + s.r + 14)) {
          s.state = 'following';
          game.announce(`${s.name} RESCUED — FIRE SUPPORT ONLINE`, 3, '#7fd8ff');
          if (global.Particles) global.Particles.burst(game, s.x, s.y, '#7fd8ff', 12, 160);
          if (global.SFX && global.SFX.pickup) global.SFX.pickup();
        }
        continue;
      }
      // following: trail the nearest player using their flow field
      const d = Math.sqrt(d2) || 1;
      if (d > 64) {
        const t = map.tileAtWorld(s.x, s.y);
        const ff = (p.idx === 1 && game.ff2) ? game.ff2 : game.ff;
        let dir = ff.dirAtTile(t.tx, t.ty);
        if (dir.x === 0 && dir.y === 0) dir = { x: dx / d, y: dy / d };
        const sp = 150 * dt;
        const nx = s.x + dir.x * sp; if (!game.hitsWall(nx, s.y, s.r)) s.x = nx;
        const ny = s.y + dir.y * sp; if (!game.hitsWall(s.x, ny, s.r)) s.y = ny;
      }
      // takes contact damage — protect them
      game.enemyHash.queryCircle(s.x, s.y, s.r + 20, (en) => {
        if (!en._active) return;
        const rr = s.r + en.r;
        if ((en.x - s.x) * (en.x - s.x) + (en.y - s.y) * (en.y - s.y) < rr * rr) s.hp -= en.damage * dt * 0.7;
      });
      if (s.hp <= 0) {
        s.state = 'dead';
        game.announce(`${s.name} IS DOWN`, 3);
        if (global.Particles) global.Particles.burst(game, s.x, s.y, '#7fd8ff', 18, 200);
        continue;
      }
      s.hp = Math.min(s.maxHp, s.hp + 1.2 * dt);
      // fire support
      s.fire -= dt;
      if (s.fire <= 0) {
        const tgt = global.Weapons.findNearestEnemy(game, s.x, s.y, 300, true);
        if (tgt) {
          s.fire = 0.8;
          const tdx = tgt.x - s.x, tdy = tgt.y - s.y, tl = Math.hypot(tdx, tdy) || 1;
          const pr = game.projectiles.spawn();
          pr.x = s.x; pr.y = s.y; pr.vx = tdx / tl * 420; pr.vy = tdy / tl * 420;
          pr.r = 4; pr.damage = 12 * (1 + game.timeSec * 0.002); pr.life = 1.0; pr.pierce = 0; pr.color = '#7fd8ff';
        } else s.fire = 0.2;
      }
    }
  }

  // hull-breach vents (stage 2): cycle idle → warn → venting; while venting they
  // drag the player toward the breach and shred anything pressed against it
  function updateVents(game, dt) {
    for (const v of game.vents) {
      v.timer -= dt;
      if (v.phase === 'idle') {
        if (v.timer <= 0) { v.phase = 'warn'; v.timer = 1.2; }
      } else if (v.phase === 'warn') {
        if (v.timer <= 0) { v.phase = 'venting'; v.timer = 2.6; if (global.SFX && global.SFX.boss) global.SFX.boss(); }
      } else { // venting
        if (v.timer <= 0) { v.phase = 'idle'; v.timer = 5 + game.rng() * 6; continue; }
        for (const p of game.players) {
          if (p.dead) continue;
          const dx = v.x - p.x, dy = v.y - p.y, d = Math.hypot(dx, dy);
          if (d < 130 && d > 1) {
            const pull = 170 * (1 - d / 130) * dt;
            const nx = p.x + dx / d * pull; if (!game.hitsWall(nx, p.y, p.r)) p.x = nx;
            const ny = p.y + dy / d * pull; if (!game.hitsWall(p.x, ny, p.r)) p.y = ny;
            if (d < 38) game.damagePlayer(p, 16 * dt);
          }
        }
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
    document.getElementById('start-btn').addEventListener('click', () => {
      const Net = global.Net;
      if (Net && Net.active) {
        if (!Net.isHost) return; // guest launches when the host does
        const seed = Math.floor(Math.random() * 1e9), stage = game.menuStage || 1;
        Net.send({ t: 'start', seed, stage });
        startGame({ seed, stage, mp: true });
      } else {
        startGame();
      }
    });
    setupCoopMenu();

    // stage selector
    game.menuStage = 1;
    const tagline = document.querySelector('#menu .tagline');
    document.querySelectorAll('.stage-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.stage, 10);
        if (global.Meta && !global.Meta.unlockedStage(n)) return;
        game.menuStage = n;
        if (tagline) tagline.textContent = STAGES[n].intro;
        document.getElementById('start-btn').textContent = 'LAUNCH';
        if (global.Meta) global.Meta.renderMenuStats();
      });
    });
    if (global.Meta) global.Meta.renderMenuStats();

    // audio unlock on first gesture
    global.addEventListener('pointerdown', () => { if (global.SFX) { global.SFX.init(); global.SFX.resume(); } }, { once: true });
    // mute toggle (button + M key)
    const mute = document.getElementById('mute');
    const sync = (m) => { if (mute) mute.textContent = m ? '🔇' : '🔊'; };
    if (mute) mute.addEventListener('click', (ev) => { ev.stopPropagation(); sync(global.SFX ? global.SFX.toggle() : true); });
    global.addEventListener('keydown', (e) => { if (e.key && e.key.toLowerCase() === 'm' && global.SFX) sync(global.SFX.toggle()); });
  }

  /* co-op lobby: serverless WebRTC handshake via copy-paste link codes */
  function setupCoopMenu() {
    const Net = global.Net;
    if (!Net || typeof RTCPeerConnection === 'undefined') return;
    const $ = (id) => document.getElementById(id);
    const panel = $('coop-panel'), status = $('coop-status');
    const out = $('coop-out'), inp = $('coop-in');
    const say = (s) => { if (status) status.textContent = s; };
    let role = null;

    $('coop-toggle').addEventListener('click', () => panel.classList.toggle('hidden'));
    $('coop-host').addEventListener('click', async () => {
      role = 'host'; say('creating link code…');
      try {
        out.value = await Net.host();
        say('1) send this code to your partner  2) paste their reply below  3) ACCEPT');
      } catch (e) { say('failed: ' + e.message); }
    });
    $('coop-join').addEventListener('click', () => {
      role = 'join';
      say('paste the host code below, then ACCEPT');
    });
    $('coop-accept').addEventListener('click', async () => {
      const code = inp.value.trim();
      if (!code) { say('paste a code first'); return; }
      try {
        if (role === 'join') {
          say('connecting…');
          out.value = await Net.join(code);
          say('send this reply code back to the host — connecting…');
        } else if (role === 'host') {
          say('connecting…');
          await Net.acceptAnswer(code);
        } else say('choose HOST or JOIN first');
      } catch (e) { say('bad code: ' + e.message); }
    });
    $('coop-copy').addEventListener('click', () => {
      if (out.value && navigator.clipboard) navigator.clipboard.writeText(out.value);
    });

    Net.onOpen = () => {
      say(Net.isHost ? 'CONNECTED — press LAUNCH to start the run' : 'CONNECTED — waiting for the host to launch');
      const sb = document.getElementById('start-btn');
      if (!Net.isHost) sb.textContent = 'WAITING FOR HOST…';
    };
    Net.onStart = (m) => startGame({ seed: m.seed, stage: m.stage, mp: true });
    Net.onClose = () => {
      if (game.phase === 'PLAYING' || game.phase === 'ESCAPE') game.announce('PARTNER LINK LOST — going it alone', 4);
      else say('disconnected');
    };
  }

  if (hasDOM) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  global.startGame = startGame;
  // headless access for sim.js: start a run and step the real update loop directly
  global.GameRun = { game, startGame, update, WARP_TIME, EXIT_HOLD_TIME, STAGES };
})(typeof window !== 'undefined' ? window : globalThis);
