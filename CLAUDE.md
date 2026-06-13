# Perils — Claude Instructions

## Project Overview

**Perils** is a mobile-first sci-fi **"bullet heaven" survivor** game (Vampire Survivors-inspired),
played in the browser and deployed on **GitHub Pages**. You're the last crew member on a doomed
ship: weapons auto-fire, you move and tap abilities, surviving an escalating siege on a
**procedurally generated spaceship** until the warp drive charges — then you fight to the airlock.

Built with **vanilla HTML/CSS/JS + Canvas 2D** — no frameworks, no build system, no dependencies.
Files are loaded directly by the browser. Same philosophy as the Dragon Cards project.

## Key Documents

- **GAME_VISION.md** — Creative direction: setting, worlds, controls, abilities, run structure, scope.
- **DESIGN_PRINCIPLES.md** — Design pillars, ablation/sim methodology, anti-patterns.
- **TODO.md** — Current priorities and known issues.

## Architecture

### Real-time, not turn-based
Unlike Dragon Cards (turn-based, DOM-rendered), Perils is **real-time** with a fixed-timestep game
loop and **Canvas 2D rendering**. Hundreds of entities → never use DOM elements for game objects.
Core performance techniques: **object pooling**, **spatial hash grid** for collisions, **flow-field
pathfinding** for the horde.

### File Structure
```
index.html        — Entry point, canvas, loads all scripts in order
styles.css        — HUD, menus, mobile layout (neon-on-dark theme)
js/engine.js      — Fixed-timestep loop, camera, input (joystick + keys), spatial hash, flow field
js/mapgen.js      — Procedural spaceship generator (rooms/corridors/doors/vents) + tile grid + collision
js/render.js      — Canvas drawing: tiles, geometric entities, effects (ISOLATED so PixiJS can swap in)
js/entities.js    — Pooled Player / Enemy / Projectile / Crystal / Pickup
js/weapons.js     — Weapon definitions, auto-fire logic, evolutions
js/abilities.js   — Blink, Specials (EMP/Deflector/Overload/Sentry/TimeDilation), Ultimate
js/enemies.js     — Enemy archetypes + spawn director (escalation, bosses, vent/door spawns)
js/upgrades.js    — Level-up choice pool (weapons / passives / abilities)
js/meta.js        — Salvage, world unlocks, permanent upgrades (localStorage)
js/ui.js          — HUD, level-up modal, menus, game over / victory
js/game.js        — Run lifecycle, world progression, state, wiring
sim.js            — Headless balance bot (Node) — survival-time / escape-rate ablation testing
generate_art.py   — (later) sprite generation if we move beyond geometric shapes
manifest.json     — PWA manifest
```

### Script Loading Order (critical — scripts share globals)
1. `engine.js`    (loop, input, camera, spatial hash, flow field)
2. `mapgen.js`    (uses engine grid helpers)
3. `render.js`    (draws engine/map/entity state)
4. `entities.js`  (pooled game objects)
5. `weapons.js`   (creates projectiles)
6. `abilities.js` (uses player + entities)
7. `enemies.js`   (uses entities + flow field)
8. `upgrades.js`  (references weapons/passives/abilities)
9. `meta.js`      (localStorage)
10. `ui.js`       (renders HUD/modals)
11. `game.js`     (orchestrates everything — last)

### Key Globals
- `game` — the entire run state (single mutable source of truth): player, entity pools, time,
  warp charge, phase, camera, current map.
- `MAP` — current procedural ship: tile grid, walls, rooms, exit, flow field.
- `WEAPONS`, `ENEMIES`, `ABILITIES`, `PASSIVES` — content definition tables.
- Render is a pure function of state: `render(game)` called once per frame after `update(dt)`.

### Game Phases
`MENU` → `PLAYING` (siege) → `ESCAPE` (warp ready, reach airlock) → `VICTORY` / `GAME_OVER`.
Level-up pauses into a `LEVELUP` overlay without leaving `PLAYING`.

### Coordinate Systems
- **World space:** pixels in the ship. Entities live here. Camera is a world-space rect.
- **Tile space:** `mapgen` grid (e.g. 32px tiles). Walls, generation, and the flow field are tile-based.
- **Screen space:** canvas pixels. `render.js` converts world→screen via the camera. UI (HUD,
  joystick, buttons) is screen-space (drawn last, or as DOM overlays in `ui.js`).

## Development Practices

### Git Workflow
- **Do not push after every commit.** Batch commits; push only when the user explicitly asks.
- A pre-commit hook (`.githooks/pre-commit`) auto-bumps the patch version in `index.html`
  (GAME_VERSION + all `?v=` query strings). Enable once per clone with
  `git config core.hooksPath .githooks`.

### Version System
- Version in `index.html` as `GAME_VERSION` and `?v=X.Y.Z` query strings on all assets (cache-bust).

### Balance Testing (planned — Phase 4)
Run `node sim.js` to play headless runs with bots and measure median survival time + escape rate.
Ablate each mechanic; a mechanic that doesn't change survival time is decoration; one that *improves*
survival when removed is a trap. See DESIGN_PRINCIPLES.md for targets.

## Code Conventions

- **No frameworks, no build, no deps** — vanilla JS only; keep it deployable by `git push`.
- **Canvas 2D for all game objects** — never DOM elements for entities (DOM only for menus/HUD/buttons).
- **Object pooling** — never allocate enemies/projectiles/crystals mid-run; reuse from pools.
- **Globals are OK** — small game; `game` state is a mutable global. Don't over-engineer.
- **Mobile-first** — touch joystick + ability buttons; everything works one-handed-ish on a phone.
  Keyboard (WASD/arrows + ability keys) is a desktop freebie.
- **Neon-on-dark theme** — geometric shapes, glowing outlines. Danger = warm, player/allies = cool,
  XP = green, salvage = gold. Readable chaos is a hard requirement.
- **Keep `render.js` isolated** — all drawing in one module so a future PixiJS renderer can swap in
  without touching game logic.
- **Fixed timestep** — `update(dt)` runs at a fixed step (accumulator pattern) so physics/balance are
  deterministic and the sim matches the browser; rendering interpolates.

## Common Tasks

### Adding a weapon
1. Add definition to `WEAPONS` in `js/weapons.js` (cooldown, damage, fire pattern, level scaling).
2. Add its level-up entry to `upgrades.js`; assign a paired passive for its evolution.
3. (If evolving) define the evolved form and the pairing.
4. Balance-test with `sim.js`.

### Adding an enemy
1. Add archetype to `ENEMIES` in `js/enemies.js` (HP, speed, behavior, attack, color/shape).
2. Add it to the spawn director's wave tables with a time window.
3. Balance-test.

### Adding an ability (Special)
1. Add to `ABILITIES` in `js/abilities.js` (cooldown, effect, level scaling).
2. Add its pick + upgrade entries to `upgrades.js`.

### Tuning procedural generation
- Edit `mapgen.js` room/corridor parameters. **Always** keep the connectivity + exit-reachability
  validation; reject and regenerate any layout that fails.
