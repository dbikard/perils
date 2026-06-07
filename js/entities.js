/* entities.js — pooled game objects (player, enemies, projectiles, crystals).
 * Pool keeps an `active` array (swap-removed on release) and reuses dead objects. */
(function (global) {
  'use strict';

  class Pool {
    constructor(factory) { this.factory = factory; this.active = []; this.free = []; }
    spawn() {
      const o = this.free.pop() || this.factory();
      o._active = true; o._idx = this.active.length;
      this.active.push(o);
      return o;
    }
    release(o) {
      if (!o._active) return;
      o._active = false;
      const a = this.active, last = a.pop();
      if (last !== o) { a[o._idx] = last; last._idx = o._idx; }
      this.free.push(o);
    }
    clear() { while (this.active.length) this.release(this.active[this.active.length - 1]); }
    get count() { return this.active.length; }
  }

  function createPlayer() {
    return {
      x: 0, y: 0, r: 13,
      hp: 100, maxHp: 100,
      speed: 175,           // base px/s (scaled by stats.speedMult)
      hitFlash: 0,          // seconds of damage flash remaining
      invuln: 0,            // i-frame seconds (Blink)
      facingX: 0, facingY: 1, // last non-zero move direction (for stationary dash)
      weapons: [],          // [{ def, timer }]
      level: 1, xp: 0, xpNext: 5,
      magnet: 95,           // crystal pickup radius (px)
      regen: 0,             // hp per second
      overload: 0,          // seconds of Overload weapon surge remaining
      // multipliers read live by the weapon/movement systems
      stats: { speedMult: 1, damageMult: 1, cooldownMult: 1, count: 1 },
      // Blink ability
      blink: { cdMax: 3.0, cd: 0, dist: 150, invuln: 0.35, cdMult: 1, upg: 0 },
      // Special slot (build-chosen) — { id, def, level, cd }
      special: null,
      // Ultimate
      ult: { charge: 0, perKill: 1 / 55, mult: 1, radiusFactor: 0.72, damage: 9999, upg: 0 },
      tx: 0, ty: 0          // current tile (cached)
    };
  }

  function newEnemy() {
    return { x: 0, y: 0, r: 10, hp: 10, maxHp: 10, speed: 60, type: null, damage: 6,
      hitFlash: 0, stun: 0, fireTimer: 0, boss: false, color: '#ff5a6e', _active: false, _idx: -1 };
  }
  function newProjectile() {
    return { x: 0, y: 0, vx: 0, vy: 0, r: 5, damage: 10, life: 1, pierce: 0, color: '#38e8ff', _active: false, _idx: -1 };
  }
  function newEnemyProjectile() {
    return { x: 0, y: 0, vx: 0, vy: 0, r: 6, damage: 8, life: 3, color: '#ff9f43', _active: false, _idx: -1 };
  }
  function newMine() {
    return { x: 0, y: 0, r: 7, arm: 0.4, damage: 40, radius: 55, triggerR: 24, life: 16, _active: false, _idx: -1 };
  }
  function newCrystal() {
    return { x: 0, y: 0, r: 5, value: 1, _active: false, _idx: -1 };
  }

  global.Entities = { Pool, createPlayer, newEnemy, newProjectile, newEnemyProjectile, newMine, newCrystal };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Entities;
})(typeof window !== 'undefined' ? window : globalThis);
