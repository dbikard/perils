# Perils — Game Vision Document

## The Concept

**Vampire Survivors, in space, on a procedurally generated ship.**

A mobile-first "bullet heaven" survivor game. You are the last crew member aboard a doomed
vessel overrun by hostile machines and alien swarms. Your weapons **auto-fire** — your job is to
**move**, **weave through the ship's corridors**, and **tap your abilities** at the right moment.

Each run drops you into a freshly **procedurally generated spaceship**: rooms, corridors, doors,
and vents you've never seen before. The walls are not decoration — corridors are choke points you
funnel the horde into; open bays are kill zones you avoid. Survive the escalating siege while the
warp drive charges, then fight your way to the airlock and escape.

The feeling: start the run weak and panicked, end it as an unstoppable storm of light clearing
the screen. The power-fantasy curve is the emotional core.

## Core Pillars

1. **Minimal input, deep choices.** One thumb moves; the other taps abilities. All the depth is
   in *where you stand* and *what you pick on level-up*.
2. **Auto-fire spectacle.** Weapons fire themselves. The screen fills with the consequences of
   your build. You orchestrate, you don't operate.
3. **The map is a weapon.** Procedural ship layouts make positioning matter. Every run, the
   choke points are somewhere new.
4. **Power-fantasy curve.** Weak → godlike over one ~12–15 minute run.
5. **Build discovery.** Weapons + passives + abilities combine; maxed weapons **evolve** into
   super-weapons. Finding a synergy is the reward that drives replays.
6. **Greed vs. safety.** Step into the swarm for that XP crystal, or play it safe? Constant tension.
7. **Meta-progression hook.** Banked salvage → permanent upgrades → unlock weapons, abilities,
   characters, and new worlds.

## The Setting

**Working title: Perils.** A deep-space salvage/colony vessel, the kind of place where something
went very wrong. The aesthetic is **neon-on-dark vector** — clean geometric shapes, glowing
outlines, a CRT/holographic feel. This is a deliberate art choice (not just a prototype stopgap):
it reads beautifully under "readable chaos" — hundreds of enemies stay parseable when everything
is a crisp glowing primitive.

### Worlds (themed procedural levels)

The game is a sequence of **worlds**, each a procedurally generated level with its own tileset,
enemy roster, and hazard. We ship the first; later worlds unlock via meta-progression.

| # | World | Theme | Hazard flavor |
|---|---|---|---|
| 1 | **The Vessel** (start) | Derelict crew ship — metal corridors, blue neon | Vents that spawn swarms; sealing bulkheads |
| 2 | Derelict Station | Bigger, ringed, broken gravity | Vacuum breaches, zero-g rooms |
| 3 | Alien Hive | Organic, pulsing, red bio-light | Spreading infestation tiles |
| 4 | The Reactor Core | Hot, white, radiation | Lava-like coolant, timed meltdown |

(Worlds 2–4 are post-MVP. MVP is a complete, replayable **World 1**.)

## Controls (mobile-first)

```
┌─────────────────────────────────────┐
│ HP ▓▓▓▓▓░  ⏱ 04:12  LV 7   ⚡ULT ▓▓▓░ │   ← HUD
│                                       │
│        (procedural ship, walls,       │
│         auto-firing weapons,          │
│         swarming enemies)             │
│                                       │
│   ◉ move          [⟶] Blink   [✦] Special │
│  (left joystick)        [⚡] Ultimate     │   ← right-thumb buttons
└─────────────────────────────────────┘
```

- **Left thumb:** virtual joystick (drag anywhere on the left half of the screen) = movement.
- **Desktop:** WASD / arrow keys for movement; keys for abilities (e.g. Space = Blink).
- **Right thumb:** ability buttons.
- **Weapons are fully automatic** — never tapped.

### Abilities

Every character has **Blink + Ultimate**; the **Special** slot is chosen during the run via level-ups.

- **Blink** (short cooldown, everyone) — short-range teleport-dash with brief invulnerability
  (i-frames). Turns a death into a clutch escape. The single best "feel" addition.
- **Special** (medium cooldown, build-chosen — pick & upgrade via level-ups):
  - **EMP Pulse** — radial knockback + stun. The panic button when surrounded.
  - **Deflector Field** — brief damage-immune bubble; upgrades to reflect projectiles.
  - **Reactor Overload** — temporary fire-rate + damage surge (the "go aggressive" window).
  - **Sentry Drone** — deploy a lingering auto-firing turret.
  - **Time Dilation** — briefly slow all enemies (control / escape).
- **Ultimate** (charge meter, fills from kills) — screen-clearing payoff, e.g. **Orbital Strike**
  on the densest cluster. The "when do I spend it" decision.

Level-up picks can upgrade abilities too (shorter Blink CD, Blink leaves a plasma trail, Deflector
reflects, Ultimate charges faster) — giving more build dimensions than pure Vampire Survivors.

## The Core Loop

```
move → weapons auto-fire → enemies die → drop XP crystals
   → collect crystals → level up → PICK 1 of 3-4 upgrades   ← the real decision
   → build synergies → evolve weapons → clear bigger hordes
   → siege escalates (faster/tankier waves, bosses) while warp drive charges
   → warp ready → fight to the airlock → ESCAPE (win) or die
   → bank salvage → permanent meta-upgrades → next run / next world
```

The **level-up pick** is to Perils what the **card reward** is to Slay the Spire — it's where all
the meaningful choices live. The combat itself is automatic spectacle.

## Run Structure: Survive, then Escape

A single World-1 run has two acts using the *same* procedural layout twice:

1. **The Siege (~10–12 min).** Survive escalating waves. The **warp drive charge meter** fills over
   time (and faster if you reach/hold objectives). Spawn rate, enemy HP, and elites ramp. Boss
   waves punctuate. This is defensive positioning — use corridors and choke points.
2. **The Escape (climax).** Warp ready → an **airlock/escape pod** marker appears across the ship.
   Now you must *traverse* the layout you've been defending, through the thickest horde, to the
   exit. Reaching it = victory.

This uses the procedural map for both *defense* (where do I hold?) and *traversal* (what's my route
out?), and gives every run a climax instead of a timer just expiring.

## Content Targets (MVP = through Phase 2)

- **Weapons (~6):** Pulse Blaster (nearest-target projectile), Orbiter (orbiting shield drones),
  Arc Coil (chain lightning), Mine Layer (area drops), Scatter Gun (cone), Beam (sweeping laser).
- **Passives (~6):** Engine (move speed), Hull (max HP), Coolant (weapon cooldown), Amplifier
  (area/size), Multiplier (extra projectiles), Magnet (pickup range + XP gain).
- **Enemies (~4 archetypes):** Swarmer (fast, weak, many), Hulk (slow, tanky), Spitter (ranged),
  Sprinter (fast, erratic). Each scales up over the run. Bosses at intervals.
- **Abilities:** Blink + all 5 Specials + 1 Ultimate (Orbital Strike).
- **One world:** The Vessel, fully procedural, with the survive-then-escape structure.

## Implementation Phases

- **Phase 0 — Engine + procedural arena.** Fixed-timestep loop, camera, input (joystick + keys),
  spatial hash, `mapgen` v1 (one generated ship), wall collision, **flow-field pathfinding**, one
  chasing enemy, one auto-fire weapon. *Goal: weaving through a generated ship dodging a swarm
  feels good.*
- **Phase 1 — Core loop + abilities.** XP crystals + magnet, leveling, level-up modal, HUD,
  **Blink + Ultimate**, game-over. *The minimum that's actually fun.*
- **Phase 2 — Content + Special slot (MVP line).** ~6 weapons, ~6 passives, build-chosen
  **Specials**, ~4 enemy archetypes, escalating spawn director + bosses, vent/door spawns, and the
  full **survive-then-escape** run structure.
- **Phase 3 — World structure + meta.** Banked salvage + permanent upgrades, weapon **evolutions**,
  2nd character, world completion → next-world unlock (World 2).
- **Phase 4 — Polish + infra.** Art/SFX pass, version-bump git hook, PWA manifest, headless balance
  sim (`sim.js`).

## Tech & Deployment

- **Vanilla HTML/CSS/JS, Canvas 2D, no build step, no frameworks** — same stack as Dragon Cards.
- Deployed on **GitHub Pages** (static hosting; just push files).
- Rendering isolated in `render.js` so we can drop in **PixiJS** as a renderer-only upgrade if we
  ever need thousands of sprites at 60fps — without touching game logic.
- Game logic is plain JS that also runs headless in Node for the balance simulator.

## What Makes This Different

This isn't Vampire Survivors with a space reskin:

1. **Procedural maps that matter** — corridors and choke points change every run; positioning is a
   real, fresh puzzle, not an empty field.
2. **Real abilities** — Blink/Special/Ultimate add timing decisions and raise the skill ceiling
   without breaking the auto-fire spectacle.
3. **Survive-then-escape climax** — runs build to a traversal finale, not a timer expiring.
4. **Worlds, not just one arena** — themed procedural levels you unlock and progress through.
