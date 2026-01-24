# Balance Test Plan

## Current State (2026-01-23)

### Class Performance (30 runs, 30k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 48.0 | 50 | 7% | 507 | Endgame ⬆️ |
| **Warrior** | 47.4 | 50 | 1% | 478 | Endgame ⬆️ |
| **Blackguard** | 46.9 | 50 | 7% | 498 | Endgame |
| **Paladin** | 45.5 | 50 | 0% | 580 | Endgame |
| **Rogue** | 44.4 | 50 | 10% | 550 | Endgame |
| **Priest** | 43.9 | 50 | 0% | 542 | Endgame |
| **Ranger** | 42.2 | 50 | 3% | 533 | Endgame ⬆️ |
| **Druid** | 39.0 | 45 | 0% | 477 | Endgame |
| **Mage** | 37.5 | 44 | 13% | 639 | Endgame |
| **Archmage** | 36.7 | 43 | 13% | 615 | Endgame |
| **Necromancer** | 35.2 | 43 | 7% | 611 | Endgame |

**Summary:** All 11 classes endgame-viable (35+ avg depth). CB rates dropped dramatically (0-13%). 2 more Morgoth kills (berserker, ranger) ⬆️.

### Previous Baseline (100 runs, 30k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Warrior** | 46.4 | 50 | 11% | 476 | Endgame ⬆️ |
| **Blackguard** | 40.3 | 50 | 40% | 408 | Endgame |
| **Berserker** | 40.3 | 50 | 45% | 403 | Endgame |
| **Paladin** | 39.9 | 50 | 39% | 510 | Endgame |
| **Priest** | 38.4 | 48 | 39% | 474 | Endgame |
| **Rogue** | 38.3 | 50 | 45% | 478 | Endgame |
| **Ranger** | 38.2 | 50 | 36% | 485 | Endgame |
| **Druid** | 34.5 | 45 | 30% | 424 | Endgame |
| **Necromancer** | 32.9 | 44 | 24% | 588 | Endgame |
| **Archmage** | 32.7 | 44 | 36% | 578 | Endgame |
| **Mage** | 31.9 | 43 | 39% | 574 | Endgame |

**Summary:** All 11 classes endgame-viable (30+ avg depth). Vault feature fixes reduced warrior CB rate from 48% to 11%.

---

## Known Issues

### Investigated: Post-Teleport Goal Reset (disabled)

Attempted to reset EXPLORE goals after phase door/teleport to prevent bot from backtracking to distant pre-teleport targets. Implementation in `state.ts:resetAfterTeleport()` with hooks in `tick.ts` (currently disabled).

**Finding:** Caused -0.8 avg depth regression and +6% CB rate increase for Archmage. Even minimal reset (EXPLORE goals only, keep caches) showed -0.2 depth / +3% CB. The persistence bonus (+150) for current exploration targets may be helping more than hurting overall. Code remains for future investigation when other issues are resolved.

### Endgame Circuit Breakers

0-7% CB rate at depths 35-50. FLEE/TAKE and FLEE/DESCEND oscillation fixes reduced CB causes significantly. Remaining:
- Exploration/flee oscillation at depth 50 (rare, 1% warrior)
- Pathfinding issues in complex late-game dungeons

---

## RESOLVED: FLEE/TAKE Goal Oscillation

**Status:** ✅ Complete (2026-01-23)

### Problem Statement

Warrior batch runs (100 seeds) showed 11% circuit breaker rate with bot stuck oscillating between FLEE and TAKE goals for 800+ turns at depths 35-45.

**Problem seeds:** 1061, 1073 (both CB @ depth 37)

### Root Cause Found

Bot enters high-danger area to pick up item → FLEE triggers → flees 1-2 tiles → danger drops/monsters leave vision → FLEE clears → TAKE resumes → re-enters danger → FLEE triggers → loop forever.

Turn log pattern:
```
Turn 12342: pos=(51,33) goal=FLEE@(44,24) [MOVED]
Turn 12343: pos=(50,32) goal=FLEE@(44,23) [MOVED]
Turn 12344: pos=(49,32) goal=TAKE@(51,34) [MOVED]  ← FLEE cleared, back to item
Turn 12345: pos=(49,33) goal=TAKE@(51,34) [MOVED]
...
Turn 12349: pos=(50,33) goal=FLEE@(44,24) [MOVED]  ← FLEE triggers again
```

Two issues:
1. **Hardcoded 70% HP threshold** for "high danger area" retreat was too aggressive. Bot at 58% HP (level 50, 920/1570 HP) kept fleeing from areas it could easily handle.
2. **No memory of dangerous items** - bot kept re-targeting the same item that triggered flee.

### Fix Applied

**1. Personality-scaled HP threshold** (`survival-retreat.ts:213`):
```typescript
// HP threshold scales with personality: cautious (50%) → 70%, aggressive (20%) → 40%
const dangerHpThreshold = cautionThreshold + 0.2
```

**2. Dangerous item blacklist** - prevent re-targeting items that caused flee:
- Added `dangerousItemBlacklist: Set<string>` to BotState
- When FLEE triggers from "High danger area" with active TAKE goal, blacklist that item ID
- `findBestItem()` skips blacklisted items
- Blacklist clears on level change

### Results (100 runs, seed=1000, max-upgrades, 30k turns)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Warrior Avg Depth | 46.4 | **47.2** | +0.8 ⬆️ |
| Warrior CB Rate | 11% | **7%** | -4% ⬆️ |

**Specific seeds:**
- 1061: CB@37 → Death@45 (+8 depth)
- 1073: CB@37 → Death@50 (+13 depth, reached Morgoth's level)

---

## RESOLVED: FLEE/DESCEND Goal Oscillation

**Status:** ✅ Complete (2026-01-23)

### Problem Statement

Warrior batch runs (100 seeds) showed 7% circuit breaker rate with bot stuck oscillating between FLEE and DESCEND goals for 700+ turns at depths 39-50.

**Problem seeds:** 1001, 1031, 1054, 1074, 1077, 1091, 1092

### Root Cause Found

Bot approaches stairs with DESCEND goal → enters "high danger area" → FLEE triggers → flees 1-2 tiles → monsters leave vision → FLEE clears → DESCEND resumes → re-enters danger → FLEE triggers → loop forever.

Turn log pattern (seed 1054, depth 39):
```
Turn 11340: pos=(62,25) HP=916 depth=39 goal=DESCEND@(76,13) [MOVED]
Turn 11341: pos=(61,25) HP=916 depth=39 goal=FLEE@(56,20) [MOVED]
Turn 11342: pos=(62,26) HP=916 depth=39 goal=DESCEND@(76,13) [MOVED]
Turn 11343: pos=(61,26) HP=916 depth=39 goal=FLEE@(56,20) [MOVED]
... (700+ turns of oscillation)
```

Unlike FLEE/TAKE, can't blacklist stairs. Bot at 51-58% HP kept fleeing from areas it could handle because `dangerHpThreshold = 70%` for cautious personality.

### Fix Applied

**Bullrush for DESCEND** (`survival-retreat.ts:751-755`):
```typescript
// Bullrush: When committed to DESCEND, push through "high danger area" to reach stairs
// Other flee triggers (HP critical, outnumbered, losing fight, status) still apply
if (retreatEval.reason === 'High danger area' && botState.currentGoal?.type === 'DESCEND') {
  return null
}
```

Bot commits to descent and ignores "high danger area" flee. Critical flee triggers still work:
- HP < cautionThreshold (50% for cautious)
- Outnumbered (2+ adjacent monsters)
- Losing fight badly (combat advantage < -20)
- Dangerous status effects

### Results (100 runs, seed=1000, max-upgrades, 30k turns)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Warrior Avg Depth | 47.0 | **47.4** | +0.4 ⬆️ |
| Warrior CB Rate | 7% | **1%** | -6% ⬆️ |

**Specific seeds:**
- 1054: CB@39 → Death@41 (+2 depth)
- 1074: CB@39 → Death@50 (+11 depth, reached Morgoth's level)
- 1077: CB@50 → Death@50 (fixed)
- 1091: CB@50 → Death@50 (fixed)
- 1092: CB@44 → Death@47 (+3 depth)

---

## RESOLVED: "No Goal" Stuck Pattern

**Status:** ✅ Complete (2026-01-23)
**Commit:** `2424f1c` fix(bot): Fall back to normal exploration when sweep flow unreachable

### Problem Statement

Extended find runs (500 seeds, 30k turns) revealed a common failure mode across Mage/Archmage:

| Metric | Mage | Archmage |
|--------|------|----------|
| CB Rate (before fix) | 27.2% | 31.0% |
| Deaths | 5 | 10 |

**Shared depth-1 stuck seeds:** 1020, 1055, 1071, 1204, 1395, 1487

### Root Cause Found

Primary failure mode was **sweep flow unreachability**:

1. Mage/Archmage at level < 10 uses **sweep mode** (re-explores visited tiles)
2. Sweep flow is computed from "seen-this-visit" tiles, not unexplored frontiers
3. When bot explores a corridor, sweep frontiers may be in a different area
4. Sweep flow becomes **unreachable** (separated by unexplored tiles)
5. Game doesn't fall back to normal exploration → goal cleared → wait loop

Example seed 1020 frontier analyzer output:
```
Turn 17 @ (13,7): frontier=19 flowOK cost=4 avoid=0 candidates=4/8 target=(16,23)
  SWEEP_MODE: sweepFrontiers=74 SWEEP_FLOW_BLOCKED cost=255
```

The normal exploration flow IS reachable (cost=4), but sweep flow is blocked (cost=255).

### Fix Applied

In `tick.ts:computeExploreGoalFlow()`:
- Added reachability check for sweep flow before returning
- If sweep flow unreachable, falls back to normal exploration flow
- Prevents goal from being cleared when sweep frontiers are isolated

```typescript
// Check if sweep flow is reachable from bot's position
// If not reachable, fall through to normal exploration
const sweepCost = getFlowCost(flowCosts, pos)
if (sweepCost < MAX_FLOW_COST) {
  return flowCosts  // Sweep flow reachable - use it
}
// Sweep flow unreachable - fall through to normal exploration
```

### Results (100 runs, seed=1000, max-upgrades, 30k turns)

| Class | Avg Depth Before | Avg Depth After | Change |
|-------|------------------|-----------------|--------|
| Mage | 28.7 | **31.9** | +3.2 ✅ |
| Archmage | 29.7 | **32.7** | +3.0 ✅ |
| Necromancer | 30.9 | **32.9** | +2.0 ✅ |

All three casters now endgame-viable (30+ avg depth).

### Additional Fixes

Also fixed module-level cache pollution in diagnostic runner:
- Added `invalidateFrontierCache()` and `invalidateUnexploredCache()` exports
- Called at start of each diagnostic run to prevent stale cache between runs

### Diagnostic Tooling Added

New `frontier` analyzer tracks:
- Frontier tile availability vs reachability
- Sweep mode state (casters at level < 10)
- Sweep flow reachability separate from normal flow
- Cache state debugging

---

## RESOLVED: Vault Feature Interaction Bugs

**Status:** ✅ Complete (2026-01-23)
**Commit:** `2a39a7d` fix(bot): Resolve stuck patterns causing circuit breakers

### Problem Statement

Warrior batch runs showed 48% circuit breaker rate with bot getting stuck indefinitely on vault-related features. Three distinct failure modes all stemmed from vault room generation introducing features the bot couldn't properly interact with.

### Combined Results (100 runs, seed=1000, max-upgrades, 30k turns)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Warrior Avg Depth | 40.9 | **46.4** | +5.5 ⬆️ |
| Warrior CB Rate | 48% | **11%** | -37% ⬆️ |
| Victories | 0 | **1** | +1 |

### Fix 1: Disconnected Stairs

**Seeds:** 1019, 1089 (CB @ depth 9)

Dungeon generation order caused stairs to spawn in regions disconnected by vault placement. Vault walls could isolate previously connected areas.

**Fix:** Reordered generation - vault placement now happens BEFORE connectivity validation. Stairs excluded from vault regions.

### Fix 2: Dungeon Merchant Loop

**Seeds:** 1029, 1090 (CB @ depths 8-9)

`VISIT_MERCHANT` goal handler never actually traded - bot walked to merchant, returned `wait`, goal recreated, infinite loop.

**Fix:** Call `botSellItems()` and `botBuySupplies()` when at dungeon merchant. Track visited merchants in `visitedDungeonMerchants` set.

### Fix 3: Altar Infinite Loop

**Seeds:** 1082, 1050, 1074, 1095 (CB @ depths 21-37)

Altar tiles are impassable. Bot targeted altar position directly, circled around it for 800+ turns unable to reach it.

**Fix:** Changed altar interaction to adjacent (like merchants). `useAltar()` now uses `findAdjacentAltar()`. Goal targets adjacent walkable tile.

---

## Future

### Evaluate Upgrades and Nerf Swiftness Upgrade

- 25% evasion is scaled far too high
- Upgrades need to be meaningful
- Bot upgrades to unlock or improve features: Preparedness consumables, farming patterns, sweep, stair surf, kiting?, Town usage?
- bot upgrade/unlock settings expose more settings in full loadout
- full loadout bot personality is bot settings levers defaults

---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 30,000 | Enough for endgame, catches long caster runs |
| `--runs` | 100 | Statistical significance, ~1.5-2 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

**Standard command:**
```bash
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 > /tmp/[name].txt 2>&1
```

**Full baseline (all 11 classes):**
```bash
pnpm diagnose baseline --seed=1000  # ~15 min
```

**Parallel execution:** Run only 2 batch commands simultaneously (8 threads each = 16 total).

---

## Diagnostic Tooling

```bash
# Quick single run
pnpm diagnose quick --seed=12345 --class=warrior

# Deep dive with turn log
pnpm diagnose deep --seed=12345 --class=warrior --map

# Standard batch test
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 > /tmp/[name].txt 2>&1

# Find problematic seeds
pnpm diagnose find --runs=100 --seed=1000 --class=mage --turns=30000 > /tmp/[name].txt 2>&1

# Full baseline across all 11 classes (100 runs, 30k turns, max-upgrades)
# ~15 min runtime
pnpm diagnose baseline --seed=1000  > /tmp/[name].txt 2>&1
```

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--max-upgrades` | off | Apply all upgrades at max (includes 25% bestiary) |
| `--turns=N` | 5000 | Max turns per run |
| `--monster-hp=N` | 100 | Monster HP % |
| `--monster-damage=N` | 100 | Monster damage % |
| `--bestiary=N` | 0 | Fixed bestiary bonus % (0=use kills) |
| `--start-potions=N` | 3 | Starting healing potions |
| `--potion-rate=N` | 100 | Potion spawn rate % |
| `--regen=N` | 0 | HP regen per 10 turns (OOC) |
| `--armor-pen=N` | 0 | Flat armor penetration |
| `--enchant-rate=N` | 100 | Enchantment chance % |
| `--item-rate=N` | 100 | Items per level % |
| `--xp-rate=N` | 100 | XP gain % |

---

## Test Matrix Template

```bash
# Baseline (seeded for reproducibility)
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000  > /tmp/[name].txt 2>&1

# With change (same seed for A/B comparison)
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 [flags]  > /tmp/[name].txt 2>&1

# Verify no regression on warrior
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 [flags]  > /tmp/[name].txt 2>&1
```

**Success criteria:**
- Target class improves by 1+ avg depth
- No regression on other classes
- Circuit breaker rate doesn't increase significantly

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate tuning
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
- `docs/BALANCE-PASS-3.md` - Pure caster fixes (vision, stair-surf, phase door)
