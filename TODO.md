# Perils — TODO

**Live:** https://dbikard.github.io/perils/ · repo: github.com/dbikard/perils · v0.1.0

## Phase 0 — Engine + procedural arena  ✅ DONE
- [x] `index.html` + `styles.css` scaffold (canvas, mobile layout, neon theme)
- [x] `engine.js`: fixed-timestep loop, camera, input (touch joystick + WASD/arrows), spatial hash
- [x] `mapgen.js`: procedural ship (rooms + corridors), tile grid, wall collision, validation
- [x] flow-field pathfinding (BFS from player over tile grid, periodic recompute)
- [x] `render.js`: draw tiles + entities as geometric neon shapes, camera transform
- [x] `entities.js`: pooled player / enemy / projectile
- [x] Phase 0 playable: one chasing enemy (follows flow field), one auto-fire weapon

## Phase 1 — Core loop + abilities  ✅ DONE
- [x] XP crystals drop on kill + magnet pickup
- [x] Leveling + level-up modal (pick 1 of 3)
- [x] HUD (HP, timer, level, XP bar, ult charge ring)
- [x] Blink ability (dash + i-frames)
- [x] Ultimate (charge from kills → Orbital Strike)
- [x] Game-over screen + restart
- [x] Deployed to GitHub Pages

## To watch / tune (from headless sim)
- [ ] Early leveling cadence — kiting bots abandon crystals and stay weak; confirm a human collecting feels the power curve. Consider faster first few levels if needed.
- [ ] Ultimate killing a screen of enemies dumps many crystals → possible burst of stacked level-up modals. Acceptable, but watch the feel.

## Phase 2 — Content + Special slot (MVP line)  ✅ DONE
- [x] 6 weapons (Pulse, Scatter Gun, Arc Coil, Rail Beam, Orbiters, Mine Layer) — per-weapon model, levels
- [x] passives + ability upgrades (Amplifier, Coolant, Multiplier, Engine, Hull, Magnet, Regen, Blink, Ult)
- [x] Special abilities: EMP, Deflector, Overload, Sentry, Time Dilation (build-chosen slot + 3rd button)
- [x] 4 enemy archetypes (Swarmer, Sprinter, Hulk, Spitter+ranged) + boss waves
- [x] Spawn director v2: time-gated composition, escalation, periodic bosses
- [x] Warp-drive charge meter + survive-then-escape + airlock + VICTORY
- [x] Weapons line-of-sight targeting (no shooting through walls)
- [x] PWA: installable to home screen (manifest + icons)
- [x] Deployed (v0.2.0)

## To watch / tune
- [ ] Warp time = 300s (5 min siege) — tune for run length feel.
- [ ] Special-acquire choices (5 of them) can crowd the early level-up pool — consider weighting.
- [ ] Boss HP scaling vs. late-game DPS — confirm bosses are threats, not speed bumps.

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
