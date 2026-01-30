# XP Curve Analysis

## Current Status

**REVERTED** - Changes caused unacceptable regression vs baseline. See "Experiment Results" below.

No changes to `src/core/formulas.ts` - using original values:
- `XP_CURVE_EXPONENT`: 1.5
- `xpFromMonster()`: Original formula (no depth compression)

---

## Experiment Results (2026-01-30)

### Attempted Fixes

1. **XP Curve Exponent**: 1.5 → 1.8
2. **Depth Compression**: 100% at D1 → 33% at D50
3. **Overlevel Penalty Threshold**: Disabled before L10, then L15

### Batch Test Results (20 runs, 50k turns, seed=1000, --max-upgrades)

| Class | Baseline | With Fixes | Delta | Verdict |
|-------|----------|------------|-------|---------|
| **Warrior** | 48.5 | 47.4 | -1.1 | ✅ Acceptable |
| **Mage** | 42.5 | 35.8 | **-6.7** | ❌ Regression |

### Why Fixes Failed

1. **Mage without upgrades**: Avg D7.5 (stuck farming, never progressed)
2. **Mage with upgrades**: Avg D35.8 (still -6.7 from baseline)
3. **Overlevel penalty threshold** (L10, L15): No effect - mages hit threshold then got penalized while still on early depths
4. **Root cause**: Bot AI behavior (SQUISHY), not XP formula

### Conclusion

The "L50 at D34" observation was **not a balance problem** - it was working as intended. The baseline shows:
- All 11 classes reach endgame (avg 40-49 depth)
- 13 Morgoth kills across classes
- CB rates 0-14% (acceptable)

The XP changes broke mage progression without providing meaningful benefit. **Reverted all changes.**

---

## Problem Statement

The XP economy was broken: characters hit max level (50) by depth 34, leaving 16 depths with no progression. Casters suffered most - stuck farming early depths where XP was lowest.

**Root Cause Discovered:** Monster data was imported from Angband (100 dungeon levels) and compressed to 50 levels, but XP values were never adjusted. This caused:
- Monster XP scaled for 100-level progression
- Level curve only spans 50 levels
- Result: L50 reached halfway through the dungeon

### Angband's XP Formula

From Angband source (`src/mon-util.c:1072`):
```c
new_exp = ((long)mon->race->mexp * mon->race->level) / div;
// XP = (base_exp × monster_depth) / player_level
```

Angband multiplies base XP by monster depth. Borglike used base XP directly without this scaling.

### Depth Compression Examples

| Monster | Angband Depth | Borglike Depth | Base XP | Compression |
|---------|---------------|----------------|---------|-------------|
| Smaug | 62 | 50 | 30,000 | 1.24x |
| Beholder | ~80 | 40 | 6,000 | 2x |
| Morgoth | 100 | 50 | 60,000 | 2x |

---

## Baseline Data (Before Fix)

**Seed 1000, max upgrades:**

### Warrior Progression
| Turns | Depth | Level | Kills | XP |
|-------|-------|-------|-------|-----|
| 2,000 | 8 | 4 | 35 | 524 |
| 5,000 | 17 | 13 | 119 | 4,554 |
| 10,000 | **34** | **50** | 321 | 106,770 |

### Mage Progression
| Turns | Depth | Level | Kills | XP |
|-------|-------|-------|-------|-----|
| 2,000 | 3 | 2 | 24 | 260 |
| 5,000 | 5 | 4 | 56 | 657 |
| 10,000 | 8 | 8 | 143 | 2,240 |
| 16,000 | **29** | **50** | 360 | 58,959 |

**Breakpoint:** D20-25 - Monster XP exceeds XP-per-level, causing instant leveling.

---

## Implemented Fix

### 1. Increased XP Curve Exponent (1.5 → 1.8)

```typescript
// src/core/formulas.ts
export const XP_CURVE_EXPONENT = 1.8
```

Effect on XP requirements:
| Level | Before (1.5) | After (1.8) | Increase |
|-------|--------------|-------------|----------|
| L10 | 2,700 | 5,160 | +91% |
| L25 | 11,757 | 30,505 | +159% |
| L50 | 34,300 | 110,243 | +221% |

### 2. Steep Depth Compression in xpFromMonster()

```typescript
// src/core/formulas.ts - xpFromMonster()
// Scale from 100% at D1 to 33% at D50
const depthScale = 1 - monsterDepth / 75
xp *= Math.max(0.33, depthScale)
```

Effect on monster XP:
| Depth | Scale | Beholder (6000) | Morgoth (60000) |
|-------|-------|-----------------|-----------------|
| D10 | 87% | 5,220 | - |
| D25 | 67% | - | - |
| D40 | 47% | 2,820 | - |
| D50 | 33% | - | 19,800 |

---

## Results After Fix

**Seed 1000, max upgrades:**

### Warrior Progression (IMPROVED ✅)
| Turns | Depth | Level | Before L | Change |
|-------|-------|-------|----------|--------|
| 2,000 | 7 | 3 | 4 | -1 |
| 5,000 | 13 | 8 | 13 | -5 |
| 10,000 | 26 | 28 | **50** | -22 |
| 13,000 | **37** | **50** | 50 | L50 delayed by 3 depths |

### Mage Progression (BROKEN ❌)
| Turns | Depth | Level | Before L | Issue |
|-------|-------|-------|----------|-------|
| 5,000 | 3 | 3 | 4 | Slower |
| 10,000 | 5 | 6 | 8 | Stuck |
| 20,000 | 15 | 13 | **50** | Way behind |
| 30,000 | 38 | **50** | 50 | +14k turns |

### Batch Results (20 runs, 50k turns)

| Class | Avg Depth | Before | Victories |
|-------|-----------|--------|-----------|
| Warrior | 36.3 | 43.1 | 1 (5%) |
| Mage | **7.5** | N/A | 0 |

Mage batch avg depth of 7.5 indicates they're stuck farming early game.

---

## Early Game Problem

The higher XP exponent compounds the mage farming problem:

**Mage at L8 farming D3:**
- Monster base XP: ~10-15
- Depth compression: 96% (minimal at D3)
- Overlevel penalty: L8 vs expected L2 = 6 levels over = **40% XP**
- Net XP per kill: ~5-6
- XP needed for L5→L6: **1,212** (was 800)
- Kills needed: **200+** (was ~130)

The overlevel penalty was designed when the exponent was 1.5. With 1.8 exponent, mages need ~2x more XP but get the same penalized amount.

---

## Early Game Fix Options

### Option A: No Overlevel Penalty Before L10 (Recommended)

```typescript
// Only apply overlevel penalty once player reaches L10
if (levelDiff > 0 && playerLevel >= 10) {
  xp *= Math.max(0.1, 1 - levelDiff * 0.1)
}
```

**Pros:** Directly helps mages farm early without affecting warrior mid/late game
**Cons:** Slight XP boost for warriors L1-9 (minimal impact)

### Option B: XP Floor for D1-10

```typescript
// Guarantee at least 50% XP in early depths
if (monsterDepth <= 10) {
  xp = Math.max(xp, monsterXP * depthScale * 0.5)
}
```

**Pros:** Simple, predictable
**Cons:** May not be enough for mages at L8+ farming D3

### Option C: Early Game XP Multiplier

```typescript
// Bonus XP while leveling up
if (playerLevel < 10) {
  xp *= 1.5
}
```

**Pros:** Speeds up early game for everyone
**Cons:** Makes warrior early game even faster

### Option D: Softer Overlevel Penalty

```typescript
// Reduce from 10%/level to 5%/level, floor at 30%
xp *= Math.max(0.3, 1 - levelDiff * 0.05)
```

**Pros:** Helps all overleveled scenarios
**Cons:** May re-break late game if warriors overlevel

---

## Monster Spawn Formula

From `src/game/monster-ai.ts:112`:
```typescript
const monsterCount = 5 + Math.floor(depth / 2)
```

| Depth | Spawned | ~Killed (85%) |
|-------|---------|---------------|
| D1 | 5 | 4 |
| D10 | 10 | 8 |
| D25 | 17 | 14 |
| D50 | 30 | 25 |

---

## Key Files

| File | Content |
|------|---------|
| `src/core/formulas.ts:91` | `XP_CURVE_EXPONENT = 1.8` |
| `src/core/formulas.ts:96` | `BASE_XP_REQUIREMENT = 100` |
| `src/core/formulas.ts:480-510` | `xpFromMonster()` with depth compression |
| `src/game/data/monsters.ts` | Monster `experience` values (Angband source) |
| `src/game/bot/preparation.ts:697-740` | SQUISHY level requirement (depth + 5) |
| `src/game/monster-ai.ts:112` | Monster spawn formula |

---

## Testing Commands

```bash
# Compare warrior vs mage progression
for turns in 5000 10000 15000 20000; do
  pnpm diagnose quick --seed=1000 --class=warrior --turns=$turns
  pnpm diagnose quick --seed=1000 --class=mage --turns=$turns
done

# Batch test (statistical)
pnpm diagnose batch --seed=1000 --runs=20 --turns=50000 --class=warrior
pnpm diagnose batch --seed=1000 --runs=20 --turns=50000 --class=mage

# Full baseline
pnpm diagnose baseline --seed=1000 --turns=50000
```

---

## Next Steps

**CLOSED** - XP curve changes reverted. Original balance preserved.

If revisiting in future:
1. The "problem" (L50 at D34) may not actually be a problem - baseline shows healthy endgame
2. Any XP changes must be validated against full 11-class baseline
3. Mage issues are likely bot AI (SQUISHY behavior), not XP formula
4. Consider whether level progression even matters if classes reach endgame

---

## Simulation vs Reality

Our simulations assumed flat 12 kills/depth. Actual data shows:
- Early game: 4-8 kills/depth
- Mid game: 10-15 kills/depth
- Late game: 20-25 kills/depth

Simulation predicted L50 at D49, actual result is D37. The difference comes from:
- Unique monster XP spikes (Bolg 800, Azog 1111)
- Level revisits giving extra kills
- Town portal farming phases
