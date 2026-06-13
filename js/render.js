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

    const theme = map.theme || {};
    // floor panels
    ctx.fillStyle = theme.floor || '#0b1422';
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (map.isWallTile(tx, ty)) continue;
        ctx.fillRect(tx * t, ty * t, t, t);
      }
    }
    // faint inner grid
    ctx.strokeStyle = theme.grid || 'rgba(56,232,255,0.06)';
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
    ctx.strokeStyle = theme.edge || 'rgba(56,232,255,0.55)';
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
      ctx.fillText((game.stageDef && game.stageDef.exitLabel) || 'AIRLOCK', ex.x, ex.y - 36);
      // cycling progress while the pad is held
      if (game.exitHold > 0) {
        const frac = Math.min(1, game.exitHold / 6);
        ctx.strokeStyle = '#54ff9f'; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, 34, -Math.PI / 2, -Math.PI / 2 + Engine.TAU * frac);
        ctx.stroke();
        ctx.fillText(`CYCLING ${Math.floor(frac * 100)}%`, ex.x, ex.y + 50);
      }
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

  function drawPickups(ctx, game) {
    const list = game.pickups ? game.pickups.active : null;
    if (!list || !list.length) return;
    const t = game.timeSec, S = global.Sprites;
    const pk = (S && S.ready && S.pack) ? S.pack : null;
    for (let i = 0; i < list.length; i++) {
      const hp = list[i];
      const pulse = 0.5 + 0.5 * Math.sin(t * 5 + hp.x * 0.05);
      const bob = Math.sin(t * 3 + hp.x * 0.07) * 1.5;
      const blink = hp.life < 4 ? (Math.sin(t * 16) > 0 ? 0.3 : 1) : 1; // flash before expiring
      ctx.save();
      ctx.globalAlpha = blink;
      // red medical glow
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(232,58,72,${0.16 + 0.14 * pulse})`;
      ctx.beginPath(); ctx.arc(hp.x, hp.y + bob, hp.r + 6 + 3 * pulse, 0, Engine.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      const frame = pulse > 0.6 ? 1 : 0;
      const spr = pk && pk[frame];
      if (spr && spr.img) {
        const scale = (hp.r * 2.4) / spr.w;
        const w = spr.w * scale, h = spr.h * scale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr.img, hp.x - w / 2, hp.y + bob - h / 2, w, h);
      } else {
        // procedural fallback: white case + red cross
        ctx.fillStyle = '#eef5fa';
        ctx.strokeStyle = '#0a0d18'; ctx.lineWidth = 1.5;
        const s = hp.r;
        ctx.beginPath(); ctx.rect(hp.x - s, hp.y + bob - s * 0.8, s * 2, s * 1.6); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#e83a48'; ctx.lineWidth = 2.6;
        const a = s * 0.55;
        ctx.beginPath();
        ctx.moveTo(hp.x - a, hp.y + bob); ctx.lineTo(hp.x + a, hp.y + bob);
        ctx.moveTo(hp.x, hp.y + bob - a); ctx.lineTo(hp.x, hp.y + bob + a);
        ctx.stroke();
      }
      ctx.restore();
    }
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
    const list = game.enemies.active, S = global.Sprites, t = game.timeSec, px = game.player.x;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      // bosses collide small (to fit corridors) but draw large (to read as bosses)
      const vr = e.boss ? e.r * 2.5 : e.r;
      const set = (S && S.ready && S.enemy) ? S.enemy[e.type] : null;
      let drew = false;
      if (set) {
        const frame = (((Math.floor(t * 5 + e.x * 0.05)) % 2) + 2) % 2; // 2-frame, phased by position
        const spr = set[frame] || set[0];
        if (spr) {
          const scale = (vr * 2.4) / spr.h;
          const sw = spr.w * scale, sh = spr.h * scale;
          const img = e.hitFlash > 0 ? spr.white : spr.img;
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          if (e.ghost) ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 5 + e.x * 0.04); // spectral shimmer
          ctx.translate(e.x, e.y);
          if (px < e.x) ctx.scale(-1, 1); // face the player
          ctx.drawImage(img, -sw / 2, -sh * 0.55, sw, sh);
          ctx.restore();
          drew = true;
        }
      }
      if (!drew) {
        if (e.ghost) ctx.globalAlpha = 0.55 + 0.2 * Math.sin(t * 5 + e.x * 0.04); // spectral shimmer
        pathShape(ctx, e.shape, e.x, e.y, vr);
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color; ctx.fill();
        ctx.lineWidth = e.boss ? 3 : 1.5;
        ctx.strokeStyle = e.boss ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)'; ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (e.elite) { // gold pulse ring: juicy bounty, worth the risk
        const pulse = 0.55 + 0.35 * Math.sin(t * 6 + e.x * 0.03);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,209,102,${pulse})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, Engine.TAU); ctx.stroke();
        ctx.restore();
      }
      if (e.stun > 0) {
        ctx.fillStyle = '#bff7ff';
        ctx.beginPath(); ctx.arc(e.x, e.y - e.r - 4, 2, 0, Engine.TAU); ctx.fill();
      }
      if (e.boss) {
        const w = vr * 2.2, frac = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - w / 2, e.y - vr - 16, w, 5);
        ctx.fillStyle = '#ff5a6e'; ctx.fillRect(e.x - w / 2, e.y - vr - 16, w * frac, 5);
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

  // weapon caches: gold supply crates beckoning from the far rooms
  function drawCaches(ctx, game) {
    const list = game.caches;
    if (!list || !list.length) return;
    const t = game.timeSec;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (c.taken) continue;
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i * 2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,209,102,${0.10 + 0.12 * pulse})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 22 + 6 * pulse, 0, Engine.TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#2a2316';
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
      ctx.fillRect(c.x - 11, c.y - 9, 22, 18);
      ctx.strokeRect(c.x - 11, c.y - 9, 22, 18);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦', c.x, c.y + 1);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    }
  }

  // survivors: waiting ones ping for help; followers trail you with a health pip
  function drawSurvivors(ctx, game) {
    const list = game.survivors;
    if (!list || !list.length) return;
    const t = game.timeSec;
    for (const s of list) {
      if (s.state === 'dead') continue;
      if (s.state === 'waiting') {
        const ping = (t % 1.4) / 1.4;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(127,216,255,${0.7 * (1 - ping)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, 14 + ping * 30, 0, Engine.TAU); ctx.stroke();
        ctx.restore();
      }
      const S = global.Sprites;
      const set = (S && S.ready && S.crew && S.crew.length) ? S.crew : null;
      const frame = s.state === 'waiting' ? (Math.floor(t * 2.5) % 2)          // waving for help
        : (Math.floor(t * 5 + s.x * 0.05) % 2);                                // jogging along
      const spr = set && (set[frame] || set[0]);
      if (spr && spr.img) {
        const scale = (s.r * 2.6) / spr.h;
        const sw = spr.w * scale, sh = spr.h * scale;
        const bob = s.state === 'following' ? -Math.abs(Math.sin(t * 9 + s.x * 0.1)) * 2 : 0;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(spr.img, s.x - sw / 2, s.y + bob - sh * 0.62, sw, sh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#10324a';
        ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Engine.TAU); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#7fd8ff';
      ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(s.state === 'waiting' ? 'SOS' : s.name.split(' ').pop(), s.x, s.y - s.r - 14);
      ctx.textAlign = 'start';
      if (s.state === 'following' && s.hp < s.maxHp) {
        const w = s.r * 2, frac = Math.max(0, s.hp / s.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(s.x - w / 2, s.y + s.r + 4, w, 3);
        ctx.fillStyle = '#7fd8ff'; ctx.fillRect(s.x - w / 2, s.y + s.r + 4, w * frac, 3);
      }
    }
  }

  // hull-breach vents: subtle grate when idle, amber warning, violent suction
  function drawVents(ctx, game) {
    const list = game.vents;
    if (!list || !list.length) return;
    const t = game.timeSec;
    for (const v of list) {
      ctx.save();
      if (v.phase === 'idle') {
        ctx.strokeStyle = 'rgba(150,170,200,0.30)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(v.x, v.y, 12, 0, Engine.TAU); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(v.x - 7, v.y); ctx.lineTo(v.x + 7, v.y);
        ctx.moveTo(v.x, v.y - 7); ctx.lineTo(v.x, v.y + 7);
        ctx.stroke();
      } else if (v.phase === 'warn') {
        const flash = Math.sin(t * 14) > 0;
        ctx.strokeStyle = flash ? '#ffb347' : 'rgba(255,179,71,0.35)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(v.x, v.y, 16, 0, Engine.TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,179,71,0.25)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(v.x, v.y, 130, 0, Engine.TAU); ctx.stroke();
      } else { // venting: collapsing suction rings + streaks
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 3; k++) {
          const ring = 1 - ((t * 1.4 + k / 3) % 1);
          ctx.strokeStyle = `rgba(160,200,255,${0.45 * (1 - ring)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(v.x, v.y, 12 + ring * 118, 0, Engine.TAU); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(220,240,255,0.8)'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(v.x, v.y, 12, 0, Engine.TAU); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // boss mortar telegraphs: crimson targeting reticle that fills as impact nears
  function drawSlams(ctx, game) {
    const list = game.slams;
    if (!list || !list.length) return;
    ctx.save();
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const prog = Math.min(1, s.t / s.delay);
      // outer ring
      ctx.strokeStyle = `rgba(255,59,94,${0.35 + 0.5 * prog})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Engine.TAU); ctx.stroke();
      // collapsing aim ring + filling core
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * (1 - prog * 0.85), 0, Engine.TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,59,94,${0.10 + 0.22 * prog})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.radius * prog, 0, Engine.TAU); ctx.fill();
      // rotating crosshair ticks
      const a0 = prog * 3;
      ctx.lineWidth = 2.5;
      for (let k = 0; k < 4; k++) {
        const a = a0 + k * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(s.x + Math.cos(a) * (s.radius - 9), s.y + Math.sin(a) * (s.radius - 9));
        ctx.lineTo(s.x + Math.cos(a) * (s.radius + 5), s.y + Math.sin(a) * (s.radius + 5));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawOrbiters(ctx, game) {
    const players = game.players || [game.player];
    const ws = [];
    for (const pl of players) ws.push(...pl.weapons);
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

  // Player = Ace, a pixel-art space fighter drawn billboard-style (upright, flips L/R).
  // Walk-animates when moving; armour tier swaps the sprite (basic / armored / heavy).
  function drawPlayers(ctx, game) {
    const players = game.players || [game.player];
    for (const p of players) drawPlayer(ctx, game, p);
  }
  function drawPlayer(ctx, game, p) {
    const r = p.r, TAU = Engine.TAU, S = global.Sprites;
    if (p.dead) { // downed partner: a fading beacon where they fell
      ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(game.timeSec * 6);
      ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#7fd8ff';
      ctx.fillText(Math.ceil(p.respawn) + 's', p.x, p.y - r - 6);
      ctx.textAlign = 'start'; ctx.restore();
      return;
    }
    // co-op: ring under the partner so the two fighters read apart
    if (game.players && game.players.length > 1 && p !== game.localPlayer) {
      ctx.save(); ctx.strokeStyle = 'rgba(255,209,102,0.75)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.95, r * 1.05, r * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    // drop shadow at the feet
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + r * 0.95, r * 0.85, r * 0.38, 0, 0, TAU); ctx.fill();
    ctx.restore();

    let drew = false;
    if (S && S.ready && S.ace) {
      const set = S.ace[S.tierFor(p.armor || 0)] || S.ace.basic;
      const frame = p.moving ? (1 + (Math.floor(p.animTime * 9) % 4)) : 0; // 4-frame walk
      const spr = set[frame] || set[0];
      if (spr) {
        const scale = (r * 2.8) / spr.h;
        const sw = spr.w * scale, sh = spr.h * scale;
        const bob = p.moving ? -Math.abs(Math.sin(p.animTime * 9)) * 2 : 0;
        const img = p.hitFlash > 0 ? spr.white : spr.img;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(p.x, p.y + bob);
        if (p.faceLeft) ctx.scale(-1, 1);
        ctx.drawImage(img, -sw / 2, -sh * 0.62, sw, sh); // anchor feet near p.y
        ctx.restore();
        drew = true;
      }
    }
    if (!drew) { // fallback while sprites load
      ctx.fillStyle = p.hitFlash > 0 ? '#fff' : '#3a5a8f';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#38e8ff'; ctx.stroke();
    }

    // invulnerability bubble (Blink / Deflector)
    if (p.invuln > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(159,240,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.6, 0, TAU); ctx.stroke(); ctx.restore();
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
      } else if (e.type === 'muzzle') {
        ctx.globalAlpha = Math.max(0, e.life / e.maxLife);
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        ctx.fillStyle = e.color || '#fff2b0';
        ctx.beginPath(); ctx.moveTo(0, -3.5); ctx.lineTo(14, 0); ctx.lineTo(0, 3.5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(3, 0, 3, 0, Engine.TAU); ctx.fill();
        ctx.restore();
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
    const p = game.localPlayer || game.player, W = global.Engine.width;
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
    const p = game.localPlayer || game.player, W = global.Engine.width;
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

  // greedily break text into lines that fit within maxW (canvas has no wrapping)
  function wrapText(ctx, text, maxW) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line); line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawBanner(ctx, game) {
    const b = game.banner;
    if (!b || b.life <= 0) return;
    const W = global.Engine.width, H = global.Engine.height;
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life);
    ctx.fillStyle = b.color || '#ff5a6e'; ctx.textAlign = 'center';
    // shrink the font on narrow screens so wrapped story text stays readable
    const fontPx = W < 420 ? 15 : 18;
    ctx.font = `bold ${fontPx}px system-ui`;
    const lines = wrapText(ctx, b.text, W * 0.9);
    const lineH = fontPx * 1.3;
    let y = H * 0.26 - (lines.length - 1) * lineH / 2;
    for (let i = 0; i < lines.length; i++) { ctx.fillText(lines[i], W / 2, y); y += lineH; }
    ctx.restore(); ctx.textAlign = 'start';
  }

  function drawEscapeArrow(ctx, game) {
    if (game.phase !== 'ESCAPE') return;
    const ex = game.map.exit, p = game.localPlayer || game.player;
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

    let shx = 0, shy = 0;
    if (Engine.shakeTime > 0) { shx = (Math.random() - 0.5) * 2 * Engine.shakeMag; shy = (Math.random() - 0.5) * 2 * Engine.shakeMag; }

    ctx.save();
    ctx.translate(Math.round(W / 2 - cam.x + shx), Math.round(H / 2 - cam.y + shy)); // world space
    drawMap(ctx, game);
    drawVents(ctx, game);
    drawExit(ctx, game);
    drawCaches(ctx, game);
    drawCrystals(ctx, game);
    drawPickups(ctx, game);
    drawMines(ctx, game);
    drawSlams(ctx, game);
    drawSurvivors(ctx, game);
    drawProjectiles(ctx, game);
    drawEnemyProjectiles(ctx, game);
    drawSentries(ctx, game);
    drawEnemies(ctx, game);
    drawOrbiters(ctx, game);
    drawEffectsWorld(ctx, game);
    drawPlayers(ctx, game);
    if (global.Particles) global.Particles.draw(ctx, game);
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
