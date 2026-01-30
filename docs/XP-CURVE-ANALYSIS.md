# XP Curve Analysis

## Problem Statement

The XP economy is broken: characters hit max level (50) by depth 26, leaving 24 depths of content with no progression incentive. Casters suffer most - they're stuck farming early depths (due to level >= depth + 5 requirement) where XP income is lowest.

**10k turn comparison (seed=1000):**

| Class | Depth | Level | Kills | XP |
|-------|-------|-------|-------|-----|
| Warrior | 34 | **50** | 321 | 106,770 |
| Mage | 3 | **8** | 144 | 1,926 |

Mage has 45% as many kills but only **1.8%** of the XP.

---

## Root Cause

Monster XP scales ~1000x from early to late game, but the level curve only requires ~7x more XP.

### XP Curve Formula

**File:** `src/core/formulas.ts:451-455`

```typescript
export const BASE_XP_REQUIREMENT = 100
export const XP_CURVE_EXPONENT = 1.5

export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  return Math.floor(BASE_XP_REQUIREMENT * Math.pow(level - 1, XP_CURVE_EXPONENT))
}
```

- Level 10: 2,262 XP
- Level 25: 8,944 XP
- Level 50: 34,300 XP (only 15x level 10)

### Monster XP by Depth

**File:** `src/game/data/monsters.ts`

| Depth | Avg Monster XP | Example |
|-------|----------------|---------|
| 1-5 | 10-45 | Small Kobold (8), Bullroarer (90) |
| 10 | 75 | Grishnakh (160), Giant Spider (35) |
| 20 | 433 | Bolg (800), 3-Headed Hydra (350) |
| 23 | 1,111 | Azog (1,111) |
| 35 | 1,800 | Mumak (2,100), Lokkak (1,500) |
| 40 | 3,275 | Beholder (6,000), 7-Headed Hydra (3,000) |
| 50 | 45,750 | Morgoth (60,000), Sauron (50,000) |

Monster XP grows **~4500x** (10 → 45,000) while level requirements grow **~15x**.

---

## Kills-to-Level Analysis

At each depth, how many kills to gain one level?

| Depth | XP/Level | Avg Monster | Kills Needed | Status |
|-------|----------|-------------|--------------|--------|
| 5 | 281 | 44 | 6.3 | ✅ Balanced |
| 10 | 438 | 75 | 5.8 | ✅ Balanced |
| 15 | 508 | 45 | 11.3 | 🐢 Slow |
| 19 | 591 | 284 | 2.1 | ⚡ Fast |
| 21 | 609 | 659 | **0.9** | 💥 Broken |
| 23 | 645 | 1,111 | **0.6** | 💥 Broken |
| 35 | 787 | 1,800 | **0.4** | 💥 Broken |

**Breakpoint: Depth 20-21** - Monster XP exceeds XP-per-level, causing instant leveling.

---

## Warrior Progression Timeline

**Seed 1000, max upgrades, cautious personality:**

| Turns | Depth | Level | Expected | Delta |
|-------|-------|-------|----------|-------|
| 1,000 | 4 | 2 | 4 | -2 |
| 2,000 | 8 | 4 | 7 | -3 |
| 5,000 | 17 | 13 | 14 | -1 |
| 5,500 | 19 | 16 | 16 | **0** (on curve) |
| 6,000 | 20 | 23 | 16 | +7 |
| 6,500 | 22 | 28 | 18 | +10 |
| 7,000 | 24 | 35 | 20 | +15 |
| 7,500 | 26 | **50** | 21 | +29 (MAX) |

**Spike occurs at depth 19-20** where uniques (Bolg 800 XP) and dragons appear.

---

## Level-Depth Constraints

**File:** `src/game/bot/preparation.ts:697-740`

Bot survivability requirements by class archetype:

| Archetype | Classes | Requirement | Effect |
|-----------|---------|-------------|--------|
| TANKY | warrior, berserker, blackguard | level >= depth - 4 | Can push 4 levels ahead |
| MEDIUM | paladin, ranger, rogue, etc. | level >= depth | Must match |
| SQUISHY | mage, archmage, necromancer | level >= depth + 5 | Need 5 level buffer |

**Impact:** Mages need level 8 for depth 3, level 25 for depth 20. They farm longer in low-XP zones.

---

## Solution Options

### Option 1: Increase XP Curve Exponent

Change `XP_CURVE_EXPONENT` from 1.5 to higher value:

| Exponent | L50 XP | D10 Ratio | D30 Ratio | D50 Ratio |
|----------|--------|-----------|-----------|-----------|
| 1.5 (current) | 34k | 1.3 ✅ | 8.1 💥 | 60 💥 |
| 2.0 | 240k | 0.4 🐢 | 1.6 ⚡ | 7.8 💥 |
| 2.25 | 635k | 0.3 🐢 | 0.7 ✅ | 3.1 💥 |
| 2.5 | 1.68M | 0.2 🐢 | 0.3 🐢 | 1.2 ✅ |

**Problem:** No single exponent fixes it - makes early game too slow or late game still broken.

### Option 2: Edit Monster XP (Static Data)

Adjust `experience` values in `src/game/data/monsters.ts`:

| Depth | Current Avg | Suggested | Change |
|-------|-------------|-----------|--------|
| 1-5 | 10-45 | 15-55 | +20% |
| 6-10 | 15-75 | 20-80 | +10% |
| 11-15 | 35-50 | 35-50 | — |
| 16-20 | 80-430 | 40-170 | -60% |
| 21-30 | 450-1100 | 110-275 | -75% |
| 31-40 | 600-3300 | 90-500 | -85% |
| 41-50 | 4000-60000 | 400-6000 | -90% |

**Problem:** 70+ monsters to edit, and values lose connection to source material.

### Option 3: Hybrid Approach (Recommended)

1. **Increase exponent to 2.0** (240k XP for L50 vs 34k)
2. **+20% early monster XP** (D1-10) - help caster farming
3. **-50% late monster XP** (D35+) - prevent endgame spike

This balances:
- Formula change handles bulk of rebalancing
- Targeted monster edits only where needed
- Early game buff helps casters
- Late game nerf prevents instant max level

---

## Key Files

| File | Content |
|------|---------|
| `src/core/formulas.ts:451-455` | XP curve formula, `XP_CURVE_EXPONENT` |
| `src/core/formulas.ts:489` | Expected level formula: `ceil(depth * 0.8)` |
| `src/core/formulas.ts:480-501` | XP bonus/penalty for over/underleveling |
| `src/game/data/monsters.ts` | All monster definitions with `experience` field |
| `src/game/bot/preparation.ts:697-740` | Level-depth requirements by class |
| `src/game/character.ts` | Level-up logic |

---

## Testing Commands

```bash
# Compare warrior vs mage at 10k turns
pnpm diagnose quick --seed=1000 --class=warrior --turns=10000
pnpm diagnose quick --seed=1000 --class=mage --turns=10000

# Progression timeline
for turns in 1000 2000 3000 5000 7500 10000; do
  pnpm diagnose quick --seed=1000 --class=warrior --turns=$turns
done

# Full baseline
pnpm diagnose baseline --seed=1000 --turns=50000
```

---

## Diagnostic Output Fields

Added `level` and `xp` to diagnose output:

**Files modified:**
- `scripts/lib/diagnose/types.ts` - Added to `finalState` interface
- `scripts/lib/diagnose/runner.ts` - Populate in `runDiagnosis`, `runDeepDiagnosis`
- `scripts/lib/diagnose/worker.ts` - Populate in worker
- `scripts/lib/diagnose/output.ts` - Display in formatted output

---

## Next Steps

1. Decide on approach (exponent change vs static data vs hybrid)
2. Implement changes
3. Run baseline comparison before/after
4. Verify caster farming time improves
5. Verify warrior doesn't hit L50 before depth 40+
