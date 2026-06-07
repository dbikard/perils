/* sprites.js — loads the hand-crafted pixel-art player sprites (Ace) and builds
 * white-tinted copies for the damage flash. Sprites are drawn billboard-style
 * (upright, flipped left/right) and scaled with smoothing off for crisp pixels. */
(function (global) {
  'use strict';
  const Sprites = { ready: false, ace: null };

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
    const tiers = ['basic', 'armored', 'heavy'];
    const ver = global.GAME_VERSION || '0';
    const ace = {};
    let pending = 0, done = false;
    const finish = () => { if (--pending <= 0 && !done) { done = true; Sprites.ace = ace; Sprites.ready = true; } };
    tiers.forEach((t) => {
      ace[t] = [];
      for (let f = 0; f < 3; f++) {
        pending++;
        const img = new Image();
        const idx = f;
        img.onload = () => { ace[t][idx] = { img, white: makeWhite(img), w: img.width, h: img.height }; finish(); };
        img.onerror = finish;
        img.src = `sprites/ace_${t}_${f}.png?v=${ver}`;
      }
    });
  };

  // pick the tier sprite set for an armor level
  Sprites.tierFor = function (armor) { return armor >= 5 ? 'heavy' : armor >= 2 ? 'armored' : 'basic'; };

  global.Sprites = Sprites;
})(typeof window !== 'undefined' ? window : globalThis);
