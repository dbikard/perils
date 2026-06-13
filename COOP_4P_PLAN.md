# 4-Player Co-op — Implementation Plan

Status: **planned** (co-op is currently hard-capped at 2). This doc is the roadmap for
lifting that to 4. Written 2026-06-13.

## Goal

Support **2–4 players** in a single LAN co-op run, keeping the existing serverless
(no-server, same-Wi-Fi) WebRTC pairing and the deterministic lockstep simulation that
makes the sim match the browser.

## Current state (the 2-player ceiling)

Everything below assumes exactly two peers. These are the things to change.

### Netcode — `js/net.js` (the real blocker, ~70% of the work)
- A session is **one WebRTC DataChannel between one host and one guest**. QR pairing is 1:1
  (host shows offer → guest shows reply → host scans it back).
- Lockstep buffer is two fixed slots: `inputs: [Map, Map]`, `localIdx ∈ {0,1}`, and
  "wait for peer" is literally `inputs[1 - localIdx].has(tick)` — one other player assumed.

### Game logic — `js/game.js`
- `numPlayers = game.mp ? 2 : 1`
- `choiceQueues = [[], []]` (level-up queues, 2 slots)
- One extra flow field `ff2` only (`game.ff2`, computed for `players[1]`)
- "The other player" hardcoded as `players[1 - idx]` in: **revive/mate** (`mate = players[1 - pl.idx]`),
  **camera-follow-on-death** (`players[1 - cp.idx]`), and the **enemy flow-field pick**
  (`p.idx === 1 ? ff2 : ff`).

### Render — `js/render.js`
- Partner off-screen arrow uses `players[1 - me.idx]` (single partner).

### Content
- Only two fighter designs exist: **Ace** (idx 0, cyan) and **Nova** (idx 1, violet).

### What's already N-ready (free)
- **Difficulty scaling** keys off `players.length` (spawn rate, entity cap, enemy HP/damage).
- Spawn anchoring / `nearestLivingPlayer`-style helpers already loop over `game.players`.

---

## Plan

### 1. Networking: host-as-hub star topology
Move from a single peer link to a **star** with the host as the relay hub.

- **Pairing:** host opens N−1 guest slots. Each guest pairs with the host the same way it
  does today (host shows an offer QR per open slot; guest scans, shows a reply QR; host scans
  it back). Sequential, reuses the existing QR/scan UI — no new transport. Add a tiny lobby
  panel on the host showing "2/4 joined" with a START button.
- **Input relay:** each tick, every guest sends its input to the host; the host **broadcasts
  the full input set** (all N players' inputs for that tick) to every guest. Guests no longer
  talk to each other — only to the host. This keeps NAT/pairing simple (mesh would need
  N·(N−1)/2 channels and pairwise QR, rejected).
- **Assign `localIdx`** during pairing: host = 0, guests = 1..N−1 in join order.
- **Disconnect handling:** `peerGone` becomes per-peer. If a guest drops, its player goes
  AI-idle / is marked dead; the run continues for the rest (host migration is out of scope —
  if the **host** drops, the run ends, same as today).

### 2. Lockstep → N players (`js/net.js`)
- `inputs` becomes `Array.from({length: N}, () => new Map())`.
- `ready(tick)` waits for **all** non-local, non-gone slots: `players.every(p => p.local || p.gone || inputs[p].has(tick))`.
- `get(tick, p)` already indexes by player; just allow `p = 0..N-1`.
- DELAY prefill loops N slots. Desync hash is unchanged (still a hash of full game state).

### 3. Generalize "the other player" (`js/game.js`)
Replace every `players[1 - idx]` with an N-safe form:
- **Revive/mate:** revive if **any** teammate is alive (`game.players.some(q => q !== pl && !q.dead)`),
  not specifically player `1-idx`.
- **Camera on death:** follow the **nearest living** teammate (helper already exists for spawn anchoring — reuse it).
- **Flow fields:** allocate **one flow field per living player** (`game.ff[i]`), not just `ff` + `ff2`.
  Each enemy targets the field of its nearest player. For 4 players this is 4 BFS computes per
  flow-field tick — acceptable; if it ever shows up in profiling, recompute on a stagger
  (one player's field per tick, round-robin) since the horde tolerates a frame of staleness.
- **`choiceQueues`** sized to N.
- `numPlayers` = lobby size (2–4), clamped.

### 4. Render: arrow per off-screen teammate (`js/render.js`)
- Loop all other players; draw a tinted edge arrow for **each** one that's off-screen
  (the function I just added already does the per-player math — just wrap it in a loop and
  drop the `1 - me.idx`).
- Colors per index: 0 Ace cyan `#38e8ff`, 1 Nova violet `#c48eff`, **2 + 3 are new** (see §5).

### 5. Content: two more fighters
- Add players 2 & 3 with distinct colors + sprites. Suggested palette to stay on-theme and
  keep the danger/ally/xp/salvage hues clear:
  - idx 2 — **amber/gold** `#ffb454` ("Rook")
  - idx 3 — **green** `#54ff9f`… **avoid** (clashes with XP crystals) → use **coral/red-orange**
    is danger-coded too; pick **teal-green** `#3fe0c0` ("Vega") or a hot-pink. Final call at impl time.
- Sprites: reuse the proven generator (`build_sprites.py` palette-swap, same path that produced
  Nova) for two recolored fighters + portraits.

### 6. Balance
- Difficulty already scales by `players.length`; **re-tune the multipliers for 3 and 4** with
  the sim (`node sim.js --players=3`, `--players=4`). Expect the per-player spawn-rate slope to
  flatten at higher counts (revive resilience compounds), so the curve may need to be concave
  rather than linear. Verify escape-rate target per the 2-player methodology.
- Add `--players=N` is already supported by `sim.js`; extend bot AI only if 3–4 reveals new
  failure modes (e.g. everyone clumping).

### 7. UI / HUD
- Lobby panel (host): joined count + per-slot status, START enabled at ≥2.
- HUD shows N health bars / portraits (currently 2). Keep it compact on phones — small stacked
  pips rather than full bars at 4.

---

## Sequencing (suggested branches)
1. **Logic generalization first, behind a flag** — make `game.js`/`render.js`/`net.js` N-safe
   while still running N=2, verified by the existing 2P sim + loopback. No behavior change.
2. **Star netcode + lobby** — the hard part; test with 3 via loopback in `sim.js` before browsers.
3. **Content (sprites/colors)** — parallelizable, low risk.
4. **Balance pass** for 3 and 4.

## Out of scope (explicitly)
- Internet/relay play (still LAN-only, no server).
- Host migration / reconnect.
- More than 4 players (lockstep input-broadcast cost and screen real-estate make 5+ a different design).
