/* render.js — all canvas drawing. Pure function of game state.
 * Isolated so a future PixiJS renderer could swap in without touching game logic. */
(function (global) {
  'use strict';
  const Render = {};

  function drawMap(ctx, game) {
    const map = game.map, t = map.tile, cam = global.Engine.camera;
    const W = global.Engine.width, H = global.Engine.height;
    const left = cam.x - W / 2, top = cam.y - H / 2;
    const minTx = Math.max(0, Math.floor(left / t) - 1);
    const maxTx = Math.min(map.cols - 1, Math.floor((left + W) / t) + 1);
    const minTy = Math.max(0, Math.floor(top / t) - 1);
    const maxTy = Math.min(map.rows - 1, Math.floor((top + H) / t) + 1);

    // floor panels
    ctx.fillStyle = '#0b1422';
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (map.isWallTile(tx, ty)) continue;
        ctx.fillRect(tx * t, ty * t, t, t);
      }
    }
    // faint inner grid
    ctx.strokeStyle = 'rgba(56,232,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (map.isWallTile(tx, ty)) continue;
        ctx.rect(tx * t + 0.5, ty * t + 0.5, t - 1, t - 1);
      }
    }
    ctx.stroke();
    // neon wall edges (floor tile sides that border a wall)
    ctx.strokeStyle = 'rgba(56,232,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (map.isWallTile(tx, ty)) continue;
        const x = tx * t, y = ty * t;
        if (map.isWallTile(tx, ty - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + t, y); }
        if (map.isWallTile(tx, ty + 1)) { ctx.moveTo(x, y + t); ctx.lineTo(x + t, y + t); }
        if (map.isWallTile(tx - 1, ty)) { ctx.moveTo(x, y); ctx.lineTo(x, y + t); }
        if (map.isWallTile(tx + 1, ty)) { ctx.moveTo(x + t, y); ctx.lineTo(x + t, y + t); }
      }
    }
    ctx.stroke();
  }

  function drawExit(ctx, game) {
    const ex = game.map.exit;
    const pulse = 0.5 + 0.5 * Math.sin(game.timeSec * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(84,255,159,${0.25 + 0.35 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, 14 + 6 * pulse, 0, Engine.TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawCrystals(ctx, game) {
    const list = game.crystals.active;
    if (!list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#54ff9f';
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Engine.TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemies(ctx, game) {
    const list = game.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Engine.TAU);
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.stroke();
    }
  }

  function drawProjectiles(ctx, game) {
    const list = game.projectiles.active;
    if (!list.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < list.length; i++) {
      const pr = list[i];
      const l = Math.sqrt(pr.vx * pr.vx + pr.vy * pr.vy) || 1;
      const tx = pr.x - pr.vx / l * 10, ty = pr.y - pr.vy / l * 10;
      ctx.strokeStyle = pr.color;
      ctx.lineWidth = pr.r * 1.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty); ctx.lineTo(pr.x, pr.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(ctx, game) {
    const p = game.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = '#38e8ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : (p.invuln > 0 ? '#bff7ff' : '#9af0ff');
    // diamond ship
    ctx.beginPath();
    ctx.moveTo(0, -p.r); ctx.lineTo(p.r * 0.8, 0); ctx.lineTo(0, p.r); ctx.lineTo(-p.r * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function drawEffectsWorld(ctx, game) {
    const fx = game.effects;
    if (!fx || !fx.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < fx.length; i++) {
      const e = fx[i];
      const prog = 1 - e.life / e.maxLife; // 0..1
      if (e.type === 'ring') {
        const r = e.r0 + (e.r1 - e.r0) * prog;
        ctx.globalAlpha = Math.max(0, 1 - prog);
        ctx.strokeStyle = e.color; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Engine.TAU); ctx.stroke();
      } else if (e.type === 'trail') {
        ctx.globalAlpha = Math.max(0, e.life / e.maxLife) * 0.85;
        ctx.strokeStyle = e.color; ctx.lineWidth = 9; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(e.x1, e.y1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawFlash(ctx, game) {
    const fx = game.effects;
    if (!fx) return;
    for (let i = 0; i < fx.length; i++) {
      const e = fx[i];
      if (e.type === 'flash') {
        const a = Math.max(0, e.life / e.maxLife);
        ctx.fillStyle = `rgba(${e.color},${a * 0.5})`;
        ctx.fillRect(0, 0, global.Engine.width, global.Engine.height);
      }
    }
  }

  function drawXpBar(ctx, game) {
    const p = game.player, W = global.Engine.width;
    const frac = p.xpNext > 0 ? p.xp / p.xpNext : 0;
    ctx.fillStyle = 'rgba(56,232,255,0.15)'; ctx.fillRect(0, 0, W, 4);
    ctx.fillStyle = '#38e8ff'; ctx.fillRect(0, 0, W * Engine.clamp(frac, 0, 1), 4);
  }

  function drawButtons(ctx, game) {
    const btns = global.UI ? global.UI.buttons : [];
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const ready = b.ready();
      const frac = Engine.clamp(b.frac(), 0, 1);
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Engine.TAU);
      ctx.fillStyle = ready ? 'rgba(20,30,48,0.85)' : 'rgba(14,20,32,0.72)'; ctx.fill();
      // cooldown / charge arc
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 3, -Math.PI / 2, -Math.PI / 2 + Engine.TAU * frac);
      ctx.strokeStyle = b.color; ctx.lineWidth = 4; ctx.globalAlpha = ready ? 1 : 0.55; ctx.stroke(); ctx.globalAlpha = 1;
      // outline
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Engine.TAU);
      ctx.strokeStyle = ready ? b.color : 'rgba(120,150,190,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      // ready pulse for ultimate
      if (ready && b.id === 'ultimate') {
        ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin(game.timeSec * 6);
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4, 0, Engine.TAU); ctx.strokeStyle = b.color; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = ready ? '#ffffff' : 'rgba(200,220,255,0.55)';
      ctx.font = `${Math.floor(b.r * 0.85)}px system-ui`;
      ctx.fillText(b.icon, b.x, b.y + 2);
    }
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  function drawHUDOverlay(ctx, game) {
    const p = game.player, W = global.Engine.width;
    // HP bar (screen space)
    const bw = Math.min(280, W - 40), bx = (W - bw) / 2, by = 44, bh = 10;
    ctx.fillStyle = 'rgba(255,90,110,0.18)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff5a6e';
    ctx.fillRect(bx, by, bw * Math.max(0, p.hp / p.maxHp), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

    // joystick
    const inp = global.Engine.input;
    if (inp.joyActive) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = 'rgba(56,232,255,0.6)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(inp.joyOriginX, inp.joyOriginY, inp.maxRadius, 0, Engine.TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(56,232,255,0.5)';
      const kx = inp.joyOriginX + inp.joyVecX * inp.maxRadius;
      const ky = inp.joyOriginY + inp.joyVecY * inp.maxRadius;
      ctx.beginPath(); ctx.arc(kx, ky, 22, 0, Engine.TAU); ctx.fill();
      ctx.restore();
    }
  }

  Render.draw = function (game) {
    const ctx = global.Engine.ctx, W = global.Engine.width, H = global.Engine.height, cam = global.Engine.camera;
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2 - cam.x, H / 2 - cam.y); // world space
    drawMap(ctx, game);
    drawExit(ctx, game);
    drawCrystals(ctx, game);
    drawProjectiles(ctx, game);
    drawEnemies(ctx, game);
    drawEffectsWorld(ctx, game);
    drawPlayer(ctx, game);
    ctx.restore();

    // screen space
    drawFlash(ctx, game);
    drawXpBar(ctx, game);
    drawHUDOverlay(ctx, game);
    drawButtons(ctx, game);
  };

  global.Render = Render;
  if (typeof module !== 'undefined' && module.exports) module.exports = Render;
})(typeof window !== 'undefined' ? window : globalThis);
