/* mapgen.js — procedural spaceship generator.
 * Carves rooms + corridors into a tile grid, guarantees connectivity, picks spawn + exit.
 * Tiles: 0 = wall, 1 = floor. Exposes wall queries + floor-tile sampling for spawning. */
(function (global) {
  'use strict';

  const WALL = 0, FLOOR = 1;

  function makeMap(cols, rows, tile) {
    const grid = new Uint8Array(cols * rows); // all wall
    const map = {
      cols, rows, tile,
      grid,
      worldW: cols * tile,
      worldH: rows * tile,
      rooms: [],
      spawn: { x: 0, y: 0 },
      exit: { tx: 0, ty: 0, x: 0, y: 0 },
      _floorTiles: null,

      idx(tx, ty) { return ty * cols + tx; },
      isWallTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return true;
        return grid[ty * cols + tx] === WALL;
      },
      isWallWorld(wx, wy) {
        return map.isWallTile(Math.floor(wx / tile), Math.floor(wy / tile));
      },
      tileAtWorld(wx, wy) { return { tx: Math.floor(wx / tile), ty: Math.floor(wy / tile) }; },
      tileCenterWorld(tx, ty) { return { x: (tx + 0.5) * tile, y: (ty + 0.5) * tile }; },

      randomFloorTile(rng) {
        const ft = map._floorTiles;
        const i = ft[Math.floor(rng() * ft.length)];
        return { tx: i % cols, ty: (i / cols) | 0 };
      },
      randomFloorWorld(rng) {
        const t = map.randomFloorTile(rng);
        return { x: (t.tx + 0.5) * tile, y: (t.ty + 0.5) * tile };
      },
      // pick a floor point whose distance from (cx,cy) world is within [minR,maxR]
      randomFloorRingWorld(rng, cx, cy, minR, maxR) {
        const ft = map._floorTiles;
        const min2 = minR * minR, max2 = maxR * maxR;
        for (let attempt = 0; attempt < 40; attempt++) {
          const i = ft[Math.floor(rng() * ft.length)];
          const tx = i % cols, ty = (i / cols) | 0;
          const x = (tx + 0.5) * tile, y = (ty + 0.5) * tile;
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (d2 >= min2 && d2 <= max2) return { x, y };
        }
        return map.randomFloorWorld(rng); // fallback
      }
    };
    return map;
  }

  function carveRect(map, x, y, w, h) {
    const { cols, rows, grid } = map;
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) {
        if (tx > 0 && ty > 0 && tx < cols - 1 && ty < rows - 1) grid[ty * cols + tx] = FLOOR;
      }
    }
  }
  function carveHCorridor(map, x1, x2, y, width) {
    const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
    for (let x = lo; x <= hi; x++) for (let w = 0; w < width; w++) {
      const ty = y + w;
      if (x > 0 && ty > 0 && x < map.cols - 1 && ty < map.rows - 1) map.grid[ty * map.cols + x] = FLOOR;
    }
  }
  function carveVCorridor(map, y1, y2, x, width) {
    const lo = Math.min(y1, y2), hi = Math.max(y1, y2);
    for (let y = lo; y <= hi; y++) for (let w = 0; w < width; w++) {
      const tx = x + w;
      if (tx > 0 && y > 0 && tx < map.cols - 1 && y < map.rows - 1) map.grid[y * map.cols + tx] = FLOOR;
    }
  }

  function roomsOverlap(a, b, pad) {
    return !(a.x - pad > b.x + b.w || a.x + a.w + pad < b.x || a.y - pad > b.y + b.h || a.y + a.h + pad < b.y);
  }

  // BFS distance over floor tiles from a start tile; returns {dist:Int32Array, reachable:count, farthest:index}
  function bfsFrom(map, startTx, startTy) {
    const { cols, rows, grid } = map;
    const dist = new Int32Array(cols * rows).fill(-1);
    const q = new Int32Array(cols * rows);
    let head = 0, tail = 0, reachable = 0, far = startTy * cols + startTx, farD = 0;
    const s = startTy * cols + startTx;
    dist[s] = 0; q[tail++] = s; reachable++;
    while (head < tail) {
      const cur = q[head++];
      const cy = (cur / cols) | 0, cx = cur - cy * cols, d = dist[cur] + 1;
      const tryN = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return;
        const ni = ny * cols + nx;
        if (dist[ni] < 0 && grid[ni] === FLOOR) {
          dist[ni] = d; q[tail++] = ni; reachable++;
          if (d > farD) { farD = d; far = ni; }
        }
      };
      tryN(cx - 1, cy); tryN(cx + 1, cy); tryN(cx, cy - 1); tryN(cx, cy + 1);
    }
    return { dist, reachable, farthest: far, farD };
  }

  function generateOnce(opts) {
    const rng = opts.rng;
    const cols = opts.cols, rows = opts.rows, tile = opts.tile;
    const map = makeMap(cols, rows, tile);

    // place non-overlapping rooms
    const targetRooms = opts.rooms;
    const rooms = [];
    let tries = 0;
    while (rooms.length < targetRooms && tries < targetRooms * 30) {
      tries++;
      const w = rng.int(opts.roomMin, opts.roomMax);
      const h = rng.int(opts.roomMin, opts.roomMax);
      const x = rng.int(2, cols - w - 2);
      const y = rng.int(2, rows - h - 2);
      const room = { x, y, w, h, cx: (x + (w >> 1)), cy: (y + (h >> 1)) };
      if (rooms.some(r => roomsOverlap(r, room, 1))) continue;
      rooms.push(room);
    }
    if (rooms.length < 2) return null;

    for (const r of rooms) carveRect(map, r.x, r.y, r.w, r.h);

    // connect rooms in a chain (guarantees connectivity), corridors width 2
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      if (rng.chance(0.5)) { carveHCorridor(map, a.cx, b.cx, a.cy, 2); carveVCorridor(map, a.cy, b.cy, b.cx, 2); }
      else { carveVCorridor(map, a.cy, b.cy, a.cx, 2); carveHCorridor(map, a.cx, b.cx, b.cy, 2); }
    }
    // a few extra loop connections so the player can circle
    const extra = Math.max(1, Math.floor(rooms.length / 3));
    for (let e = 0; e < extra; e++) {
      const a = rng.pick(rooms), b = rng.pick(rooms);
      if (a === b) continue;
      if (rng.chance(0.5)) { carveHCorridor(map, a.cx, b.cx, a.cy, 2); carveVCorridor(map, a.cy, b.cy, b.cx, 2); }
      else { carveVCorridor(map, a.cy, b.cy, a.cx, 2); carveHCorridor(map, a.cx, b.cx, b.cy, 2); }
    }

    map.rooms = rooms;
    map.spawn = map.tileCenterWorld(rooms[0].cx, rooms[0].cy);

    // BFS from spawn → validate connectivity, pick farthest tile as exit
    const bfs = bfsFrom(map, rooms[0].cx, rooms[0].cy);

    // count total floor & build floor-tile list
    const floorTiles = [];
    for (let i = 0; i < map.grid.length; i++) if (map.grid[i] === FLOOR) floorTiles.push(i);
    map._floorTiles = floorTiles;

    // require that almost all floor is reachable (no big isolated pockets)
    if (bfs.reachable < floorTiles.length * 0.95) return null;

    const ext = bfs.farthest;
    const etx = ext % cols, ety = (ext / cols) | 0;
    map.exit = { tx: etx, ty: ety, x: (etx + 0.5) * tile, y: (ety + 0.5) * tile };

    return map;
  }

  // Public: generate a validated map. Retries until valid.
  function generate(options) {
    const opts = Object.assign({
      cols: 72, rows: 52, tile: 32,
      rooms: 14, roomMin: 5, roomMax: 12,
      rng: (global.Engine ? global.Engine.rng : Math.random)
    }, options || {});
    for (let attempt = 0; attempt < 30; attempt++) {
      const m = generateOnce(opts);
      if (m) return m;
    }
    throw new Error('mapgen: failed to generate a valid map');
  }

  const MapGen = { generate, WALL, FLOOR, bfsFrom };
  global.MapGen = MapGen;
  if (typeof module !== 'undefined' && module.exports) module.exports = MapGen;
})(typeof window !== 'undefined' ? window : globalThis);
