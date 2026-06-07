/* upgrades.js — the level-up choice pool. This is where the meaningful decisions live.
 * Each upgrade has a max stack; generateChoices() returns distinct eligible options. */
(function (global) {
  'use strict';

  const UPGRADES = [
    { id: 'amplifier', name: 'Damage Amplifier', icon: '✦', color: '#38e8ff', max: 6,
      desc: 'Weapon damage +16%', apply: (g) => { g.player.stats.damageMult *= 1.16; } },
    { id: 'coolant', name: 'Coolant System', icon: '❄', color: '#7fd8ff', max: 6,
      desc: 'Weapon cooldown −9%', apply: (g) => { g.player.stats.cooldownMult *= 0.91; } },
    { id: 'multiplier', name: 'Munitions Splitter', icon: '⁂', color: '#a9b8ff', max: 4,
      desc: '+1 projectile per volley', apply: (g) => { g.player.stats.count += 1; } },
    { id: 'engine', name: 'Ion Engine', icon: '»', color: '#54ff9f', max: 6,
      desc: 'Move speed +12%', apply: (g) => { g.player.stats.speedMult *= 1.12; } },
    { id: 'hull', name: 'Hull Plating', icon: '▰', color: '#ffd166', max: 6,
      desc: 'Max HP +25 (and repair 25)', apply: (g) => { g.player.maxHp += 25; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 25); } },
    { id: 'magnet', name: 'Salvage Magnet', icon: '◎', color: '#54ff9f', max: 5,
      desc: 'Pickup radius +35%', apply: (g) => { g.player.magnet *= 1.35; } },
    { id: 'regen', name: 'Repair Drone', icon: '✚', color: '#54ff9f', max: 4,
      desc: 'Regenerate +0.8 HP/s', apply: (g) => { g.player.regen += 0.8; } },
    { id: 'blink_cd', name: 'Blink Capacitor', icon: '⟶', color: '#9af0ff', max: 4,
      desc: 'Blink cooldown −18%', apply: (g) => { g.player.blink.cdMult *= 0.82; } },
    { id: 'blink_dist', name: 'Phase Coils', icon: '⟶', color: '#9af0ff', max: 3,
      desc: 'Blink distance +25%', apply: (g) => { g.player.blink.dist *= 1.25; } },
    { id: 'ult_charge', name: 'Reactor Tap', icon: '⚡', color: '#ffd166', max: 4,
      desc: 'Ultimate charges +25% faster', apply: (g) => { g.player.ult.mult *= 1.25; } }
  ];

  const REPAIR = { id: 'repair', name: 'Emergency Repair', icon: '✚', color: '#ff9fae', max: Infinity,
    desc: 'Repair 30% of max HP', apply: (g) => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.3); } };

  function levelOf(game, id) { return (game.upgradeLevels && game.upgradeLevels[id]) || 0; }

  function generateChoices(game, n) {
    const eligible = UPGRADES.filter(u => levelOf(game, u.id) < u.max);
    // Fisher–Yates shuffle with the run RNG
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(game.rng() * (i + 1));
      const t = eligible[i]; eligible[i] = eligible[j]; eligible[j] = t;
    }
    const out = eligible.slice(0, n);
    while (out.length < n) out.push(REPAIR); // fallback if pool exhausted
    return out.map(u => ({ id: u.id, name: u.name, icon: u.icon, color: u.color, desc: u.desc, max: u.max, level: levelOf(game, u.id), apply: u.apply }));
  }

  function applyChoice(game, choice) {
    choice.apply(game);
    if (!game.upgradeLevels) game.upgradeLevels = {};
    game.upgradeLevels[choice.id] = (game.upgradeLevels[choice.id] || 0) + 1;
  }

  global.UPGRADES = UPGRADES;
  global.Upgrades = { UPGRADES, generateChoices, applyChoice, levelOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Upgrades;
})(typeof window !== 'undefined' ? window : globalThis);
