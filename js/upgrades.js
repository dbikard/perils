/* upgrades.js — the level-up choice pool. Offers weapon acquire/upgrade, Special acquire/upgrade,
 * and passive/ability upgrades. This is where the meaningful build decisions live. */
(function (global) {
  'use strict';

  const WEAPON_CAP = 6;

  // passive + ability upgrades (stack-limited, tracked in game.upgradeLevels)
  const PASSIVES = [
    { id: 'amplifier', name: 'Damage Amplifier', icon: '✦', color: '#38e8ff', max: 6, tag: 'PASSIVE',
      desc: 'Weapon damage +16%', apply: (g) => { g.player.stats.damageMult *= 1.16; } },
    { id: 'coolant', name: 'Coolant System', icon: '❄', color: '#7fd8ff', max: 6, tag: 'PASSIVE',
      desc: 'Weapon cooldown −9%', apply: (g) => { g.player.stats.cooldownMult *= 0.91; } },
    { id: 'multiplier', name: 'Munitions Splitter', icon: '⁂', color: '#a9b8ff', max: 4, tag: 'PASSIVE',
      desc: '+1 projectile on volley weapons', apply: (g) => { g.player.stats.count += 1; } },
    { id: 'engine', name: 'Ion Engine', icon: '»', color: '#54ff9f', max: 6, tag: 'PASSIVE',
      desc: 'Move speed +12%', apply: (g) => { g.player.stats.speedMult *= 1.12; } },
    { id: 'armor', name: 'Armor Plating', icon: '▰', color: '#7fd8ff', max: 8, tag: 'ARMOR',
      desc: '+1 armor (−7% damage, +20 HP)', apply: (g) => { g.player.armor += 1; g.player.maxHp += 20; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 20); } },
    { id: 'magnet', name: 'Salvage Magnet', icon: '◎', color: '#54ff9f', max: 5, tag: 'PASSIVE',
      desc: 'Pickup radius +35%', apply: (g) => { g.player.magnet *= 1.35; } },
    { id: 'regen', name: 'Repair Drone', icon: '✚', color: '#54ff9f', max: 4, tag: 'PASSIVE',
      desc: 'Regenerate +0.8 HP/s', apply: (g) => { g.player.regen += 0.8; } },
    { id: 'blink_cd', name: 'Blink Capacitor', icon: '⟶', color: '#9af0ff', max: 4, tag: 'ABILITY',
      desc: 'Blink cooldown −18%', apply: (g) => { g.player.blink.cdMult *= 0.82; } },
    { id: 'blink_dist', name: 'Phase Coils', icon: '⟶', color: '#9af0ff', max: 3, tag: 'ABILITY',
      desc: 'Blink distance +25%', apply: (g) => { g.player.blink.dist *= 1.25; } },
    { id: 'ult_charge', name: 'Reactor Tap', icon: '⚡', color: '#ffd166', max: 4, tag: 'ABILITY',
      desc: 'Ultimate charges +25% faster', apply: (g) => { g.player.ult.mult *= 1.25; } }
  ];

  const REPAIR = { id: 'repair', name: 'Emergency Repair', icon: '✚', color: '#ff9fae', max: Infinity, tag: 'SALVAGE',
    desc: 'Repair 30% of max HP', level: 0, apply: (g) => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.3); } };

  function levelOf(game, id) { return (game.upgradeLevels && game.upgradeLevels[id]) || 0; }

  function weaponUpgradeChoice(w) {
    return { kind: 'weapon', id: 'w_' + w.id, name: w.def.name, icon: w.def.icon, color: w.def.color,
      desc: w.def.blurb, tag: `WEAPON · Lv ${w.level}→${w.level + 1}`, level: w.level, max: w.def.maxLevel,
      apply: () => { w.level++; } };
  }
  function weaponAcquireChoice(id) {
    const def = global.WEAPONS[id];
    return { kind: 'weapon', id: 'w_' + id, name: def.name, icon: def.icon, color: def.color,
      desc: def.blurb, tag: 'NEW WEAPON', level: 0, max: def.maxLevel,
      apply: (g) => { global.Weapons.acquire(g, id); } };
  }
  function specialAcquireChoice(id) {
    const def = global.SPECIALS[id];
    return { kind: 'special', id: 's_' + id, name: def.name, icon: def.icon, color: def.color,
      desc: def.blurb, tag: 'SPECIAL · NEW', level: 0, max: def.maxLevel,
      apply: (g) => { global.Abilities.setSpecial(g, id); } };
  }
  function specialUpgradeChoice(sp) {
    return { kind: 'special', id: 's_' + sp.id, name: sp.def.name, icon: sp.def.icon, color: sp.def.color,
      desc: sp.def.blurb, tag: `SPECIAL · Lv ${sp.level}→${sp.level + 1}`, level: sp.level, max: sp.def.maxLevel,
      apply: () => { sp.level++; } };
  }
  function passiveChoice(game, u) {
    return { kind: 'passive', pid: u.id, id: u.id, name: u.name, icon: u.icon, color: u.color,
      desc: u.desc, tag: u.tag, level: levelOf(game, u.id), max: u.max, apply: u.apply };
  }

  function generateChoices(game, n) {
    const p = game.player, pool = [];
    const owned = new Set(p.weapons.map(w => w.id));

    for (const w of p.weapons) if (w.level < w.def.maxLevel) pool.push(weaponUpgradeChoice(w));
    if (p.weapons.length < WEAPON_CAP) for (const id in global.WEAPONS) if (!owned.has(id)) pool.push(weaponAcquireChoice(id));

    if (!p.special) { for (const id in global.SPECIALS) pool.push(specialAcquireChoice(id)); }
    else if (p.special.level < p.special.def.maxLevel) pool.push(specialUpgradeChoice(p.special));

    for (const u of PASSIVES) if (levelOf(game, u.id) < u.max) pool.push(passiveChoice(game, u));

    // Fisher–Yates with the run RNG
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(game.rng() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const out = pool.slice(0, n);
    while (out.length < n) out.push(Object.assign({}, REPAIR));
    return out;
  }

  function applyChoice(game, choice) {
    choice.apply(game);
    if (choice.kind === 'passive') {
      if (!game.upgradeLevels) game.upgradeLevels = {};
      game.upgradeLevels[choice.pid] = (game.upgradeLevels[choice.pid] || 0) + 1;
    }
  }

  global.Upgrades = { PASSIVES, generateChoices, applyChoice, levelOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Upgrades;
})(typeof window !== 'undefined' ? window : globalThis);
