# XP Curve Analysis

## Current Status (2026-02-05)

**OPEN** — Raw (no-upgrade) warrior runs still snowball past D20 to D40+.

Formula unchanged (`src/core/formulas.ts`):
- `XP_CURVE_EXPONENT`: 1.5
- `BASE_XP_REQUIREMENT`: 100
- `xpForLevel(level) = 100 * (level-1)^1.5`
- No overlevel penalty, no depth compression

Monster data changed: 12 new monsters added in D19-30 range (see Experiment 2). XP values unchanged from Angband source.

---

## The Problem

Raw (no-upgrade, no-capability) warrior runs that survive past D20 snowball to D40+. This is a 1-in-50 outlier but represents a broken XP economy in the D20-30 range.

### Raw Warrior Turn-Count Progression (50 runs, seed=1000)

| Turns | Avg Depth | Max Depth | Avg Level | Max Level |
|-------|-----------|-----------|-----------|-----------|
| 2k | 7.8 | 9 | ~3 | ~5 |
| 5k | 10.8 | 20 | 4.3 | 12 |
| 10k | 12.4 | 40 | 7.7 | 50 |
| 20k | 12.8 | 47 | 7.7 | 50 |
| 50k | 12.8 | 47 | 7.7 | 50 |

The snowball window is **5k-10k turns**: the outlier goes from D20/L12 to D40/L50.

### Root Cause: XP Growth Outpaces Level Requirements

Monster XP per depth grows **21x** from D10→D30, while XP-to-next-level only grows **3x** (L10→L50):

```
Depth | Kills | AvgXP | XP/Depth | Level | XPtoNext | Lvls/Depth
------|-------|-------|----------|-------|----------|----------
   10 |     8 |    46 |      368 |     3 |      237 |     1.6
   16 |    11 |    63 |      693 |     8 |      410 |     1.7
   20 |    12 |   133 |    1,596 |    15 |      571 |     2.8  ← inflection
   22 |    13 |   178 |    2,314 |    22 |      695 |     3.3
   25 |    14 |   280 |    3,920 |    35 |      881 |     4.5
   30 |    17 |   467 |    7,939 |    50 |    1,055 |     7.5
```

At D20+, characters gain 3-7 levels per depth. Total XP from D10-D40 is **92k** — nearly **3x** the 34.3k needed for L50. Once a raw warrior breaches D20, leveling outpaces the danger curve.

### Origin

Monster XP values imported from Angband (100 dungeon levels) compressed to 50 levels. XP values were never rescaled.

From Angband source (`src/mon-util.c:1072`):
```c
new_exp = ((long)mon->race->mexp * mon->race->level) / div;
// XP = (base_exp × monster_depth) / player_level
```

Angband's `/player_level` divisor naturally prevents snowballing. Borglike awards flat XP.

---

## Experiment 1: Formula Changes (2026-01-30) — FAILED

### Changes Attempted

1. **XP Curve Exponent**: 1.5 → 1.8
2. **Depth Compression**: `xp *= max(0.33, 1 - depth/75)` (100% at D1 → 33% at D50)
3. **Overlevel Penalty**: `xp *= max(0.1, 1 - levelDiff*0.1)` (disabled before L10/L15)

### Results (20 runs, 50k turns, seed=1000, max-upgrades)

| Class | Baseline | With Fixes | Delta | Verdict |
|-------|----------|------------|-------|---------|
| **Warrior** | 48.5 | 47.4 | -1.1 | ✅ Acceptable |
| **Mage** | 42.5 | 35.8 | **-6.7** | ❌ Regression |

### Why It Failed

All three changes hurt mages who intentionally farm lower depths:
- Mage at L8 farming D3: overlevel penalty → 40% XP, steeper curve → 2x requirements
- Mage batch avg dropped to D7.5 (stuck farming, never progressed)
- **Key insight**: any level-vs-depth penalty breaks the farming loop that casters rely on

**Reverted all changes.**

---

## Experiment 2: Monster Variety (2026-02-05) — PARTIAL SUCCESS

### Approach

Add monsters from Angband source to fill gaps in D19-30, creating a smoother difficulty ramp. "Add first, test, then reduce, test."

### 12 Monsters Added to `src/game/data/monsters.ts`

| Depth | Monster | XP | Key Traits |
|-------|---------|-----|------------|
| 19 | Ghast | 130 | Undead, paralyze claws |
| 19 | Killer Slicer Beetle | 150 | High armor (80), fast bites |
| 21 | Grave Wight | 200 | Undead, drain, scare/blind |
| 21 | Manticore | 220 | Fast (120), poison sting |
| 22 | Fire Elemental | 260 | Fire attacks + bolt, fire immune |
| 22 | Ogre Mage | 280 | Giant, confuse/slow spells |
| 23 | Earth Elemental | 300 | High armor (80), triple immune |
| 23 | Cave Troll | 320 | Troll, 3-attack |
| 25 | Water Elemental | 380 | Cold bolt + slow, acid/cold immune |
| 27 | Master Vampire | 550 | Fast, drain, hold/scare/confuse/dark |
| 29 | Death Knight | 650 | High HP (450), armor (90), blind/dark |
| 30 | Mountain Troll | 700 | Very high HP (550), 4-attack |

### Results

**Seed 1012 (former worst snowball):** D50 → D25 (died to Ghast paralyze)

**Raw warrior batch (50 runs, seed=1000):**

| Metric | Before (c5643d9) | After (new monsters) |
|--------|-------------------|----------------------|
| Avg depth | 13.1 | 12.8 |
| Max depth | 50 | 47 |
| Avg kills | 73 | 69 |

**Full baseline (max upgrades):** No regression — all 11 classes 45+ avg depth, 31+ Morgoth kills, CB ≤3%.

### Assessment

More monster variety improved the experience and killed the specific worst-case seed (1012). But the overall max depth only dropped from 50 to 47 — the snowball is slowed, not eliminated. A lucky raw warrior can still ride the XP curve to the mid-40s.

---

## Experiment 3: XP Value Reduction (2026-02-05) — INSUFFICIENT

### Approach

Cut all D20-30 regular (non-unique) monster XP values by 50% ("Cut B").

### Simulation Results

| Depth | Current AvgXP | Cut B AvgXP | Current Lvls/D | Cut B Lvls/D |
|-------|---------------|-------------|----------------|--------------|
| 20 | 121 | 100 | 2.6 | 2.3 |
| 22 | 166 | 114 | 3.2 | 2.4 |
| 25 | 276 | 149 | 4.6 | 2.8 |
| 28 | 353 | 177 | 5.5 | 3.2 |
| 30 | 457 | 228 | 7.4 | 4.0 |

### Actual Test Results (50 runs raw warrior)

| Turns | Before Max | Cut B Max | Delta |
|-------|-----------|-----------|-------|
| 5k | 20 | 20 | 0 |
| 10k | 40 | 39 | -1 |
| 20k | 47 | 45 | -2 |
| 50k | 47 | 45 | -2 |

### Why It Failed

1. **6-level spawn window**: Unchanged D15-19 monsters (XP 40-150) stay in the D20-25 pool, dragging the average up
2. **XP inversion**: After -50% cut, D18-19 monsters (120-150 XP) gave MORE XP than D20-21 monsters (75-175 XP)
3. **Still 2+ levels/depth**: Even at -50%, the bot gains 2.3-4.0 levels per depth through D20-30
4. **Total surplus unchanged**: D15-35 total XP was still 63k vs 34.3k needed for L50 (1.8x surplus)

**Reverted — XP reduction alone can't solve this without creating inversions.**

---

## Why Simple Fixes Don't Work

### The Fundamental Mismatch

| Mechanic | D10 | D20 | D30 | Growth |
|----------|-----|-----|-----|--------|
| Monsters per depth | 10 | 15 | 20 | 2x |
| Avg monster XP | 46 | 133 | 467 | 10x |
| **XP per depth** | **368** | **1,596** | **7,939** | **21x** |
| XP to next level | 237 | 571 | 1,055 | **3x** |

XP supply grows 21x while XP demand grows 3x. Any character that survives long enough hits a runaway feedback loop.

### Why Each Approach Hits a Wall

| Approach | Problem |
|----------|---------|
| **Formula changes** (exponent, compression, overlevel penalty) | All forms of level-vs-depth comparison hurt mages who intentionally farm lower depths |
| **XP value reduction** | Can't cut D20-30 below D15-19 without creating inversions; 6-level spawn window dilutes cuts |
| **Angband-style `/playerLevel` divisor** | Mathematically identical to overlevel penalty — same mage farming regression |
| **Steeper XP curve** (1.5→1.8) | Too aggressive at 1.8; modest increases (1.6) untested but would affect all progression |

---

## Open Ideas

### A. XP Cap Per Depth Visit

Cap total XP gained per depth at N× XP-to-next-level. Prevents gaining 3-7 levels per depth while preserving individual kill rewards.

```typescript
// Track XP gained on current depth, cap at 1.5x next-level
const cap = xpToNextLevel(level) * 1.5
if (xpGainedThisDepth + xpToAward > cap) {
  xpToAward = Math.max(0, cap - xpGainedThisDepth)
}
```

**Pros**: Directly targets multi-level-per-depth snowball. Doesn't compare level to depth. Doesn't create XP inversions.
**Cons**: Requires new state tracking (xpGainedThisDepth). Would also cap farming/sweep XP on a single depth.
**Risk**: Upgraded bots farming one depth repeatedly would hit cap each visit — need to test impact.

### B. Modest XP Curve Steepening (1.5 → 1.6)

| Level | 1.5 Exponent | 1.6 Exponent | Increase |
|-------|-------------|-------------|----------|
| L10 | 2,700 | 3,981 | +47% |
| L25 | 11,757 | 20,238 | +72% |
| L50 | 34,300 | 65,975 | +92% |

Doubles L50 requirement without the 3x increase of 1.8. May slow snowball enough without breaking mages.
**Risk**: Previous 1.8 broke mages. 1.6 is gentler but still global — needs full 11-class baseline testing.

### C. Global XP Reduction (balance flag)

Use the existing `balance.xpRatePercent` to reduce all XP by 30-50% globally.

**Pros**: One-line change, easy to tune.
**Cons**: Affects ALL classes at ALL tiers. Would need rebalancing of upgrade progression.

### D. Deeper Monster Additions (D31-50 gaps)

Current gaps: D37-38, D41-44, D46, D49. Filling these with appropriate monsters could create more death opportunities for snowball characters in the D30-50 range. Doesn't fix the root XP problem but makes the snowball harder to sustain.

### E. Combat Difficulty Scaling

Instead of touching XP, make D20-30 monsters harder to survive. Higher HP, more dangerous abilities. The bot survives D20 because the monsters aren't lethal enough relative to a L15+ character's HP pool.

---

## Upgraded vs Raw Progression (Reference)

Warrior batch, 50 runs each, seed=1000:

| Tier | Upgrades/Caps/Boosters | Avg Depth | Max Depth | Kills | Victories |
|------|------------------------|-----------|-----------|-------|-----------|
| Raw | none/none/none | 12.8 | 47 | 69 | 0 |
| Early | early/early/none | 16.6 | 50 | 112 | 0 |
| Mid | mid/mid/class | 40.7 | 50 | 415 | 0 |
| Late | late/late/class | 45.3 | 50 | 534 | 1 |
| Full | full/full/class | 45.7 | 50 | 482 | 0 |

The early→mid jump (+24 depth) is the biggest progression step. The raw→early gap (+4) is modest, suggesting upgrades matter most at mid tier (vitality 5, sweep, surf).

---

## Monster Spawn System

```typescript
// Spawn window: 6-level range
getSpawnableMonsters(depth) → filter(m => m.minDepth <= depth && m.minDepth >= depth - 6)

// Count per depth
const monsterCount = 5 + Math.floor(depth / 2)
```

| Depth | Spawned | ~Killed (85%) | Pool Size |
|-------|---------|---------------|-----------|
| D10 | 10 | 8 | 22 |
| D20 | 15 | 12 | 26 |
| D25 | 17 | 14 | 23 |
| D30 | 20 | 17 | 24 |
| D40 | 25 | 21 | 26 |

---

## Key Files

| File | Content |
|------|---------|
| `src/core/formulas.ts:22` | `XP_CURVE_EXPONENT = 1.5` |
| `src/core/formulas.ts:25` | `BASE_XP_REQUIREMENT = 100` |
| `src/core/formulas.ts:180` | `xpForLevel()` |
| `src/game/actions/combat.ts:213` | `handleMonsterKill()` — XP award flow |
| `src/game/data/monsters.ts` | Monster `experience` values |
| `src/game/data/monsters.ts:1653` | `getSpawnableMonsters()` — 6-level window |

---

## Testing Commands

```bash
# Raw warrior progression at different turn counts
for turns in 2000 5000 10000 20000 50000; do
  pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
    --upgrades=none --capabilities=none --boosters=none --turns=$turns
done

# Full baseline regression check
pnpm diagnose baseline --seed=1000 --turns=50000 --max-upgrades

# Specific seed investigation
pnpm diagnose quick --seed=1012 --class=warrior \
  --upgrades=none --capabilities=none --boosters=none --turns=50000

# XP curve simulation (node one-liner)
node -e "for(let l=1;l<=50;l+=5) console.log('L'+l, Math.floor(100*Math.pow(l-1,1.5)))"
```
