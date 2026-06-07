# Perils — Game Design Principles

Reference for design decisions. Adapted from Vampire Survivors / "bullet heaven" design, flow
theory, and the ablation-testing methodology we used on Dragon Cards.

## The Pillars of a Great Survivor Game

### 1. Minimal Input, Maximal Spectacle

The player has one continuous input (movement) plus a few **occasional** ability taps. Everything
else is automatic. This frees the player's attention to *read the chaos* and *plan the build*.

**Design rule:** Never require continuous manual firing on mobile — it's exhausting and it kills the
"automatic storm" fantasy. Agency comes from **cooldown abilities** (punchy, occasional) and
**positioning** (constant, but free of button-mashing).

### 2. The Power-Fantasy Curve

A run must travel from *weak and pressured* to *godlike and screen-clearing*. If the player feels
strong at minute 1, there's nowhere to climb. If they feel weak at minute 12, the build failed.

```
Power:   ▁▁▂▂▃▃▄▅▅▆▇█    (over a single run)
Threat:  ▁▂▃▃▄▅▅▆▆▇▇██   (siege escalation keeps pace, slightly ahead at the end)
```

**Design rule:** Threat must escalate slightly faster than raw power, so the player must *build well*
(not just survive) to stay ahead. The escape finale is the hardest moment by design.

### 3. The Level-Up Pick Is the Whole Game

Combat is automatic; the **meaningful choices live entirely in the level-up screen.** Every pick
must be a real tradeoff — breadth (new weapon/ability) vs. depth (level up what you have) vs.
survivability (passive). If one pick is always correct, it's not a choice.

**How to test (Dragon's rule):** if a random agent and a smart agent make the same pick, the choice
is fake. Ablate each upgrade — removing it should drop survival time meaningfully.

### 4. Build Diversity & Synergy (Evolutions)

Weapons, passives, and abilities must **multiply**, not merely add. The payoff mechanic is
**evolution**: max a weapon's level *and* own its paired passive → it evolves into a super-weapon.
Discovering a synergy is the dopamine that drives replays.

**Design rule:** Add mechanics that combine (pierce + multishot + area), not mechanics that sit in
isolation. Every weapon should have at least one passive that transforms it.

### 5. Readable Chaos

Hundreds of entities on screen must remain *parseable*. The player needs to instantly read: where's
the gap, where's the danger, where's the XP.

**Design rules:**
- Geometric neon shapes; danger = warm colors (red/orange), player/allies = cool (cyan/white),
  XP = green, pickups = gold.
- Enemy telegraphs (ranged attacks, boss slams) flash before they fire.
- Never let UI/particles obscure the player's immediate surroundings.

### 6. The Map as a Tactical Resource

Procedural walls turn positioning from "keep spacing" into "use the architecture." Corridors funnel
hordes into your line weapons; doorways are choke points; open bays are death.

**Design rule:** Generation must guarantee the map is *usable* — no soft-locks, the player can always
reach the exit, there's always at least one good choke point and one open kill-bay. Validate every
generated layout (connectivity check) before the run starts.

### 7. Greed vs. Safety

XP crystals should sometimes sit in dangerous spots. The magnet pulls nearby ones, but the juicy
ones require stepping into the swarm. This is "HP as a spendable resource" from Dragon — risk for
reward.

**Design rule:** If the player is always at full HP, it's too easy. Constant low-grade pressure where
every HP point and every Blink charge feels valuable is the target.

### 8. Oscillating Tension (Flow Theory)

Alternate pressure and release: a brutal elite wave, then a lull to collect XP and breathe; a level
that floods you, then a power-spike pick that lets you clear it. The escape finale is the peak.

```
Tension:  ████░░░░████░░██████░░░░████████████
Release:  ░░░░████░░░░██░░░░░░████░░░░░░░░░░░░  → ESCAPE (peak)
```

---

## Validation: How to Know If It's Good

### Survival-Time Ablation (the `sim.js` plan)

A headless bot plays the run (herds the horde, greeds toward XP, blinks out of surrounds). Measure
**median survival time** and **escape success rate**, then ablate one mechanic at a time:

- **>10% survival-time change when removed = mechanic matters** (good).
- **~0% change = decoration** (cut or redesign it).
- **Survival goes UP when removed = trap** (redesign immediately — e.g. an upgrade that's a downgrade).

### Bot Skill Targets

| Bot | Target | Meaning |
|---|---|---|
| Random (moves randomly, random picks) | dies < 2 min, ~0% escape | Game has real difficulty |
| Greedy (chase XP, ignore danger) | dies 3–6 min | Naive play isn't enough |
| Skilled (kite, use choke points, Blink, smart picks) | survives to escape 25–45% | Skill is rewarded, not trivial |

### Per-System Targets

Every system should show a meaningful survival-time delta when ablated: weapons, passives, the
Special slot, Blink, Ultimate, the magnet, the procedural choke points (test vs. an empty open
arena — the map should help a skilled bot and barely help a random one).

---

## Anti-Patterns to Avoid

- **Continuous manual fire on mobile** — thumb fatigue, kills the spectacle. (We chose against it.)
- **Too many ability buttons** — cap at Blink + 1 Special + Ultimate on screen.
- **Dominant pick** — if one weapon/passive is always taken first, nerf it or buff alternatives.
- **Unusable generation** — disconnected rooms, no choke points, exit unreachable. Always validate.
- **Power without threat** — escalation must keep pace or the late run is boring.
- **Decoration mechanics** — if ablation says it doesn't matter, it doesn't ship.
