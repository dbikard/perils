/* meta.js — persistent progress (localStorage): run records, crew rescued,
 * and stage unlocks. Node-safe (no-ops without localStorage). */
(function (global) {
  'use strict';
  const KEY = 'perils-meta-v1';
  const hasStore = (typeof localStorage !== 'undefined');

  const Meta = {
    data: { runs: 0, escapes: 0, bestTime: 0, bestKills: 0, rescued: 0, unlocked: 1 }
  };

  Meta.load = function () {
    if (!hasStore) return;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(Meta.data, JSON.parse(raw));
    } catch (e) { /* corrupted store — keep defaults */ }
  };
  Meta.save = function () {
    if (!hasStore) return;
    try { localStorage.setItem(KEY, JSON.stringify(Meta.data)); } catch (e) { /* full/blocked */ }
  };

  // called at run end; returns flags so the end screen can celebrate
  Meta.record = function (game, escaped) {
    const d = Meta.data;
    d.runs++;
    const res = { newBestTime: false, newBestKills: false, firstEscape: false };
    if (game.timeSec > d.bestTime) { d.bestTime = game.timeSec; res.newBestTime = d.runs > 1; }
    if (game.kills > d.bestKills) { d.bestKills = game.kills; res.newBestKills = d.runs > 1; }
    if (game.survivors) d.rescued += game.survivors.filter(s => s.state === 'following').length * (escaped ? 1 : 0);
    if (escaped) {
      d.escapes++;
      if (d.escapes === 1) res.firstEscape = true;
      const next = game.stageDef && game.stageDef.next;
      if (next && next > d.unlocked) d.unlocked = next;
    }
    Meta.save();
    return res;
  };

  Meta.unlockedStage = function (n) { return n <= Meta.data.unlocked; };

  Meta.fmt = function (s) {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };

  /* menu: records line + stage selector states */
  Meta.renderMenuStats = function () {
    if (typeof document === 'undefined') return;
    const d = Meta.data;
    const el = document.getElementById('menu-stats');
    if (el) {
      el.textContent = d.runs === 0 ? '' :
        `BEST ${Meta.fmt(d.bestTime)} · ${d.bestKills} KILLS · ${d.escapes} ESCAPES · ${d.rescued} CREW SAVED`;
    }
    document.querySelectorAll('.stage-btn').forEach((btn) => {
      const n = parseInt(btn.dataset.stage, 10);
      const locked = !Meta.unlockedStage(n);
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('selected', (global.game && (global.game.menuStage || 1)) === n);
      btn.disabled = locked;
    });
  };

  Meta.load();
  global.Meta = Meta;
  if (typeof module !== 'undefined' && module.exports) module.exports = Meta;
})(typeof window !== 'undefined' ? window : globalThis);
