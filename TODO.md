# Perils — TODO

## Phase 0 — Engine + procedural arena  ← IN PROGRESS
- [ ] `index.html` + `styles.css` scaffold (canvas, mobile layout, neon theme)
- [ ] `engine.js`: fixed-timestep loop, camera, input (touch joystick + WASD/arrows), spatial hash
- [ ] `mapgen.js`: procedural ship (rooms + corridors + doors), tile grid, wall collision, validation
- [ ] flow-field pathfinding (BFS from player over tile grid, periodic recompute)
- [ ] `render.js`: draw tiles + entities as geometric neon shapes, camera transform
- [ ] `entities.js`: pooled player / enemy / projectile
- [ ] Phase 0 playable: one chasing enemy (follows flow field), one auto-fire weapon
- [ ] **Goal check:** weaving through a generated ship dodging a swarm feels good

## Phase 1 — Core loop + abilities
- [ ] XP crystals drop on kill + magnet pickup
- [ ] Leveling + level-up modal (pick 1 of 3-4)
- [ ] HUD (HP, timer, level, XP bar, ult charge)
- [ ] Blink ability (dash + i-frames)
- [ ] Ultimate (charge from kills → Orbital Strike)
- [ ] Game-over screen + restart

## Phase 2 — Content + Special slot (MVP line)
- [ ] ~6 weapons (Pulse Blaster, Orbiter, Arc Coil, Mine Layer, Scatter Gun, Beam)
- [ ] ~6 passives (Engine, Hull, Coolant, Amplifier, Multiplier, Magnet)
- [ ] Special abilities: EMP, Deflector, Overload, Sentry, Time Dilation (build-chosen)
- [ ] ~4 enemy archetypes (Swarmer, Hulk, Spitter, Sprinter) + boss waves
- [ ] Spawn director: escalation over time, vent/door spawns
- [ ] Warp-drive charge meter + survive-then-escape run structure + victory

## Phase 3 — World structure + meta
- [ ] Banked salvage + permanent upgrades (localStorage)
- [ ] Weapon evolutions (max weapon + paired passive)
- [ ] 2nd character
- [ ] World completion → unlock World 2

## Phase 4 — Polish + infra
- [ ] Art/SFX pass
- [ ] Version-bump pre-commit git hook
- [ ] PWA manifest + icons
- [ ] `sim.js` headless balance bot + ablation tests

## Known issues / decisions
- Renderer kept isolated in `render.js` so PixiJS can swap in if Canvas 2D hits a wall.
- Deploy target: GitHub Pages (static; `git push`).
