#!/usr/bin/env node
/* sim.js — headless balance bot for Perils.
 *
 * Loads the REAL game modules (no browser) and steps the actual game.js update
 * loop at the fixed timestep, with a bot driving the input. Measures survival
 * time, escape rate and progression so difficulty can be tuned against the
 * targets in DESIGN_PRINCIPLES.md:
 *
 *   random  — moves randomly, random picks   → dies < 2 min, ~0% escape
 *   greedy  — chases XP, ignores danger      → dies 3–6 min
 *   skilled — kites, greeds safely, abilities → escapes 25–45%
 *
 * Usage:
 *   node sim.js                         # all three bots, 20 runs each
 *   node sim.js --bots=skilled --runs=40 --seed=7
 *   node sim.js --bots=skilled --ablate=blink,special,ult,magnet
 *   node sim.js --bots=skilled --runs=1 --trace   # 15s-interval run trace
 */
'use strict';

/* ---- load game modules in script order (they attach to globalThis) ---- */
require('./js/engine.js');
require('./js/mapgen.js');
require('./js/entities.js');
require('./js/weapons.js');
require('./js/abilities.js');
require('./js/enemies.js');
require('./js/upgrades.js');

const E = globalThis.Engine;
E.width = 390; E.height = 700; // phone viewport (spawn ring + ult radius scale with it)

/* UI stub — game.js calls openLevelUp when XP banks a level; resolve instantly
 * with the active bot's pick policy (browser pauses into a modal instead). */
let activeBot = null;
let ablated = new Set();
globalThis.UI = {
  layoutButtons() {},
  openLevelUp(game) {
    while (game.pendingLevels > 0) {
      const choices = globalThis.Upgrades.generateChoices(game, 3);
      const pick = activeBot.pick(game, choices) || choices[0];
      globalThis.Upgrades.applyChoice(game, pick);
      game.pendingLevels--;
    }
  }
};

require('./js/game.js');
const Run = globalThis.GameRun;
const Upgrades = globalThis.Upgrades;

/* ================= bot helpers ================= */

function nearestCrystal(game, maxR) {
  const p = game.player, list = game.crystals.active;
  let best = null, bestScore = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d > maxR) continue;
    const score = c.value / (d + 40);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function threatVector(game, radius) {
  // sum of push-away vectors from nearby enemies, weighted by proximity
  const p = game.player, list = game.enemies.active;
  let tx = 0, ty = 0, count = 0, nearest = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) - e.r;
    if (d < nearest) nearest = d;
    if (d > radius) continue;
    count++;
    const w = Math.pow(1 - Math.max(0, d) / radius, 2) * (e.boss ? 3 : 1);
    const l = Math.hypot(dx, dy) || 1;
    tx += dx / l * w; ty += dy / l * w;
  }
  return { x: tx, y: ty, count, nearest };
}

function countWithin(game, r) {
  const p = game.player, list = game.enemies.active, r2 = r * r;
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if ((e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y) < r2) n++;
  }
  return n;
}

// steer around walls: if the desired direction is blocked just ahead, slide along an axis
function steer(game, dir) {
  const p = game.player, look = 24;
  if (dir.x === 0 && dir.y === 0) return dir;
  const l = Math.hypot(dir.x, dir.y) || 1;
  let dx = dir.x / l, dy = dir.y / l;
  if (!game.hitsWall(p.x + dx * look, p.y + dy * look, p.r)) return { x: dx, y: dy };
  if (!game.hitsWall(p.x + dx * look, p.y, p.r)) return { x: Math.sign(dx) || 0, y: 0 };
  if (!game.hitsWall(p.x, p.y + dy * look, p.r)) return { x: 0, y: Math.sign(dy) || 0 };
  return { x: -dy, y: dx }; // both blocked: turn 90°
}

function setMove(dir) {
  const inp = E.input;
  inp.joyActive = true;
  const l = Math.hypot(dir.x, dir.y);
  inp.joyVecX = l > 1 ? dir.x / l : dir.x;
  inp.joyVecY = l > 1 ? dir.y / l : dir.y;
}
function tap(id) { if (!ablated.has(id)) E.input.taps.push(id); }

/* exit flow field, computed once per run when ESCAPE starts */
function exitDir(game, st) {
  if (!st.exitFF) { st.exitFF = new E.FlowField(game.map); st.exitFF.compute(game.map.exit.tx, game.map.exit.ty); }
  const t = game.map.tileAtWorld(game.player.x, game.player.y);
  const d = st.exitFF.dirAtTile(t.tx, t.ty);
  if (d.x === 0 && d.y === 0) {
    const ex = game.map.exit, dx = ex.x - game.player.x, dy = ex.y - game.player.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }
  return d;
}

/* ================= pick policies ================= */

function randomPick(game, choices, rng) { return choices[Math.floor(rng() * choices.length)]; }

const PASSIVE_SCORE = { amplifier: 42, coolant: 40, multiplier: 38, engine: 33, armor: 30,
  regen: 30, magnet: 27, blink_cd: 24, ult_charge: 20, blink_dist: 12 };

function skilledPick(game, choices, rng) {
  const p = game.player;
  let best = null, bestS = -1;
  for (const c of choices) {
    let s = 10;
    if (c.id === 'repair') s = p.hp / p.maxHp < 0.45 ? 70 : 4;
    else if (c.kind === 'weapon') s = c.level > 0 ? 48 + c.level * 2 : (p.weapons.length < 3 ? 46 : 16);
    else if (c.kind === 'special') s = c.level > 0 ? 32 : (ablated.has('special') ? 0 : 38);
    else if (c.kind === 'passive') {
      s = PASSIVE_SCORE[c.pid] || 15;
      if (c.pid === 'armor' && p.hp / p.maxHp < 0.6) s += 14;
      if (ablated.has('magnet') && c.pid === 'magnet') s = 0;
      if (ablated.has('blink') && (c.pid === 'blink_cd' || c.pid === 'blink_dist')) s = 0;
      if (ablated.has('ult') && c.pid === 'ult_charge') s = 0;
    }
    s += rng() * 6;
    if (s > bestS) { bestS = s; best = c; }
  }
  return best;
}

/* ================= bots ================= */

function makeBots(seed) {
  const rng = E.makeRng((seed ^ 0x9e3779b9) >>> 0);

  return {
    random: {
      name: 'random', st: {},
      pick: (g, ch) => randomPick(g, ch, rng),
      act(game, t) {
        const st = this.st;
        if (t >= (st.nextTurn || 0)) {
          st.nextTurn = t + 0.5 + rng() * 0.6;
          const a = rng() * Math.PI * 2;
          st.dir = { x: Math.cos(a), y: Math.sin(a) };
          if (rng() < 0.05) tap(['blink', 'special', 'ultimate'][Math.floor(rng() * 3)]);
        }
        setMove(steer(game, st.dir || { x: 1, y: 0 }));
      }
    },

    greedy: {
      // models a casual player: picks sensibly, but beelines for XP with only mild self-preservation
      name: 'greedy', st: {},
      pick: (g, ch) => skilledPick(g, ch, rng),
      act(game, t) {
        const st = this.st, p = game.player;
        if (game.phase === 'ESCAPE') { setMove(steer(game, exitDir(game, st))); return; }
        const threat = threatVector(game, 150);
        if (threat.nearest < 18) { // panic: flee, then blink in the flee direction
          setMove(steer(game, { x: threat.x, y: threat.y }));
          if (p.blink.cd <= 0) tap('blink');
          return;
        }
        const c = nearestCrystal(game, 700);
        let dir;
        if (c) { const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1;
          dir = { x: dx / l + threat.x * 0.6, y: dy / l + threat.y * 0.6 }; }
        else {
          // wander to a random floor point until a crystal shows up
          if (!st.tgt || Math.hypot(st.tgt.x - p.x, st.tgt.y - p.y) < 40) st.tgt = game.map.randomFloorWorld(rng);
          dir = { x: st.tgt.x - p.x, y: st.tgt.y - p.y };
        }
        setMove(steer(game, dir));
      }
    },

    skilled: {
      name: 'skilled', st: {},
      pick: (g, ch) => skilledPick(g, ch, rng),
      act(game, t) {
        const st = this.st, p = game.player;
        const threat = threatVector(game, 230);

        // dodge boss mortar telegraphs about to detonate
        for (const s of (game.slams || [])) {
          const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy);
          if (d < s.radius + 24 && s.delay - s.t < 0.8) {
            const l = d || 1;
            threat.x += dx / l * 2.2; threat.y += dy / l * 2.2;
          }
        }

        // --- abilities ---
        if (p.blink.cd <= 0 && (threat.nearest < 26 || threat.count >= 10)) tap('blink');
        if (p.special && p.special.cd <= 0 && countWithin(game, 200) >= 5) tap('special');
        if (p.ult.charge >= 1 && (countWithin(game, 320) >= 22 || (p.hp / p.maxHp < 0.35 && countWithin(game, 250) >= 8))) tap('ultimate');

        // --- movement: escape > dodge > greed > wander ---
        let dir = { x: 0, y: 0 };
        if (game.phase === 'ESCAPE') {
          const ex = game.map.exit, dExit = Math.hypot(ex.x - p.x, ex.y - p.y);
          if (dExit < 90) {
            // final stand: plant on the pad, burn every cooldown
            dir.x = (ex.x - p.x) * 0.1 + threat.x * 0.15;
            dir.y = (ex.y - p.y) * 0.1 + threat.y * 0.15;
            if (p.special && p.special.cd <= 0 && countWithin(game, 240) >= 3) tap('special');
            if (p.ult.charge >= 1 && countWithin(game, 320) >= 8) tap('ultimate');
          } else {
            const ed = exitDir(game, st);
            dir.x = ed.x * 1.6 + threat.x * 0.9;
            dir.y = ed.y * 1.6 + threat.y * 0.9;
          }
        } else {
          const danger = Math.hypot(threat.x, threat.y);
          const c = nearestCrystal(game, 520);
          if (c && danger < 1.6) {
            const dx = c.x - p.x, dy = c.y - p.y, l = Math.hypot(dx, dy) || 1;
            dir.x = dx / l + threat.x * 1.1; dir.y = dy / l + threat.y * 1.1;
          } else if (danger > 0.05) {
            dir.x = threat.x; dir.y = threat.y;
          } else {
            if (!st.tgt || Math.hypot(st.tgt.x - p.x, st.tgt.y - p.y) < 40) st.tgt = game.map.randomFloorWorld(rng);
            dir.x = st.tgt.x - p.x; dir.y = st.tgt.y - p.y;
          }
        }
        setMove(steer(game, dir));
      }
    }
  };
}

/* ================= run harness ================= */

const STEP = E.STEP, MAX_TIME = 480;

function playRun(botName, seed, opts) {
  const bots = makeBots(seed);
  const bot = bots[botName];
  activeBot = bot;
  bot.st = {};
  Run.startGame({ seed });
  const game = Run.game;
  const trace = [];

  let t = 0, decideAt = 0;
  while ((game.phase === 'PLAYING' || game.phase === 'ESCAPE') && t < MAX_TIME) {
    if (t >= decideAt) { decideAt = t + 0.1; bot.act(game, t); }
    if (ablated.has('magnet')) game.player.magnet = 1;
    Run.update(STEP);
    t += STEP;
    if (opts.trace && Math.floor(t / 15) > Math.floor((t - STEP) / 15)) {
      trace.push({ t: Math.round(t), hp: Math.round(game.player.hp), lv: game.player.level,
        enemies: game.enemies.count, kills: game.kills, warp: Math.round(game.warp * 100) });
    }
  }
  const escaped = game.phase === 'VICTORY';
  if (opts.trace) {
    for (const s of trace) console.log(`    t=${String(s.t).padStart(3)}s hp=${String(s.hp).padStart(3)} lv=${String(s.lv).padStart(2)} enemies=${String(s.enemies).padStart(3)} kills=${String(s.kills).padStart(4)} warp=${s.warp}%`);
    console.log(`    weapons: ${game.player.weapons.map(w => `${w.id}:${w.level}`).join(' ')}  special: ${game.player.special ? game.player.special.id + ':' + game.player.special.level : '—'}`);
    console.log(`    passives: ${Object.entries(game.upgradeLevels).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}`);
  }
  return { time: game.timeSec, escaped, level: game.player.level, kills: game.kills, seed };
}

function median(arr) { const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function quartile(arr, q) { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; }
function fmt(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

function runBatch(botName, runs, seed0, opts) {
  const results = [];
  for (let i = 0; i < runs; i++) results.push(playRun(botName, seed0 + i * 7919, opts));
  const times = results.map(r => r.time);
  const esc = results.filter(r => r.escaped).length;
  const summary = {
    bot: botName, runs,
    escapePct: Math.round(100 * esc / runs),
    medTime: median(times), p25: quartile(times, 0.25), p75: quartile(times, 0.75),
    medLevel: median(results.map(r => r.level)),
    medKills: median(results.map(r => r.kills))
  };
  // death-time histogram (30s buckets, escapes excluded)
  const hist = new Array(Math.ceil(MAX_TIME / 30)).fill(0);
  for (const r of results) if (!r.escaped) hist[Math.min(hist.length - 1, Math.floor(r.time / 30))]++;
  summary.hist = hist;
  return summary;
}

function printSummary(s) {
  console.log(`  ${s.bot.padEnd(8)} runs=${s.runs}  escape=${String(s.escapePct).padStart(3)}%  ` +
    `survival med=${fmt(s.medTime)} (p25=${fmt(s.p25)} p75=${fmt(s.p75)})  lv=${s.medLevel}  kills=${s.medKills}`);
  const bars = s.hist.map(h => h === 0 ? '·' : (h < 3 ? '▂' : h < 6 ? '▄' : h < 10 ? '▆' : '█')).join('');
  console.log(`  ${' '.repeat(8)} deaths/30s: [${bars}]`);
}

/* ================= CLI ================= */

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] === undefined ? true : m[2];
}
const runs = parseInt(args.runs || '20', 10);
const seed0 = parseInt(args.seed || '1', 10);
const botNames = (args.bots || 'random,greedy,skilled').split(',');
const opts = { trace: !!args.trace };

console.log(`Perils sim — ${runs} run(s)/bot, seed base ${seed0}, warp=${Run.WARP_TIME}s`);
console.log(`targets: random <2:00 & ~0% escape · greedy 3:00–6:00 · skilled 25–45% escape\n`);

if (args.ablate) {
  // ablation: disable one mechanic at a time for the skilled bot, compare to baseline
  const features = args.ablate === true ? ['blink', 'special', 'ult', 'magnet'] : args.ablate.split(',');
  ablated = new Set();
  const base = runBatch('skilled', runs, seed0, opts);
  console.log('baseline (skilled):'); printSummary(base);
  for (const f of features) {
    ablated = new Set([f]);
    const s = runBatch('skilled', runs, seed0, opts);
    const dT = (s.medTime - base.medTime) / base.medTime * 100;
    console.log(`\nablate ${f}:  Δ median survival ${dT >= 0 ? '+' : ''}${dT.toFixed(0)}%  Δ escape ${s.escapePct - base.escapePct}pp`);
    printSummary(s);
  }
  ablated = new Set();
} else {
  for (const b of botNames) {
    const s = runBatch(b, runs, seed0, opts);
    printSummary(s);
  }
}
