/* ui.js — level-up modal (DOM overlay) + ability-button layout.
 * The level-up modal pauses the game and presents 1-of-3 upgrade choices. */
(function (global) {
  'use strict';
  const E = global.Engine;
  const UI = { buttons: [] };

  /* ---- ability buttons (screen-space; registered as input action regions) ---- */
  UI.layoutButtons = function (game) {
    const W = E.width, H = E.height, p = game.player;
    const sp = p.special;
    UI.buttons = [
      { id: 'ultimate', x: W - 70, y: H - 86, r: 42, icon: '⚡', color: '#ffd166', locked: false,
        ready: () => p.ult.charge >= 1, frac: () => p.ult.charge },
      { id: 'blink', x: W - 70, y: H - 178, r: 36, icon: '⟶', color: '#9af0ff', locked: false,
        ready: () => p.blink.cd <= 0,
        frac: () => 1 - Math.max(0, p.blink.cd) / (p.blink.cdMax * p.blink.cdMult) },
      { id: 'special', x: W - 156, y: H - 150, r: 36,
        icon: sp ? sp.def.icon : '·', color: sp ? sp.def.color : '#5e77a0', locked: !sp,
        ready: () => sp && sp.cd <= 0,
        frac: () => sp ? 1 - Math.max(0, sp.cd) / sp.def.stats(sp.level).cd : 0 }
    ];
    E.input.actionRegions = UI.buttons.map(b => ({ id: b.id, x: b.x, y: b.y, r: b.r }));
  };

  /* ---- level-up modal ---- */
  function pips(level, max) {
    if (!isFinite(max)) return '';
    let s = '';
    for (let i = 0; i < max; i++) s += `<i class="${i < level ? 'on' : ''}"></i>`;
    return s;
  }

  UI.openLevelUp = function (game) {
    E.paused = true;
    E.input.joyActive = false; // drop any in-progress joystick
    game._choices = global.Upgrades.generateChoices(game, 3);
    const cont = document.getElementById('levelup');
    let html = `<div class="lvlup-inner"><div class="lvlup-head">LEVEL ${game.player.level}</div>`
      + `<div class="lvlup-sub">Choose an upgrade</div><div class="lvlup-cards">`;
    game._choices.forEach((c, i) => {
      html += `<button class="lvlup-card" data-i="${i}" style="--c:${c.color}">`
        + `<div class="lvlup-icon">${c.icon}</div>`
        + `<div class="lvlup-text">`
        + `<div class="lvlup-tag">${c.tag || ''}</div>`
        + `<div class="lvlup-name">${c.name}</div>`
        + `<div class="lvlup-desc">${c.desc}</div>`
        + `<div class="lvlup-pips">${pips(c.level, c.max)}</div>`
        + `</div></button>`;
    });
    html += `</div></div>`;
    cont.innerHTML = html;
    cont.classList.remove('hidden');
    cont.querySelectorAll('.lvlup-card').forEach(btn =>
      btn.addEventListener('click', () => UI.pick(game, parseInt(btn.dataset.i, 10))));
  };

  UI.pick = function (game, i) {
    const choice = game._choices[i];
    if (choice) global.Upgrades.applyChoice(game, choice);
    game.pendingLevels--;
    if (game.pendingLevels > 0) {
      UI.openLevelUp(game); // queue next level
    } else {
      document.getElementById('levelup').classList.add('hidden');
      E.paused = false;
    }
  };

  global.UI = UI;
  if (typeof module !== 'undefined' && module.exports) module.exports = UI;
})(typeof window !== 'undefined' ? window : globalThis);
