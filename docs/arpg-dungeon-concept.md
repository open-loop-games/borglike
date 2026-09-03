# ARPG Dungeon — Concept (Fork 2)

Status at session close: playable end to end (arena → dens → affixed rares →
milestone bosses → portal → next tier, town resupply with exact restore).
Control duo on pinned seeds: warrior ~9.5 tiers, mage ~16.4. Classic gates
identical throughout. Open: melee-duel answers, AoE-seek/flank-danger retune,
economy curve. Tracked items live in TODO.md ("Rift Dungeon").

## 1. Pitch

Same bones (deterministic turn engine, seeded RNG, bot runner, 4-slot UI), second dungeon:
a Diablo/PoE-style rift dungeon. Turn-based and deterministic, but the fantasy is
creep packs, rares with generated names, and clearing density — not Angband attrition.

Classic = slow, tactical, 1v1–1v3, descend 50.
ARPG = fast, greedy, 1v8–1v15, clear rifts, kill the boss, go again.

## 2. Pillars (what makes it feel ARPG)

1. **Packs, not singles.** Most monsters spawn as a coherent group (4–10 trash sharing a type + pool). They aggro together, swarm together, die together.
2. **Whites / blues / yellows / boss.** Four tiers only. Power and loot scale with tier, not with bespoke uniques.
3. **Generated rares.** A rare is `base + 1 prefix + 1 suffix`, name-composed ("Burning Ghoul of the Pit"). No hand-authored uniques in v1.
4. **Density over difficulty per-hit.** Trash hits weak, moves to surround. Threat comes from being flanked + rare auras, not from one big melee stat stick.
5. **Clear-to-progress.** Each rift holds **4 spawners**, one per quadrant (see §6).
  Killing a spawner stops its trickle. **Killing 3 of 4 spawns the boss** (the 4th
  keeps pressure during the fight — player chooses whether to clear it first).
  No stair-hunting, no kill-counting. Supersedes the earlier fixed-75% quota
  (2026-09-03 decision, replaced: quota-hunt devolves into finding stragglers).

Non-goals for v1: player item affixes, gems, passives, trading, player-applied ailments beyond what classes already do. Player classes/races/spells stay as-is.

## 3. Reuse map

| System | Reuse as-is | Fork / extend |
|---|---|---|
| Seeded RNG (`game/rng.ts`) | yes — determinism requirement already solved | — |
| Turn loop, energy speed (`game-loop.ts`, `monster-ai.ts`) | yes | add swarm steering + pack aggro hooks |
| Combat resolution (`combat.ts`, `monster-combat.ts`) | yes | rares apply aura/modifier hooks pre/post roll |
| Bot runner + instance manager | yes | new goal weights (pack value, AoE value), new danger shape |
| Grid renderer, FOV, lighting | yes | add tier color ring / affix glyph overlay |
| Classic dungeon gens (classic/cavern/labyrinth) | keep for Classic mode | new `arena` / `openspace` gen behind mode flag |
| Monster templates (`data/monsters.ts`) | reuse as **base bodies** | add `ArpgRole` + pack profile per body |
| Items/spells/classes | reuse untouched | no ARPG player loot in v1 |

Mode plumbing: `SlotConfig.dungeonMode: 'classic' | 'rift'`. Engine branches only at
level-gen entry, spawn-director entry, and essence-settlement. Everything else shared.

## 4. Run structure: rifts

- A run = sequence of rifts (short maps). Suggested: rift 1–3 trash-heavy, rift 4+ boss-gated, endless scaling after.
- Each rift: single open floor (no stairs-down inside). Kill quota ~70–80% → boss spawns or portal opens → kill boss → loot burst → next rift, tier+1.
- Rift tier scales: monster HP/dmg multiplier, pack size, blue/yellow count, affix budget. Same exponential shape as Classic depth curve, compressed: tier N ≈ depth `3*N` in Classic stat terms (tune later).
- Death = run ends, essence as usual + `riftTier` bonus multiplier. Victory has no cap — endless.
- Turn pressure is **quota, not clock**. Real-time timers don't port to turn-based botting. Optional soft pressure: wandering reinforcements every K turns after quota met (prevents stall-farming).

## 5. Level generation for density

Classic rooms+corridors fight packs (doorways serialize them). Rift maps need the opposite:

- New generator `rift-arena`: one large irregular cavern (cellular automata, high fill ~55–65%), plus 2–4 pillars / wall blobs for kiting geometry. No doors. Wide sightlines (FOV radius can stay 8).
- Guaranteed: spawn room (player entry, 5-tile safe radius), 3–6 pack dens (spread by Poisson-ish min-distance), 1 elite alcove, 1 boss arena circle near far edge.
- Vaults reused sparingly: only monster-density vaults as "elite alcove" templates.
- Size target: ~60×30 usable floor. Smaller than Classic floor — travel time is dead time in ARPG mode.

## 6. Spawn director (spawners + gradient, no quota)

Player spawns dead center. Four spawner dens sit one per quadrant, placed like
vaults (existing placement tooling): random point in-quadrant, biased away from
center and slightly off walls, min-distance between dens. Each den = 1 spawner +
guards + local pack.

**Spawner mechanics (v1):**
- Spawner is an **immobile monster** (reuses combat targeting, bot threat, danger
  grid for free — no new interaction code). High HP, no melee, one spawn action.
- **60–80% of the heavies live at dens:** blues/yellows spawn as den guards at gen;
  whites are what the spawner emits.
- **Trickle with an off-switch:** every N player turns (tuned per tier, e.g. 12–20),
  each living spawner emits 1 white at its den if active count < cap. Deterministic:
  turn counter + seeded RNG, spawn order fixed. Killing the spawner ends its trickle —
  this is the bounded trickle the quota design couldn't allow.
- **Gradient for free, no field needed:** emitted creeps get an outward drift
  (spawn position + den-avoid bias) until they aggro, then normal AI. Density is
  highest at living dens, thinnest at cleared ones — the player reads gradients by
  fighting, not by us computing a Djikstra gradient per tick. If a direction field
  is ever wanted, reuse the already-computed flow grids; never a new per-tick field.
- **Cost:** spawner check is O(1) per spawner per turn (counter + cap check); drift
  is O(1) per creep. No A\* for drift, no per-tick allocation.

**Beats:** land center → pick a quadrant (weakest gradient / nearest den) → dive,
clear guards, kill spawner → next. Third spawner kill spawns the boss at arena center (walk-back finale in the
landing zone). 4th den optional — clear it first or fight under trickle.

**Aggro model:** packs aggro as a unit. Waking one wakes the pack (plus short alert radius to neighbors). No single-pull. This is the core feel change vs Classic.

## 7. Monster tiers

- **White (normal):** base stats ×0.6–0.8 HP, ×0.7 dmg. No affix. XP low, loot ~nothing. Exist to die to AoE and feed quota.
- **Blue (magic pack):** base ×1.2 HP, pack of 3–5, **one shared prefix** (e.g. all "Burning"). Name: "Burning Ghoul Pack". Slight XP bonus.
- **Yellow (rare):** base ×2.5–3.5 HP, +dmg, **1 prefix + 1 suffix**, 2–4 white guards of same body. Name-composed. Drops the loot.
- **Boss (rift guardian):** **promoted base — a super-yellow.** Same body table as the tier, bigger stat multiplier, **1 prefix + 1 suffix** (same generator as yellows, higher budget), no bespoke bodies in v1. One per rift, dormant until quota.

Visual: tier shown as **cell rim + inner glow** in the canvas renderer (not char swap — bodies stay readable). White = none, blue = rim, yellow = rim+glow, boss = rim+glow+size/bold. Bot-visible via `isRare`/`isElite` flags, not pixels.

## 8. Affix name tree (v1 pool — small on purpose)

Design rule: prefixes change **offense/element**, suffixes change **defense/behavior**.
Each affix = one mechanic + one name fragment. No stacking same affix twice on one rare.

**Prefixes (pick ≤1):**
- Burning — +fire touch / fire spells, resist fire. Name: "Burning X"
- Frozen — chills on hit (slow energy), resist cold. "Frozen X"
- Venomous — poison on hit. "Venomous X"
- Vampiric — lifesteal on hit. "Vampiric X"
- Swift — +speed (energy rate, capped). "Swift X"
- Brutal — +melee dice size. "Brutal X"
- Cursing — casts weaken/slow. "Hexing X"
- Spitting — gains a ranged bolt. "Spitting X"

**Suffixes (pick ≤1):**
- of the Pit — +HP pool. Tanky.
- of Thorns — melee reflect.
- of the Swarm — on death spawns 2 white minis (cap-respecting).
- of the Wisp — teleports / blinks toward player when far.
- of Greed — drops bonus gold/essence, slightly weaker (loot pinata).
- of Stone — high armor, slow.
- of Echoes — extra action charge / faster energy (no multi-turn break — just rate).
- of the Pack — buffs nearby allies' damage (aura; the priority target).

Rare example: base Ghoul + Burning + of the Pack → **"Burning Ghoul of the Pack"**, guards = 3 white ghouls.

**Generation rule:** `rollRare(base, tier, rng) → { prefix?, suffix? }` with weights by tier
(early tiers bias to stat affixes; behavior affixes unlock deeper). Deterministic from rift seed + spawn index.

Balance guardrails: speed and extra-action affixes share a cap (never both); reflect + lifesteal never co-occur in v1; aura radius ≤4 so positioning matters.

## 9. What changes in combat / AI

- Trash steering: cheap surround — prefer unoccupied adjacent tile nearest player, no full A* per creep. Rares/boss keep existing pathfinding.
- Pack leash: past 14 tiles from the den, stragglers step home (prevents whole-map trains). Boss unleashed.
- AoE value flip: bot currently avoids crowds; ARPG bot must **seek** them. New goal weight: `packDensity × aoeReadiness`. Single-target spells deprioritized vs pack-bonus damage.
- Danger grid reshape: thin per-monster threat down for whites, add spike for rare auras + surround count (flanked-by-4 must read as dangerous).
- Kill priority: rares > blues > whites, unless white pack blocks movement. Retreating through a den is worse than standing ground.

## 10. Loot / XP stance (v1)

Keep player power flat (same classes/items). ARPG progression expresses through:
- XP rate: whites give ~40% Classic per-kill, but 5–8× kill volume → net faster leveling inside rifts.
- Loot bias: whites drop ~nothing, blues small chance, yellows guaranteed useful drop, boss burst. Same item tables, different drop weights.
- Essence: `base + tier² kicker + boss bonus`. Rifts should pay slightly better per wall-minute than Classic to justify the mode, not 3×.

## 11. Determinism + perf notes

- All director rolls (pack pick, affix pick, trickle timing) consume the run's seeded RNG stream in spawn order. No `Math.random`, no wall-clock.
- 30–50 cap keeps energy loop + flow BFS + danger grid within current budgets. Swarm steering must be O(1)-ish per creep or the tick loop sags at 4 slots.
- Renderer: cap glyph overlays to rare/boss to avoid canvas churn.

## 12. Build order (as built — foundations first, classic seed-identical each step)

- **Foundations (done):** `dungeonMode` pipe (SlotConfig → RunConfig → ruleset
  handle on GameState), gen-time capacity assert (≤3200 tiles), danger
  saturating add, level-sized SeenGrid + edge bounds, safety off-grid fallback.
  Rift flag first routed to classic gen with byte-identical trajectories proven.
- **Arena (done):** `rift-arena` generator (60×30 cellular high-fill, pillars,
  center clearing, sealed borders, 4-way connectivity reuse). No vaults/doors/
  stairs; `entryPoint` = center; new `rift_portal` tile. Advance = portal at
  center → tier+1 (depth reused as tier). First trigger was clear-all-whites;
  spawners replaced it (boss kill opens the portal), portal + advance kept.
- **Spawners (done):** quadrant dens (cavern open-area helper + separation
  filters; geometry on level, progress on ruleset), immobile spawner bodies
  (`data/rift/monsters.ts`, energy-clock emission ~1/17 turns, annulus spread,
  cap-respecting), same-body guard packs, pack wake propagation + home leash,
  boss at center on 3rd spawner kill. Bot hunts spawners/boss on the
  descent-blocker pattern; no town travel at first (later restored, below).
- **Affixes (done, first full tree):** registry (`data/rift/affixes.ts`: name
  fragment, clone edits, flags, magnitudes, tier weights, exclusions,
  eligibility). Rares clone the base (composed names, `baseName` keeps bestiary
  and knowledge keyed to the base). Blues share one prefix; rares add a suffix
  with guards; bosses roll both. Pit/Stone/Swift/Thorns/Swarm first, then
  touches, Brutal, casters, Wisp, Greed, Pack aura, Vampiric. Echoes deferred
  (extra actions are the most sensitive hook). Eligibilities learned the hard
  way: no speed on hard-CC bodies (stun-lock), converters need a plain attack,
  no HP-mult on milestone natives (double-dip).
- **Milestone bosses (done):** native uniques at tiers matching their depth
  (T2 Bullroarer, T3 Wormtongue/Grishnakh roll, T7 Bolg, T8 Azog, T9 Lugdush,
  T12 Lokkak, T17+ deep-three roll; Morgoth excluded on the victory binding).
  Native stats + affixes, no HP inflation. Everything else stays promoted trash.
- **Town resupply (done):** rift allows town travel again — tier snapshotted
  exactly on entry (dead entity-cache path rewired), restored on return and on
  expired-portal entrance exit. No stair flipping, pruning trivial. Control duo
  moved warrior 10.0→16.7, mage 16.3→19.3 (then bosses re-walled melee; see below).
- **Class staple (done):** warrior cleave as class-kit data (`meleeStaple` on
  GameClass), splash resolved inside `handleAttack` — no new action, routing,
  or bot code. Next staples are data rows.
- **Dive posture (tried, reverted):** chain hunt above KILL cost warrior ~1.9
  tiers over 18 pinned runs; patient clearing wins. Lesson filed, mechanism gone.
- **Bot retune (open):** AoE-seek, flank danger, melee-duel answers (kiting;
  bow-vs-thorns stays out as off brand).
- **Economy (open):** XP/drop/essence weights for pack volume, boss burst,
  endless scaling curve (deep-tier stalls at 16–18 are the first data).

## 13. Resolved decisions

Early locks (2026-09-03):

1. Boss = promoted base (super-yellow), same affix generator, higher budget. No bespoke bodies.
2. Progress = spawners (3 of 4 kills → boss). Replaces fixed-75% quota (straggler-hunt problem).
3. Trickle returns in bounded form: spawner-gated, cap-respecting, ends on spawner kill. Unbounded/time-based trickle stays deferred.
4. Blues share one affix set per pack.
5. Tier visual = cell rim + inner glow, not char swap.
6. Spawner = immobile monster (reuses combat/bot/danger), placed per-quadrant via vault-style tooling; 60–80% of heavies at dens; whites drift outward (no new field).
7. Data split starts at `data/rift/monsters.ts` (midpoint: extends classic, classic untouched). Spawner clock = energy loop (speed 7 ≈ 1 emission/17 turns, deterministic, no new timers). Boss-kill (not clear-all) opens the portal once trickle exists.

Later locks (session two):

8. Branch on data, not mode strings: behavior keys off `riftRole`/`packId`/`packHome`
   and the `allowTownTravel` flag. Mode checks live only at structural dispatch
   points (gen, descend, kill, advance, progression).
9. Thorns is melee-only and resolves as physical damage through armor (gear check,
   not a ban). No parity reopen for spells/ranged/minions.
10. Class staples are data (`meleeStaple` on GameClass), resolved inside the
    existing attack path — never bespoke actions per staple.
11. Town travel restored for rift with exact snapshot/restore (no regrind, no stair
    flipping). Pruning stays trivial: one tier + town.
12. Milestone tiers pull native uniques; Morgoth never spawns in rift (victory binding).
13. Dive posture reverted after measurement (−1.9 tiers over 18 pinned runs).
    Comparisons pin seeds (`--seed=`); unseeded matrices are directional only.
14. `diagnose matrix` takes `--dungeon-mode` (deep/batch/matrix covered) for rift baselines.

## 14. Foundation seams (where the second dungeon plugs in)

Proven by codebase map; build order is top-down so classic never breaks:

1. **Config pipe** — `types/progression.ts SlotConfig` → `stores/progression.ts createDefaultSlotConfig` (default `classic`) → `game/types.ts RunConfig` → `engine/instance-manager.ts getSlotConfig/createGameRunner` → `game/game-runner.ts createGameRunner` → `game-loop.ts createGame`. Thread `dungeonMode?` (optional until M0 flips it required). One-way, display stores never see it.
2. **Ruleset handle on GameState** — `ruleset` (mode + rift progress fields:
  portal, spawners, boss, return depth) created in `createGame`. Downstream reads
  the handle; behavior branches on role/pack data and the `allowTownTravel` flag,
  with mode checks only at structural dispatch points. Bot reads it via `BotContext`.
3. **Level-gen branch** — `game/dungeon/index.ts generateLevelWithInfo` is the single branch point: classic keeps `getDepthProfile/selectGenerator` + `classic|cavern|labyrinth` switch; rift bypasses to `rift-arena` (cellular high-fill, no doors, dens + boss arena). `placeStairs` skipped for rift (no `stairs_down`); portal/boss spawn owned by ruleset.
4. **Spawn director** — `monster-ai.ts spawnMonstersForLevel` (count + placement) + `spawnMonster` (per-instance attach) are the two hooks. Rift director (`game/rift/director.ts`) owns tier population and attaches optional `packId`/`packHome`/`riftRole` on the `Monster` instance type (`game/types.ts`). Optional fields = classic untouched.
5. **Turn/transition seam** — `game-loop.ts executeAction 'descend'` → `actions/movement.ts handleDescend` (tile-gate + `levelCache` + regen). Rift adds parallel paths: `rift_portal` → tier+1 arena gen (`handleRiftAdvance`), town entrance → snapshot restore. No `stairs_up` in rift; run start (`createGame`) becomes tier-1 arena when ruleset is rift.
6. **Bot injection** — `bot/tick.ts runBotTick` + `bot/context.ts buildBotContext` gain optional mode/weights; `BotContext` carries them; `bot/goals.ts selectGoal` (portal-as-DESCEND, spawner hunt on the descent-blocker pattern); `bot/danger.ts computeDangerGrid` (pack-bearer threat). Classic weights are the default — rift overrides, never rewrites.
7. **Renderer overlay** — `engine/instance-manager.ts renderGameToGrid` + `renderEntities` display lambda is where rim+glow attaches (tier → rim color, inner glow). Entity data stays in engine; stores keep extracted cells only.
8. **Settlement** — `game-runner.ts calculateEssence` (live estimate) + `core/formulas.ts essenceFromDeath/essenceFromVictory` (canonical) + `stores/progression.ts calculateEssenceReward/recordRun` + `core/run-completion-service.ts handleRunCompletionSync`. Rift branches formula (tier² kicker + boss bonus) at the canonical layer, not the UI.

Build rule: each milestone ships its seam with classic behavior identical (flag-off = byte-identical runs for the same seed), then rift content flows through it.

## 15. Map-size / typed-array bounds (verified against tree + PERFORMANCE.md)

Context: the tight types are deliberate — 8 optimization passes, 0.13ms/tick, zero
per-tick allocation in hot loops (FlowGrid u8, DangerGrid i16 + folded max, SeenGrid
u8, passable/explored bitmaps, preallocated module-level queues, FNV-1a hash). Rift
work must not regress these. Rule: **constrain the arena to fit the fast path; only
the overflow-safe minimum changes, each with a before/after `diagnose` gate.**

- **Flow u8 distances (cap 254) — no change.** 60×30 open diameter ~59 fits with
  headroom. Constraint: rift arena tiles ≤3200 and longest walkable path <254 by
  construction (open + pillars, never maze-like). No widen to u16 (would grow every
  cached FlowGrid + touch the dequeue-elimination path for zero benefit at this size).
- **Shared BFS queue / safety buffers (hard 3200) — no reallocation per call.**
  60×30=1800 fits. Constraint: arena stays ≤3200 passable tiles; exceeding that is a
  generator bug, and the correct fix is a debug assert at gen time, not a growable
  queue (per-call alloc would undo Pass 3/4). If a bigger arena is ever wanted, it
  ships with its own `diagnose` numbers, not as a drive-by.
- **Danger i16 additive splat — saturate, don't widen.** 30–50 dense + auras can push
  a tile past 32767 → wraps negative = "safe". Fix is a saturating add
  (`if (v > 32767 - add) v = 32767`) inside the existing per-monster loop where
  maxDanger is already folded — one compare, no type change, no extra pass. Gate:
  `diagnose deep` warrior+mez mage before/after, avg + max on `computeDangerGrid`.
- **SeenGrid hardcoded 80×40 — size from level (once per level, not per tick).**
  Allocation happens on level change only; per-tick `seenGridHas/Add` stays index
  math. Also add the missing bounds check on the edge path (frontier-adjacent
  reads at -1/w/h currently misread as seen). Gate: `recordVisibleTiles` avg/max.
- **Safety radius 50 — keep, design around it.** Raising the radius widens the most
  expensive op in the tree (`computeSafetyFlow` ~1ms mage worst case). Rift arena +
  leash range keep fights inside the radius; far-corner `MAX_COST` gets a documented
  fallback (nearest-better-tile) instead of a null that reads as "surrounded".
- **Per-tick A\* per monster — the real density cost.** `processMonsterTurns` already
  runs full-grid A\* per monster; 30–50 trash × A\* is what breaks the budget, not
  the grids. Cheap surround-steering for trash (full pathing kept for rares/boss)
  is the perf feature to reach for if density rises, and it must arrive with
  `diagnose` numbers at high vs low active counts, 4-slot turbo frame check.

Perf gate (every change): `pnpm run check` + `PROFILE_BOT=1 pnpm diagnose deep
--seed=1000 --class=warrior --turns=50000` and `--class=mage` before/after (avg +
max per op, not just avg — spikes drop turbo frames), plus batch runtime spot-check.
Classic numbers must not move outside noise. Matrix comparisons pin `--seed=`.

## 16. Data split: classic vs rift (underway)

Lookups are id/name-based with `undefined`/empty fallbacks at callers, and there is
one central re-export (`game/data/index.ts` — note: omits `town, forms, activations,
bot-upgrades`; vaults live in `game/dungeon/vaults.ts`). That makes an overlay split
cheap. Live so far: `data/rift/monsters.ts` (spawner body, tier tables, milestone
pool), `data/rift/affixes.ts` (registry, roller, composer, resolvers). Planned:
`packs.ts` (pack profiles per body), `tiers.ts` (stat multipliers + scaling curve).

- **Keep `data/` as classic canonical.** Rift adds `data/rift/` files as needed;
  classic tables stay untouched.
- **Resolver by ruleset, not forked imports.** Consumers keep importing one symbol;
  the function branches on the ruleset handle: `getSpawnableMonsters(depth, ruleset)`,
  `getAverageDamage(...)` unchanged (affix mods applied on the instance, not the
  template). New rift-only lookups (`rollAffixes`, `composeRareName`) live in
  `data/rift/` and are called only from the director.
- **Balance split comes later and is expected to touch both sides.** AoE-vs-single
  and open-map shifts will eventually need: monster HP/dmg windows per tier (rift),
  class AoE tuning + spell `maxTargets`/damage-falloff review (shared, rift-weighted),
  race sustain review (shared). Rule: shared files get rift *weights/overrides* first;
  only fork a table (e.g. separate class numbers) if overrides prove insufficient.
  Upgrades/bot-upgrades/boosters stay shared in v1; rift-specific boosters (if any)
  come after economy data exists.

---
*Resume: pick up the bot retune (AoE-seek, flank danger, kiting) or the economy
curve, both tracked in TODO.md. Control duo: warrior + mage, seeds pinned.
`pnpm diagnose matrix --classes=warrior,mage --runs=3 --upgrades=full
--capabilities=full --boosters=class --dungeon-mode=rift --turns=20000 --seed=1000`.*
