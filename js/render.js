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
    const ex = game.map.exit, escaping = game.phase === 'ESCAPE';
    const pulse = 0.5 + 0.5 * Math.sin(game.timeSec * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(84,255,159,${(escaping ? 0.6 : 0.22) + 0.35 * pulse})`;
    ctx.lineWidth = escaping ? 4 : 3;
    ctx.beginPath();
    ctx.arc(ex.x, ex.y, (escaping ? 26 : 14) + 8 * pulse, 0, Engine.TAU);
    ctx.stroke();
    if (escaping) {
      ctx.fillStyle = `rgba(84,255,159,${0.5 + 0.4 * pulse})`;
      ctx.font = '12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('AIRLOCK', ex.x, ex.y - 36);
      ctx.textAlign = 'start';
    }
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

  function pathShape(ctx, shape, x, y, r) {
    ctx.beginPath();
    if (shape === 'tri') {
      ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.9, y + r * 0.8); ctx.lineTo(x - r * 0.9, y + r * 0.8); ctx.closePath();
    } else if (shape === 'square') {
      ctx.rect(x - r, y - r, r * 2, r * 2);
    } else if (shape === 'diamond') {
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    } else {
      ctx.arc(x, y, r, 0, Engine.TAU);
    }
  }

  function drawEnemies(ctx, game) {
    const list = game.enemies.active;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      pathShape(ctx, e.shape, e.x, e.y, e.r);
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.fill();
      ctx.lineWidth = e.boss ? 3 : 1.5;
      ctx.strokeStyle = e.boss ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
      ctx.stroke();
      if (e.stun > 0) {
        ctx.fillStyle = '#bff7ff';
        ctx.beginPath(); ctx.arc(e.x, e.y - e.r - 4, 2, 0, Engine.TAU); ctx.fill();
      }
      if (e.boss) {
        const w = e.r * 2.2, frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 5);
        ctx.fillStyle = '#ff5a6e'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * frac, 5);
      }
    }
  }

  function drawEnemyProjectiles(ctx, game) {
    const list = game.enemyProjectiles.active;
    if (!list.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffb347';
    for (let i = 0; i < list.length; i++) {
      const ep = list[i];
      ctx.beginPath(); ctx.arc(ep.x, ep.y, ep.r, 0, Engine.TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawMines(ctx, game) {
    const list = game.mines.active;
    for (let i = 0; i < list.length; i++) {
      const m = list[i];
      const arming = m.arm > 0;
      ctx.fillStyle = arming ? 'rgba(255,90,110,0.4)' : '#ff5a6e';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Engine.TAU); ctx.fill();
      if (!arming) {
        const blink = 0.4 + 0.4 * Math.sin(game.timeSec * 10);
        ctx.strokeStyle = `rgba(255,90,110,${blink})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.triggerR, 0, Engine.TAU); ctx.stroke();
      }
    }
  }

  function drawOrbiters(ctx, game) {
    const ws = game.player.weapons;
    for (let i = 0; i < ws.length; i++) {
      if (ws[i].id !== 'orbiter') continue;
      const st = ws[i].state, pos = st.positions, br = st.bodyR || 12;
      if (!pos) continue;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < pos.length; k += 2) {
        ctx.fillStyle = '#7fd8ff';
        ctx.beginPath(); ctx.arc(pos[k], pos[k + 1], br, 0, Engine.TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawSentries(ctx, game) {
    const list = game.sentries;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      ctx.fillStyle = '#54ff9f';
      ctx.fillRect(s.x - 9, s.y - 9, 18, 18);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 9, s.y - 9, 18, 18);
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

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Top-down space fighter. Faces its heading; gains armour plates as p.armor rises
  // (0 = plain jumpsuit, 1 = helmet+visor, 2 = chest plate, 3 = shoulders, 5 = back plate).
  function drawPlayer(ctx, game) {
    const p = game.player, r = p.r, armor = p.armor || 0, flash = p.hitFlash > 0;
    const ang = Math.atan2(p.facingY, p.facingX);
    const dark = flash ? '#fff' : '#05070d';
    const TAU = Engine.TAU;

    // soft glow under the fighter (visibility on dark floors)
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(56,232,255,0.20)';
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.5, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(ang);

    // engine exhaust (rear, -x)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(56,232,255,0.6)';
    ctx.beginPath(); ctx.ellipse(-r * 1.05, 0, r * 0.55, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.restore();

    // torso (jumpsuit; lightens/metallises with armour)
    ctx.fillStyle = flash ? '#fff' : (armor >= 4 ? '#ccd6e6' : armor >= 2 ? '#aeb8ca' : '#98a1b6');
    roundRect(ctx, -r * 0.85, -r * 0.72, r * 1.6, r * 1.44, r * 0.55); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = flash ? '#fff' : 'rgba(56,232,255,0.5)'; ctx.stroke();

    // weapon held forward
    ctx.fillStyle = flash ? '#fff' : '#5a6478'; ctx.fillRect(r * 0.35, r * 0.12, r * 1.05, r * 0.36);
    ctx.fillStyle = flash ? '#fff' : '#39404f'; ctx.fillRect(r * 1.15, r * 0.16, r * 0.28, r * 0.28);

    // back plate (armour 5+)
    if (armor >= 5) { ctx.fillStyle = flash ? '#fff' : '#7fd8ff'; roundRect(ctx, -r * 0.82, -r * 0.45, r * 0.4, r * 0.9, r * 0.2); ctx.fill(); }
    // shoulder pads (armour 3+)
    if (armor >= 3) {
      ctx.fillStyle = flash ? '#fff' : '#38e8ff';
      ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.78, r * 0.4, 0, TAU); ctx.arc(-r * 0.15, r * 0.78, r * 0.4, 0, TAU); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = dark; ctx.stroke();
    }
    // chest plate (armour 2+)
    if (armor >= 2) {
      ctx.fillStyle = flash ? '#fff' : '#57c2dc';
      roundRect(ctx, -r * 0.25, -r * 0.5, r * 0.95, r * 1.0, r * 0.3); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = dark; ctx.stroke();
    }

    // head / helmet (front, +x)
    ctx.beginPath(); ctx.arc(r * 0.5, 0, r * 0.5, 0, TAU);
    ctx.fillStyle = flash ? '#fff' : (armor >= 1 ? '#cdd8e8' : '#e6c79a'); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = dark; ctx.stroke();
    if (armor >= 1) { ctx.fillStyle = flash ? '#fff' : '#38e8ff'; ctx.fillRect(r * 0.66, -r * 0.26, r * 0.26, r * 0.52); }

    ctx.restore();

    // invulnerability bubble (Blink / Deflector)
    if (p.invuln > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(159,240,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.5, 0, TAU); ctx.stroke(); ctx.restore();
    }
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
      if (b.locked) {
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Engine.TAU);
        ctx.fillStyle = 'rgba(12,18,28,0.6)'; ctx.fill();
        ctx.strokeStyle = 'rgba(94,119,160,0.4)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(120,150,190,0.45)'; ctx.font = `${Math.floor(b.r * 0.8)}px system-ui`;
        ctx.fillText(b.icon, b.x, b.y + 2);
        continue;
      }
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

  function drawWarp(ctx, game) {
    const W = global.Engine.width, escaping = game.phase === 'ESCAPE';
    const bw = Math.min(220, W - 160), bx = (W - bw) / 2, by = 62, bh = 7;
    ctx.fillStyle = 'rgba(84,255,159,0.15)'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = escaping ? '#54ff9f' : '#38a0ff';
    ctx.fillRect(bx, by, bw * Engine.clamp(game.warp, 0, 1), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    ctx.fillStyle = 'rgba(180,210,255,0.85)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(escaping ? 'WARP READY — REACH THE AIRLOCK' : `WARP DRIVE ${Math.floor(game.warp * 100)}%`, W / 2, by - 3);
    ctx.textAlign = 'start';
  }

  function drawBanner(ctx, game) {
    const b = game.banner;
    if (!b || b.life <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life);
    ctx.fillStyle = '#ff5a6e'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(b.text, global.Engine.width / 2, global.Engine.height * 0.26);
    ctx.restore(); ctx.textAlign = 'start';
  }

  function drawEscapeArrow(ctx, game) {
    if (game.phase !== 'ESCAPE') return;
    const ex = game.map.exit, p = game.player;
    const s = global.Engine.worldToScreen(ex.x, ex.y);
    const W = global.Engine.width, H = global.Engine.height, m = 44;
    if (s.x > m && s.x < W - m && s.y > m && s.y < H - m) return; // on screen
    const ang = Math.atan2(ex.y - p.y, ex.x - p.x);
    const cx = Engine.clamp(s.x, m, W - m), cy = Engine.clamp(s.y, m, H - m);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    ctx.fillStyle = '#54ff9f';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
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
    drawMines(ctx, game);
    drawProjectiles(ctx, game);
    drawEnemyProjectiles(ctx, game);
    drawSentries(ctx, game);
    drawEnemies(ctx, game);
    drawOrbiters(ctx, game);
    drawEffectsWorld(ctx, game);
    drawPlayer(ctx, game);
    ctx.restore();

    // screen space
    drawFlash(ctx, game);
    drawXpBar(ctx, game);
    drawWarp(ctx, game);
    drawHUDOverlay(ctx, game);
    drawBanner(ctx, game);
    drawEscapeArrow(ctx, game);
    drawButtons(ctx, game);
  };

  global.Render = Render;
  if (typeof module !== 'undefined' && module.exports) module.exports = Render;
})(typeof window !== 'undefined' ? window : globalThis);
