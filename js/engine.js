/* engine.js — core: math, RNG, canvas, input, camera, spatial hash, flow field, game loop.
 * Pure helpers (math/RNG/SpatialHash/FlowField) are Node-safe; browser bits guard on `window`. */
(function (global) {
  'use strict';

  const Engine = {};
  const hasDOM = typeof document !== 'undefined';

  /* ---------------- Math ---------------- */
  Engine.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  Engine.lerp = (a, b, t) => a + (b - a) * t;
  Engine.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  Engine.dist = (ax, ay, bx, by) => Math.sqrt(Engine.dist2(ax, ay, bx, by));
  Engine.len = (x, y) => Math.sqrt(x * x + y * y);
  Engine.normalize = (x, y) => { const l = Math.sqrt(x * x + y * y); return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 }; };
  Engine.TAU = Math.PI * 2;

  /* ---------------- RNG (mulberry32, seedable) ---------------- */
  Engine.makeRng = function (seed) {
    let a = (seed >>> 0) || 1;
    const fn = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    fn.range = (lo, hi) => lo + fn() * (hi - lo);
    fn.int = (lo, hi) => Math.floor(lo + fn() * (hi - lo + 1)); // inclusive
    fn.pick = (arr) => arr[Math.floor(fn() * arr.length)];
    fn.chance = (p) => fn() < p;
    return fn;
  };
  // default instance; reseeded at run start
  Engine.rng = Engine.makeRng(12345);
  Engine.seed = (s) => { Engine.rng = Engine.makeRng(s >>> 0); return Engine.rng; };

  /* ---------------- Spatial hash ---------------- */
  class SpatialHash {
    constructor(cellSize = 64) { this.cell = cellSize; this.map = new Map(); }
    _key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
    clear() { this.map.clear(); }
    insert(obj) {
      const cx = Math.floor(obj.x / this.cell), cy = Math.floor(obj.y / this.cell);
      const k = this._key(cx, cy);
      let bucket = this.map.get(k);
      if (!bucket) { bucket = []; this.map.set(k, bucket); }
      bucket.push(obj);
    }
    // calls cb(obj) for every inserted object within `r` of (x,y) — including a few extra in range cells
    queryCircle(x, y, r, cb) {
      const c = this.cell;
      const mincx = Math.floor((x - r) / c), maxcx = Math.floor((x + r) / c);
      const mincy = Math.floor((y - r) / c), maxcy = Math.floor((y + r) / c);
      for (let cx = mincx; cx <= maxcx; cx++) {
        for (let cy = mincy; cy <= maxcy; cy++) {
          const bucket = this.map.get(this._key(cx, cy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) cb(bucket[i]);
        }
      }
    }
  }
  Engine.SpatialHash = SpatialHash;

  /* ---------------- Flow field (BFS toward a target tile) ----------------
   * Construct with a map exposing { cols, rows, isWallTile(tx,ty) }.
   * compute(tx,ty) runs a BFS; dirAt(tx,ty) returns a unit {x,y} pointing toward the target. */
  class FlowField {
    constructor(map) {
      this.map = map;
      this.cols = map.cols; this.rows = map.rows;
      const n = this.cols * this.rows;
      this.dist = new Int32Array(n);
      this.dirX = new Float32Array(n);
      this.dirY = new Float32Array(n);
      this._queue = new Int32Array(n);
      this.targetTX = -1; this.targetTY = -1;
    }
    idx(tx, ty) { return ty * this.cols + tx; }
    compute(tx, ty) {
      const { cols, rows, map } = this;
      if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;
      // snap target to a non-wall tile if needed
      if (map.isWallTile(tx, ty)) {
        let found = false;
        for (let r = 1; r < 4 && !found; r++) {
          for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
            const nx = tx + dx, ny = ty + dy;
            if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && !map.isWallTile(nx, ny)) { tx = nx; ty = ny; found = true; }
          }
        }
        if (!found) return;
      }
      this.targetTX = tx; this.targetTY = ty;
      const dist = this.dist; dist.fill(-1);
      const q = this._queue; let head = 0, tail = 0;
      const start = this.idx(tx, ty);
      dist[start] = 0; q[tail++] = start;
      // 4-connected BFS distance
      while (head < tail) {
        const cur = q[head++];
        const cy = (cur / cols) | 0, cx = cur - cy * cols;
        const d = dist[cur] + 1;
        // neighbors
        if (cx > 0) { const ni = cur - 1; if (dist[ni] < 0 && !map.isWallTile(cx - 1, cy)) { dist[ni] = d; q[tail++] = ni; } }
        if (cx < cols - 1) { const ni = cur + 1; if (dist[ni] < 0 && !map.isWallTile(cx + 1, cy)) { dist[ni] = d; q[tail++] = ni; } }
        if (cy > 0) { const ni = cur - cols; if (dist[ni] < 0 && !map.isWallTile(cx, cy - 1)) { dist[ni] = d; q[tail++] = ni; } }
        if (cy < rows - 1) { const ni = cur + cols; if (dist[ni] < 0 && !map.isWallTile(cx, cy + 1)) { dist[ni] = d; q[tail++] = ni; } }
      }
      // direction = toward the 8-neighbour with the smallest distance (no corner cutting)
      const dirX = this.dirX, dirY = this.dirY;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          const i = cy * cols + cx;
          if (dist[i] < 0) { dirX[i] = 0; dirY[i] = 0; continue; }
          let best = dist[i], bx = 0, by = 0;
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              if (ox === 0 && oy === 0) continue;
              const nx = cx + ox, ny = cy + oy;
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              if (map.isWallTile(nx, ny)) continue;
              // prevent diagonal corner-cutting
              if (ox !== 0 && oy !== 0 && (map.isWallTile(cx + ox, cy) || map.isWallTile(cx, cy + oy))) continue;
              const nd = dist[ny * cols + nx];
              if (nd >= 0 && nd < best) { best = nd; bx = ox; by = oy; }
            }
          }
          const l = Math.sqrt(bx * bx + by * by);
          if (l > 0) { dirX[i] = bx / l; dirY[i] = by / l; } else { dirX[i] = 0; dirY[i] = 0; }
        }
      }
    }
    dirAtTile(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return { x: 0, y: 0 };
      const i = ty * this.cols + tx;
      return { x: this.dirX[i], y: this.dirY[i] };
    }
    reachable(tx, ty) {
      if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
      return this.dist[ty * this.cols + tx] >= 0;
    }
  }
  Engine.FlowField = FlowField;

  /* ---------------- Canvas ---------------- */
  Engine.canvas = null; Engine.ctx = null;
  Engine.width = 0; Engine.height = 0; Engine.dpr = 1;
  Engine.initCanvas = function (canvas) {
    Engine.canvas = canvas;
    Engine.ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = Math.min(global.devicePixelRatio || 1, 2);
      Engine.dpr = dpr;
      Engine.width = global.innerWidth;
      Engine.height = global.innerHeight;
      canvas.width = Math.floor(Engine.width * dpr);
      canvas.height = Math.floor(Engine.height * dpr);
      canvas.style.width = Engine.width + 'px';
      canvas.style.height = Engine.height + 'px';
      Engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    };
    resize();
    global.addEventListener('resize', resize);
    Engine.input.attach(canvas);
  };

  /* ---------------- Camera ---------------- */
  Engine.camera = { x: 0, y: 0 };
  Engine.worldToScreen = (wx, wy) => ({ x: wx - Engine.camera.x + Engine.width / 2, y: wy - Engine.camera.y + Engine.height / 2 });
  Engine.screenToWorld = (sx, sy) => ({ x: sx + Engine.camera.x - Engine.width / 2, y: sy + Engine.camera.y - Engine.height / 2 });

  /* ---------------- Input ---------------- */
  const input = {
    keys: {},
    joyActive: false, joyId: null,
    joyOriginX: 0, joyOriginY: 0, joyCurX: 0, joyCurY: 0,
    joyVecX: 0, joyVecY: 0,           // normalized move from joystick
    maxRadius: 60,
    actionRegions: [],                // [{id,x,y,r}] screen-space ability buttons (Phase 1+)
    taps: [],                         // queued action ids tapped this frame (buttons)
    keyTaps: [],                      // queued keys newly pressed this frame (edge)
    attach(canvas) {
      global.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (!this.keys[k]) this.keyTaps.push(k);   // edge: first press only
        this.keys[k] = true;
        if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      }, { passive: false });
      global.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
      const opt = { passive: false };
      canvas.addEventListener('pointerdown', (e) => this.onDown(e), opt);
      canvas.addEventListener('pointermove', (e) => this.onMove(e), opt);
      canvas.addEventListener('pointerup', (e) => this.onUp(e), opt);
      canvas.addEventListener('pointercancel', (e) => this.onUp(e), opt);
    },
    _hitAction(sx, sy) {
      for (const reg of this.actionRegions) {
        const dx = sx - reg.x, dy = sy - reg.y;
        if (dx * dx + dy * dy <= reg.r * reg.r) return reg.id;
      }
      return null;
    },
    onDown(e) {
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY;
      const hit = this._hitAction(sx, sy);
      if (hit) { this.taps.push(hit); return; }
      // left ~60% of screen → movement joystick
      if (sx < Engine.width * 0.6 && !this.joyActive) {
        this.joyActive = true; this.joyId = e.pointerId;
        this.joyOriginX = sx; this.joyOriginY = sy;
        this.joyCurX = sx; this.joyCurY = sy;
        this.joyVecX = 0; this.joyVecY = 0;
      }
    },
    onMove(e) {
      if (!this.joyActive || e.pointerId !== this.joyId) return;
      e.preventDefault();
      this.joyCurX = e.clientX; this.joyCurY = e.clientY;
      let dx = this.joyCurX - this.joyOriginX, dy = this.joyCurY - this.joyOriginY;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l > this.maxRadius) { dx = dx / l * this.maxRadius; dy = dy / l * this.maxRadius; }
      this.joyVecX = dx / this.maxRadius; this.joyVecY = dy / this.maxRadius;
    },
    onUp(e) {
      if (this.joyActive && e.pointerId === this.joyId) {
        this.joyActive = false; this.joyId = null;
        this.joyVecX = 0; this.joyVecY = 0;
      }
    },
    // combined movement vector (magnitude <= 1)
    moveVector() {
      let x = 0, y = 0;
      if (this.joyActive) { x = this.joyVecX; y = this.joyVecY; }
      else {
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        const l = Math.sqrt(x * x + y * y);
        if (l > 1) { x /= l; y /= l; }
      }
      return { x, y };
    },
    consumeTaps() { const t = this.taps; this.taps = []; return t; },
    consumeKeyTaps() { const t = this.keyTaps; this.keyTaps = []; return t; }
  };
  Engine.input = input;

  /* ---------------- Game loop (fixed timestep) ---------------- */
  Engine.STEP = 1 / 60;
  Engine.time = 0;        // accumulated sim time (seconds), advances only while running & !paused
  Engine.frame = 0;
  Engine.running = false;
  Engine.paused = false;
  let _update = null, _render = null, _acc = 0, _last = 0;

  Engine.start = function (update, render) {
    _update = update; _render = render;
    Engine.running = true;
    _last = (hasDOM && global.performance) ? performance.now() : 0;
    _acc = 0;
    requestAnimationFrame(Engine._tick);
  };
  Engine.stop = function () { Engine.running = false; };

  Engine._tick = function (now) {
    if (!Engine.running) return;
    let dt = (now - _last) / 1000;
    _last = now;
    if (dt > 0.25) dt = 0.25; // clamp huge gaps (tab switch)
    if (!Engine.paused) {
      _acc += dt;
      let steps = 0;
      while (_acc >= Engine.STEP && steps < 5) {
        _update(Engine.STEP);
        Engine.time += Engine.STEP;
        Engine.frame++;
        _acc -= Engine.STEP;
        steps++;
        if (Engine.paused) { _acc = 0; break; } // update opened a modal etc. — stop simulating this frame
      }
      if (steps === 5) _acc = 0; // avoid spiral of death
    }
    _render();
    requestAnimationFrame(Engine._tick);
  };

  global.Engine = Engine;
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
