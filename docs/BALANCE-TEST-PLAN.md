# Balance Test Plan

## Current State (2026-01-23)

### Class Performance (100 runs, 30k turns, seed=1000, max-upgrades)

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

11-45% CB rate at depths 32-50 for melee/hybrid classes. Vault feature fixes reduced warrior from 48% to 11%. Remaining causes:
- Goal oscillation at high depths
- Pathfinding issues in complex late-game dungeons
- Decision paralysis with many available options

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
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 > /tmp/[name].txt 2>&1
```

**Full baseline (all 11 classes):**
```bash
npx tsx scripts/diagnose.ts baseline --seed=1000  # ~15 min
```

**Parallel execution:** Run only 2 batch commands simultaneously (8 threads each = 16 total).

---

## Diagnostic Tooling

```bash
# Quick single run
npx tsx scripts/diagnose.ts quick --seed=12345 --class=warrior

# Deep dive with turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior --map

# Standard batch test
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 > /tmp/[name].txt 2>&1

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=100 --seed=1000 --class=mage --turns=30000 > /tmp/[name].txt 2>&1

# Full baseline across all 11 classes (100 runs, 30k turns, max-upgrades)
# ~15 min runtime
npx tsx scripts/diagnose.ts baseline --seed=1000  > /tmp/[name].txt 2>&1
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
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000  > /tmp/[name].txt 2>&1

# With change (same seed for A/B comparison)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 [flags]  > /tmp/[name].txt 2>&1

# Verify no regression on warrior
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 [flags]  > /tmp/[name].txt 2>&1
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
