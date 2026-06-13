/* sprites.js — loads the hand-crafted pixel-art sprites (player Ace + enemies) and
 * builds white-tinted copies for the damage flash. Drawn billboard-style (upright,
 * flipped left/right) and scaled with smoothing off for crisp pixels. */
(function (global) {
  'use strict';
  const Sprites = { ready: false, ace: null, nova: null, enemy: null, pack: null, crew: null };

  function makeWhite(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  Sprites.load = function () {
    const ver = global.GAME_VERSION || '0';
    const ace = {}, nova = {}, enemy = {}, pack = [], crew = [];
    let pending = 0, done = false;
    const finish = () => { if (--pending <= 0 && !done) { done = true; Sprites.ace = ace; Sprites.nova = nova; Sprites.enemy = enemy; Sprites.pack = pack; Sprites.crew = crew; Sprites.ready = true; } };
    const loadInto = (arr, idx, src) => {
      pending++;
      const img = new Image();
      img.onload = () => { arr[idx] = { img, white: makeWhite(img), w: img.width, h: img.height }; finish(); };
      img.onerror = finish;
      img.src = src;
    };
    ['basic', 'armored', 'heavy'].forEach((t) => { ace[t] = []; for (let f = 0; f < 5; f++) loadInto(ace[t], f, `sprites/ace_${t}_${f}.png?v=${ver}`); });
    ['basic', 'armored', 'heavy'].forEach((t) => { nova[t] = []; for (let f = 0; f < 5; f++) loadInto(nova[t], f, `sprites/nova_${t}_${f}.png?v=${ver}`); });
    ['swarmer', 'sprinter', 'spitter', 'hulk', 'boss', 'wraith'].forEach((t) => { enemy[t] = []; for (let f = 0; f < 2; f++) loadInto(enemy[t], f, `sprites/enemy_${t}_${f}.png?v=${ver}`); });
    for (let f = 0; f < 2; f++) loadInto(pack, f, `sprites/pickup_heal_${f}.png?v=${ver}`);
    for (let f = 0; f < 2; f++) loadInto(crew, f, `sprites/crew_${f}.png?v=${ver}`);
  };

  Sprites.tierFor = function (armor) { return armor >= 5 ? 'heavy' : armor >= 2 ? 'armored' : 'basic'; };

  global.Sprites = Sprites;
})(typeof window !== 'undefined' ? window : globalThis);
