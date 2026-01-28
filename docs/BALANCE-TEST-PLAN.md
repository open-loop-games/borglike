# Balance Test Plan

## Current State (2026-01-28)

### Full Baseline @ `HEAD` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Farming Oscillation Fix

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.3 | 50 | 1% | 21274 | 623 | 6 | ✅ Endgame |
| **Berserker** | 48.5 | 50 | 2% | 14515 | 525 | 8 | ✅ Endgame |
| **Warrior** | 48.5 | 50 | 0% | 15021 | 520 | 3 | ✅ Endgame |
| **Blackguard** | 47.9 | 50 | 1% | 14902 | 528 | 2 | ✅ Endgame |
| **Paladin** | 47.5 | 50 | 0% | 20474 | 623 | 0 | ✅ Endgame |
| **Necromancer** | 45.4 | 50 | 18% | 31221 | 752 | 0 | ✅ Endgame |
| **Rogue** | 45.1 | 50 | 0% | 20076 | 557 | 1 | ✅ Endgame |
| **Priest** | 44.0 | 50 | 0% | 22040 | 630 | 0 | ✅ Endgame |
| **Druid** | 43.7 | 50 | 0% | 19796 | 547 | 0 | ✅ Endgame |
| **Mage** | 43.4 | 50 | 21% | 32157 | 691 | 0 | ✅ Endgame |
| **Archmage** | 42.3 | 50 | 19% | 31725 | 678 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (42+ avg depth). **20 Morgoth kills** (8 berserker, 6 ranger, 3 warrior, 2 blackguard, 1 rogue). Added farming commitment period (50 turns min) to prevent FARM/DESCEND oscillation. Added emergency ascent fallback when stuck deep without TP scrolls. Dungeon connectivity validated after stair placement. Caster CB rates remain elevated (Necromancer 18%, Mage 21%, Archmage 19%).

### Previous Baseline (100 runs, 50k turns, seed=1000, max-upgrades) - Post TP Drop Rate Fix

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.0 | 50 | 0% | 20976 | 623 | 1 | ✅ Endgame |
| **Berserker** | 48.6 | 50 | 0% | 14462 | 522 | 12 | ✅ Endgame |
| **Warrior** | 47.9 | 50 | 1% | 14795 | 507 | 3 | ✅ Endgame |
| **Blackguard** | 47.8 | 50 | 0% | 14765 | 524 | 4 | ✅ Endgame |
| **Paladin** | 47.3 | 50 | 0% | 20282 | 623 | 0 | ✅ Endgame |
| **Necromancer** | 45.5 | 50 | 15% | 31184 | 758 | 0 | ✅ Endgame |
| **Rogue** | 45.4 | 50 | 1% | 20348 | 560 | 1 | ✅ Endgame |
| **Druid** | 44.4 | 50 | 0% | 19614 | 553 | 0 | ✅ Endgame |
| **Priest** | 44.4 | 50 | 0% | 22039 | 644 | 0 | ✅ Endgame |
| **Mage** | 43.4 | 50 | 18% | 32174 | 691 | 0 | ✅ Endgame |
| **Archmage** | 42.1 | 48 | 23% | 31557 | 671 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (42+ avg depth). **21 Morgoth kills** (12 berserker, 4 blackguard, 3 warrior, 1 ranger, 1 rogue). TP scroll drop rate doubled and depth penalty capped at 25 levels - fixed Necromancer CB (20%→15%). Archmage CB regressed (14%→23%), needs investigation.

### Previous Baseline (100 runs, 50k turns, seed=1000, max-upgrades) - Pre TP Drop Rate Fix

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Berserker** | 48.7 | 50 | 1% | 14419 | 521 | 4 | ✅ Endgame |
| **Ranger** | 47.6 | 50 | 0% | 20283 | 596 | 2 | ✅ Endgame |
| **Warrior** | 47.5 | 50 | 2% | 14640 | 496 | 3 | ✅ Endgame |
| **Blackguard** | 47.4 | 50 | 2% | 14266 | 515 | 3 | ✅ Endgame |
| **Paladin** | 46.8 | 50 | 0% | 19927 | 604 | 0 | ✅ Endgame |
| **Necromancer** | 44.7 | 50 | 20% | 30496 | 741 | 0 | ✅ Endgame |
| **Priest** | 44.6 | 50 | 0% | 21568 | 621 | 0 | ✅ Endgame |
| **Rogue** | 43.7 | 50 | 1% | 19548 | 535 | 0 | ✅ Endgame |
| **Druid** | 43.3 | 50 | 0% | 18916 | 530 | 0 | ✅ Endgame |
| **Mage** | 42.7 | 48 | 18% | 31587 | 683 | 0 | ✅ Endgame |
| **Archmage** | 41.8 | 49 | 14% | 30460 | 659 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (41+ avg depth). **12 Morgoth kills** (4 berserker, 3 warrior, 3 blackguard, 2 ranger). Caster CB rates remain elevated (Necromancer 20%, Mage 18%, Archmage 14%). Melee classes stable with low CB (0-2%).

### Previous Baseline (100 runs, 50k turns, seed=1000, max-upgrades) - Post Unique Respawn Fix

| Class | Avg Depth | Max Depth | CB Rate | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|---------|--------|
| **Berserker** | 48.6 | 50 | 1% | 515 | 7 | ✅ Endgame |
| **Ranger** | 48.3 | 50 | 2% | 601 | 2 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 2% | 497 | 2 | ✅ Endgame |
| **Blackguard** | 47.3 | 50 | 1% | 502 | 0 | ✅ Endgame |
| **Paladin** | 46.5 | 50 | 0% | 593 | 0 | ✅ Endgame |
| **Necromancer** | 44.8 | 50 | 8% | 737 | 0 | ✅ Endgame |
| **Rogue** | 43.8 | 50 | 1% | 524 | 1 | ✅ Endgame |
| **Druid** | 43.4 | 49 | 0% | 525 | 0 | ✅ Endgame |
| **Priest** | 43.1 | 50 | 0% | 586 | 0 | ✅ Endgame |
| **Mage** | 42.5 | 48 | 20% | 676 | 0 | ✅ Endgame |
| **Archmage** | 41.8 | 48 | 15% | 660 | 0 | ✅ Endgame |

**Summary:** Fixed unique respawn logic: uniques now respawn on level revisit (only blocked after killed). Added Morgoth hunt with level flip when 90%+ explored at depth 50. Fixed unique hunt to use seenThisVisit (prevents infinite flip loops). **12 Morgoth kills** (7 berserker, 2 ranger, 2 warrior, 1 rogue).

### Upgrade Impact Analysis (100 runs, 50k turns, seed=1000)

Comparison of no-upgrades vs max-upgrades to measure upgrade dependency per class:

| Class | No Upgrades | Max Upgrades | Δ Depth | Notes |
|-------|-------------|--------------|---------|-------|
| **Ranger** | 44.6 | 47.9 | +3.3 | Strong baseline |
| **Berserker** | 43.0 | 48.7 | +5.7 | Strong baseline |
| **Warrior** | 41.3 | 47.8 | +6.5 | Strong baseline |
| **Necromancer** | 36.4 | 44.7 | +8.3 | Skeleton carries early |
| **Rogue** | 34.0 | 44.4 | +10.4 | Moderate dependency |
| **Priest** | 27.8 | 43.6 | +15.8 | High dependency |
| **Druid** | 24.4 | 43.2 | +18.8 | High dependency |
| **Archmage** | 23.7 | 41.6 | +17.9 | High dependency |
| **Mage** | 23.1 | 42.8 | +19.7 | High dependency |
| **Paladin** | 28.1 | 47.4 | +19.3 | High dependency |
| **Blackguard** | 22.0 | 48.2 | **+26.2** | Most upgrade-dependent |

**Observations:**
- Pure melee (Ranger, Berserker, Warrior) are viable without upgrades (~41-45 depth)
- Casters and hybrids need upgrades to reach endgame (+15-20 depth from upgrades)
- Blackguard is nearly unplayable without upgrades (+26 depth difference)
- Validates bot feature unlock design: face-rush viable for melee, casters need features

### Previous Run (30 runs, 30k turns, seed=1000, max-upgrades) - Post Defensive Spells

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Blackguard** | 49.2 | 50 | 3% | 544 | ✅ Endgame |
| **Ranger** | 49.1 | 50 | 7% | 738 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 0% | 495 | ✅ Endgame |
| **Berserker** | 47.7 | 50 | 13% | 500 | ✅ Endgame |
| **Paladin** | 45.9 | 50 | 0% | 671 | ✅ Endgame |
| **Priest** | 44.6 | 48 | 0% | 686 | ✅ Endgame |
| **Druid** | 44.0 | 47 | 0% | 606 | ✅ Endgame |
| **Rogue** | 42.9 | 50 | 0% | 580 | ✅ Endgame |
| **Necromancer** | 37.9 | 46 | 0% | 721 | ✅ Endgame |
| **Archmage** | 34.9 | 39 | 0% | 672 | ✅ Endgame |
| **Mage** | 34.5 | 40 | 0% | 669 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (34+ avg depth). **4 Morgoth kills** (2 Blackguard, 1 Ranger, 1 Berserker). CB rates dramatically improved - most classes now 0%. New defensive spells (Teleport Other, Shield, Resistance) added for Mage/Archmage with modest depth gains (+1.1/+1.5).

### Quick Run @ `HEAD` (30 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 48.4 | 50 | 0% | 511 | Endgame |
| **Warrior** | 47.9 | 50 | 3% | 489 | Endgame |
| **Blackguard** | 47.4 | 50 | 3% | 514 | Endgame |
| **Ranger** | 46.0 | 50 | 40% | 650 | Endgame |
| **Paladin** | 44.4 | 50 | 17% | 624 | Endgame |
| **Druid** | 43.3 | 48 | 10% | 577 | Endgame |
| **Necromancer** | 43.0 | 46 | 67% | 861 | Endgame |
| **Rogue** | 41.7 | 50 | 17% | 539 | Endgame |
| **Priest** | 41.6 | 47 | 47% | 597 | Endgame |
| **Mage** | 38.5 | 46 | 90% | 767 | Endgame |
| **Archmage** | 37.0 | 46 | 80% | 734 | Endgame |

**Summary:** All 11 classes endgame-viable (37+ avg depth). 3 Morgoth kills (2 berserker, 1 ranger). Melee classes stable (0-3% CB). **Caster CB rates explode at 50k turns** - Mage 90%, Archmage 80%, Necromancer 67% - confirming ASCEND_TO_FARM/FARM oscillation issue.

### Previous Run @ `HEAD` (30 runs, 30k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 48.8 | 50 | 0% | 511 | Endgame |
| **Warrior** | 48.3 | 50 | 10% | 501 | Endgame |
| **Blackguard** | 47.3 | 50 | 7% | 503 | Endgame |
| **Ranger** | 45.6 | 50 | 27% | 618 | Endgame |
| **Rogue** | 45.0 | 50 | 23% | 605 | Endgame |
| **Paladin** | 43.3 | 49 | 17% | 571 | Endgame |
| **Priest** | 38.5 | 47 | 47% | 517 | Endgame |
| **Druid** | 38.1 | 44 | 3% | 472 | Endgame |
| **Necromancer** | 36.0 | 44 | 10% | 656 | Endgame |
| **Archmage** | 33.4 | 41 | 0% | 625 | Endgame |
| **Mage** | 33.4 | 38 | 7% | 630 | Endgame |

**Summary:** All 11 classes now endgame-viable (30+ avg depth). Blessed Mace starting weapon and reduced staff affinity fixed druid (+10.1 depth). Priest CB rate elevated (47%) needs investigation.

### Quick Run @ `5879186` (30 runs, 30k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 48.3 | 50 | 3% | 504 | Endgame |
| **Ranger** | 47.2 | 50 | 10% | 559 | Endgame |
| **Warrior** | 47.0 | 50 | 0% | 471 | Endgame |
| **Blackguard** | 46.0 | 50 | 0% | 481 | Endgame |
| **Paladin** | 45.2 | 50 | 0% | 550 | Endgame |
| **Rogue** | 44.7 | 50 | 7% | 527 | Endgame |
| **Priest** | 40.2 | 48 | 0% | 474 | Endgame |
| **Druid** | 37.8 | 47 | 0% | 431 | Endgame |
| **Mage** | 37.3 | 43 | 20% | 631 | Endgame |
| **Necromancer** | 36.3 | 43 | 0% | 634 | Endgame |
| **Archmage** | 36.3 | 43 | 17% | 610 | Endgame |

**Summary:** All 11 classes endgame-viable (36+ avg depth). CB rates 0-20%. Mage/Archmage CB rates higher than other classes.

### Long Run @ `0934bf6` (100 runs, 30k turns, seed=1000, max-upgrades)

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

**Status:** ✅ Complete (2026-01-24)
**Commit:** `5879186` fix(bot): Resolve FLEE/TAKE oscillation and improve retreat logic

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

**Status:** ✅ Complete (2026-01-24)
**Commit:** `5879186` fix(bot): Resolve FLEE/TAKE oscillation and improve retreat logic

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

## RESOLVED: Caster Caution Threshold Bug

**Status:** ✅ Complete (2026-01-26)

### Problem Statement

Caster classes (Mage, Archmage, Necromancer) were significantly underperforming melee classes, averaging 34-38 depth vs 47-49 for melee. Investigation revealed class behavior modifiers were never being applied to retreat decisions.

### Root Cause Found

In `survival-retreat.ts:getFleeGoal()`, the function destructured `config` (base personality) instead of `effectiveConfig` (personality + class modifiers):

```typescript
// BUG: Class modifiers never applied to retreat
const { game, config, botState } = context
const retreatEval = shouldRetreat(game, config, dangers, hpRate)
```

The `effectiveConfig` combines base personality with class modifiers (`cautionMod`, `aggressionMod`). Without it, casters were using the base "cautious" personality (50% HP retreat threshold) regardless of class profile settings.

### Fix Applied

**1. Fixed retreat threshold calculation** (`survival-retreat.ts:759`):
```typescript
const { game, effectiveConfig, botState } = context
const retreatEval = shouldRetreat(game, effectiveConfig, dangers, hpRate)
```

**2. Rescaled personality caution values** (`personality.ts`):
| Personality | Before | After |
|-------------|--------|-------|
| cautious | 50% | 35% |
| aggressive | 20% | 20% |
| greedy | 40% | 30% |
| speedrunner | 35% | 25% |

**3. Updated caster class profiles** (`class-profiles.ts`):
| Class | cautionMod Before | cautionMod After | aggressionMod Before | aggressionMod After |
|-------|-------------------|------------------|----------------------|---------------------|
| Mage | +20 | -5 | -20 | 0 |
| Archmage | +25 | -5 | -25 | 0 |
| Necromancer | +15 | -5 | -15 | 0 |

**Effective retreat thresholds (cautious personality):**
- Before fix: 50% (base, class modifiers ignored)
- After fix: 35% - 5% = 30%

### Caution Sweep Testing

Ran automated sweep test (`scripts/caster-caution-sweep.ts`) across cautionMod values from -30 to 0:

| Class | Best cautionMod | Avg Depth | Max Depth |
|-------|-----------------|-----------|-----------|
| Mage | -10 | 42.8 | 50 |
| Archmage | -20 | 42.7 | 47 |
| Necromancer | -15 | 44.9 | 49 |

Selected `cautionMod=-5` as conservative setting balancing depth progression with survival.

### Results (100 runs, seed=1000, max-upgrades, 30k turns)

| Class | Avg Depth Before | Avg Depth After | Change |
|-------|------------------|-----------------|--------|
| Mage | 34.5 | **42.8** | +8.3 ⬆️ |
| Archmage | 34.9 | **41.6** | +6.7 ⬆️ |
| Necromancer | 37.9 | **44.7** | +6.8 ⬆️ |

All three casters now comparable to melee classes (41-45 avg depth).

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

## NEW: Staves and Class Weapon Preferences

**Status:** Implemented (2026-01-24)
**Commit:** `0103aea` feat(items): Add staves and class weapon preferences

### Problem Statement

Caster classes (Mage, Archmage, Necromancer) were equipping heavy melee weapons like Bastard Swords because bot scoring only considered raw damage output. A Bastard Sword (3d4 = 7.5 avg, score 85) always beat a Dagger (1d4 = 2.5 avg, score 25) regardless of class.

### Implementation

**1. Staves as Caster Weapons**

Added 6 staves with spell power bonus (applies to both damage AND healing):

| Staff | Tier | Damage | Spell Power | Min Depth |
|-------|------|--------|-------------|-----------|
| Wooden Staff | 1 | 1d2 | +10% | 0 |
| Crystal Staff | 2 | 1d3 | +15% | 10 |
| Runed Staff | 2 | 1d3 | +18% | 15 |
| Enchanted Staff | 3 | 1d4 | +20% | 25 |
| Staff of Wizardry | 3 | 1d4 | +22% | 30 |
| Staff of Power | 4 | 1d4 | +25% | 40 |

**2. Class Weapon Affinity Scoring**

Bot now applies class-specific multipliers to weapon/staff scores:

| Class | Staff Mult | Weapon Mult | Notes |
|-------|------------|-------------|-------|
| Mage | 3.0x | 0.3x | Pure caster |
| Archmage | 3.5x | 0.2x | Glass cannon |
| Necromancer | 3.0x | 0.3x | Summoner caster |
| Warrior | 0.3x | 1.2x | Heavy melee |
| Berserker | 0.2x | 1.5x | All-in melee |
| Priest | 2.0x | 1.0x | Edged penalty 0.1x |
| Druid | 2.0x | 0.8x | Edged penalty 0.3x |

**3. Priest Edged Weapon Restriction**

Following Angband theme, priests/druids cannot effectively use edged weapons (swords, axes, daggers). Added `isEdged` flag to 12 weapons. Priests score edged weapons at 0.1x (effectively unusable).

**4. Starting Equipment**

Mage/Necromancer/Archmage now start with Wooden Staff instead of Dagger.

**5. Danger Calculation Updates**

Added `estimateCasterDamage()` to properly estimate caster kill speed:
- Factors INT modifier, level scaling, and spell power from staff
- Used by `getEffectiveDamage()` for danger calculations
- Casters with staves show lower "turns to kill" estimates

### Score Examples

| Item | Base | Mage (×3.0) | Warrior (×1.2) | Priest |
|------|------|-------------|----------------|--------|
| Dagger (1d4, edged) | 25 | 7 | 30 | 2 |
| Bastard Sword (3d4, edged) | 85 | 25 | 102 | 8 |
| Wooden Staff (+10%) | 45 | 135 | 13 | 90 |
| Staff of Power (+25%) | 100 | 350 | 30 | 200 |
| Mace (2d4, blunt) | 50 | 15 | 60 | 50 |

### Expected Impact

- Mages should now prefer staves over swords
- Priests should prefer maces/staves, avoid swords
- Caster spell damage increased by 10-25% with appropriate staff
- Danger calculations more accurate for casters (less unnecessary fleeing)

### Testing Required

```bash
# Baseline before staves
pnpm diagnose batch --runs=100 --seed=1000 --class=mage --max-upgrades --turns=50000

# After staves - expect similar or improved depth, fewer CB from spell power boost
pnpm diagnose batch --runs=100 --seed=1000 --class=mage --max-upgrades --turns=50000
```

---

## Future

### Evaluate Upgrades and Nerf Swiftness Upgrade

- 25% evasion is scaled far too high
- Upgrades need to be meaningful
- Bot upgrades to unlock or improve features: Preparedness consumables, farming patterns, sweep, stair surf, kiting?, Town usage?
  - Somewhat reversing the bot build process, starting facerush to depth, adding features to allow more depth
- bot upgrade/unlock settings expose more settings in full loadout
- full loadout bot personality is bot settings levers defaults
- Town upgrades, unlocking T2, T3, T4?, maybe adding the black market vendor?
- Gold gain is very high compared to drains
- Consider encumberance to force town runs and prevent the mass hording going on

---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 50,000 | Catches caster CB issues that emerge at higher turn counts |
| `--runs` | 100 | Statistical significance, ~2-3 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

**Standard command:**
```bash
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000 > /tmp/[name].txt 2>&1
```

**Full baseline (all 11 classes):**
```bash
pnpm diagnose baseline --seed=1000 --turns=50000 --max-upgrades  # ~16 min
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
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=50000 > /tmp/[name].txt 2>&1

# Find problematic seeds
pnpm diagnose find --runs=100 --seed=1000 --class=mage --turns=50000 > /tmp/[name].txt 2>&1

# Full baseline across all 11 classes (100 runs, 50k turns, max-upgrades)
# ~16 min runtime
pnpm diagnose baseline --seed=1000 --turns=50000 --max-upgrades > /tmp/[name].txt 2>&1
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
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000  > /tmp/[name].txt 2>&1

# With change (same seed for A/B comparison)
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000 [flags]  > /tmp/[name].txt 2>&1

# Verify no regression on warrior
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=50000 [flags]  > /tmp/[name].txt 2>&1
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
