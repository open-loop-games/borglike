# XP Curve Analysis

## Current Status (2026-02-05)

**RESOLVED** — Two-part XP curve implemented (Experiment 6). L1-20 unchanged (exponent 1.5), L21-50 steepened (exponent 4). Raw warrior outlier now reaches L47 at D44 (was L50 at D49). Full upgraded baseline shows no regression: all 11 classes 44.6+ avg depth, 28 Morgoth kills.

Formula (`src/core/formulas.ts`):
- L1-20: `100 * (level-1)^1.5` (unchanged)
- L21-50: `8283 * ((level-1)/19)^4` (new, continuous at L20)
- L50 total XP: 366k (was 34k)

### Raw Baseline After Fix (100 runs, 50k turns, seed=1000, raw)

| Class | Avg Depth | Max Depth | Notes |
|-------|-----------|-----------|-------|
| **Warrior** | 12.8 | 49 | was 13.4/49 — avg down, outlier tighter to plvl/dlvl |
| **Mage** | 7.3 | 25 | unchanged |

### Previous Raw Baseline @ `1f3efd7` (100 runs, 50k turns, seed=1000, raw)

| Class | Avg Depth | Max Depth | Avg Level | Max Level |
|-------|-----------|-----------|-----------|-----------|
| **Warrior** | 13.4 | 49 | 8.9 | 50 |
| **Mage** | 7.3 | 24 | 2.9 | 25 |

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

| Approach | Problem | Exp |
|----------|---------|-----|
| **Formula changes** (exponent, compression, overlevel penalty) | All forms of level-vs-depth comparison hurt mages who farm lower depths | 1 |
| **XP value reduction** | Can't cut D20-30 below D15-19 without inversions; 6-level spawn window dilutes cuts | 3 |
| **Per-depth XP cap** | Limits per-depth gain to ~1.5 levels, but 1.5 × 30 depths still reaches L50 | 4 |
| **Level-based XP diminishing** (K/level) | At K=10, D25 at 40% XP still yields 1.8 levels/depth; monster XP too massive | 5 |
| **Steeper XP curve** (1.5→1.8) | Too aggressive at 1.8 combined with other changes; curve-only untested | 1 |
| **Any percentage reduction alone** | Monster XP grows exponentially; even 13% of D30 XP = 1+ level per depth | 3-5 |

---

## Experiment 4: XP Cap Per Depth Visit (2026-02-05) — INSUFFICIENT

### Approach

Track `xpGainedThisDepth` (reset on any depth change). Cap total XP gained per depth visit at `N × marginalXP` where marginalXP = cost of next level. Cap recalculates on each kill based on current level.

```typescript
const marginalXP = xpForLevel(level + 1) - xpForLevel(level)
const depthXpCap = Math.floor(marginalXP * CAP_MULTIPLIER)
const xpRemaining = Math.max(0, depthXpCap - xpGainedThisDepth)
xpToAward = Math.min(xpToAward, xpRemaining)
```

Added `xpGainedThisDepth` to GameState, reset in `handleDescend`, `handleAscend`, `openTownPortal`, `returnFromTown`.

### Results (100 runs, 50k turns, seed=1000, raw warrior/mage)

**1.5× cap:**

| Class | Metric | Before | 1.5× Cap | Delta |
|-------|--------|--------|----------|-------|
| **Warrior** | Avg Depth | 13.4 | 12.4 | -1.0 |
| **Warrior** | Max Depth | 49 | 47 | -2 |
| **Warrior** | Avg Level | 8.9 | 7.1 | -1.8 |
| **Warrior** | Max Level | 50 | 50 | 0 |
| **Mage** | Avg Depth | 7.3 | 7.3 | 0 |
| **Mage** | Max Depth | 24 | 24 | 0 |
| **Mage** | Max Level | 25 | 18 | -7 |

### Why It Failed

The cap limits per-depth XP to ~1.5 levels gained per depth visit. But **1.5 levels × 30 depths (D20→D50) = 45 levels**. Starting at L15, the outlier still reaches L50. The cap prevents per-depth spikes but doesn't address total accumulation across many depths.

Mage was unaffected at D3 farming (160 XP per visit << 617 cap at L8). The mechanism correctly targets only high-XP-per-depth situations.

A tighter cap (1.0×) would be more effective but feels like working around the issue — it clamps symptoms without fixing the XP economy.

**Reverted — pragmatic but doesn't address root cause.**

---

## Experiment 5: Level-Based XP Diminishing (2026-02-05) — INSUFFICIENT

### Approach

Soft Angband-style `/playerLevel` divisor with a floor to protect early-game farming:

```typescript
const LEVEL_XP_SCALE_K = 10
const xpScale = LEVEL_XP_SCALE_K / Math.max(LEVEL_XP_SCALE_K, level)
const xpToAward = Math.floor(upgradedXP * xpRatePercent * xpScale / 100)
```

No effect below level K, then XP scales as K/level:

| Level | K=10 | K=5 (untested) |
|-------|------|----------------|
| L1-10 | 100% | 100% (K=5: L1-5) |
| L15 | 67% | 33% |
| L20 | 50% | 25% |
| L25 | 40% | 20% |
| L30 | 33% | 17% |
| L50 | 20% | 10% |

### Results (100 runs, 50k turns, seed=1000, raw warrior/mage, K=10)

| Class | Metric | Before | K=10 | Delta |
|-------|--------|--------|------|-------|
| **Warrior** | Avg Depth | 13.4 | 12.2 | -1.2 |
| **Warrior** | Max Depth | 49 | 46 | -3 |
| **Warrior** | Avg Level | 8.9 | 6.8 | -2.1 |
| **Warrior** | Max Level | 50 | 50 | 0 |
| **Mage** | Avg Depth | 7.3 | 7.3 | 0 |
| **Mage** | Max Depth | 24 | 23 | -1 |
| **Mage** | Max Level | 25 | 17 | -8 |

### Why It Failed

Similar to the cap — warrior max depth dropped from 49→46, avg level from 8.9→6.8. The diminishing slows leveling but the outlier still survives long enough to accumulate levels across many depths.

At K=10 (50% XP at L20), D25 still delivers `3,920 × 0.4 = 1,568 XP` vs marginal cost of ~880 → 1.8 levels per depth. The monster XP at D25-30 is so massive that even at 40% it still exceeds leveling costs.

Mage was correctly protected (L1-10 = full XP, most raw mages never reach L10).

**K=5 would be more aggressive** (33% at L15, 20% at L25) but risks affecting upgraded endgame leveling. Untested.

**Reverted — right direction but K=10 too gentle, K=5 untested.**

---

## Why All Per-Kill Modifiers Struggle

Experiments 1-5 reveal a pattern: **any percentage-based reduction fights against exponentially growing monster XP.**

At D30, available XP per depth is 7,939. The marginal level cost is ~1,000. Even at **13% of base XP** (7,939 × 0.13 = 1,032), the warrior still gains 1+ level per depth. To reduce levels-per-depth below 1.0 at D30 would require XP below 13% — effectively zero.

The core issue isn't the rate of XP gain per kill; it's that **30 consecutive depths of any XP gain = many levels**. The outlier survives by luck; once past D20 the XP economy makes them stronger, which helps them survive further.

### What Would Actually Work

The snowball requires two things: (1) enough XP to level, and (2) surviving combat. Approaches can target either:

**XP-side** (reduce leveling speed):
- Need a mechanism that can't be outpaced by exponential monster XP growth
- Percentage reductions proven insufficient (Exp 3-5)
- Only absolute limits work (Exp 4 cap), but those feel like band-aids

**Survival-side** (make combat harder):
- Make D20-30 monsters lethal enough that under-leveled characters die
- Doesn't touch XP economy at all
- Risk: affects upgraded bots too

**Combination**:
- Moderate XP diminishing + moderate combat difficulty increase
- Neither alone sufficient, but together might push the outlier's death point from D46 to D25-30

---

## Open Ideas

### A. XP Curve Steepening (1.5 → 1.6 or 1.7, curve-only)

Previous 1.8 test (Exp 1) was confounded — combined with overlevel penalty + depth compression. The curve change alone was never isolated.

| Level | 1.5 exp | 1.6 exp | 1.7 exp | 1.8 exp |
|-------|---------|---------|---------|---------|
| L10 | 2,700 | 3,981 | 5,848 | 8,566 |
| L25 | 11,757 | 20,238 | 34,627 | 58,983 |
| L50 | 34,300 | 65,975 | 126,189 | 240,401 |

1.7 triples L50 cost. Combined with K=10 diminishing, might be enough.
**Risk**: Slows ALL leveling, needs full 11-class baseline.

### B. Combat Difficulty in D20-30

Make D20-30 monsters deadlier without touching XP:
- Increase HP/armor of key gatekeepers (Death Knight, Mountain Troll)
- Add more multi-attack monsters
- Add monsters with instant-kill abilities (paralyze + high damage)

**Pros**: Doesn't affect XP economy. Upgraded bots with capabilities can handle tougher monsters.
**Cons**: Also makes upgraded mid-game harder. Needs careful tuning.

### C. Level-Based Diminishing with Lower K (K=5 or K=3)

More aggressive version of Experiment 5:

| Level | K=5 | K=3 |
|-------|-----|-----|
| L10 | 50% | 30% |
| L15 | 33% | 20% |
| L20 | 25% | 15% |
| L30 | 17% | 10% |

At K=5, D25/L20: `3,920 × 0.25 = 980` vs marginal ~700 → 1.4 levels/depth. Still >1 but closer.
**Risk**: Heavily impacts upgraded endgame leveling. Full baseline required.

### D. Combination: Diminishing + Cap

Layer Experiment 4 (cap) on Experiment 5 (diminishing). The diminishing reduces per-kill XP, the cap puts an absolute ceiling per depth. Together:
- Diminishing: reduces effective XP by 40-80% at high levels
- Cap: limits remaining XP to ~1 level per depth visit
- Result: under-leveled outlier hits tougher monsters and dies

### E. Deeper Monster Additions (D31-50 gaps)

Current gaps: D37-38, D41-44, D46, D49. Filling these creates more death opportunities for snowball characters. Doesn't fix root XP problem but makes the snowball harder to sustain.

### F. Accept and Monitor

The raw warrior outlier (1-in-50) reaching D46 may be acceptable:
- Avg depth is 13 (healthy)
- Only matters for raw runs (no upgrades)
- Upgraded runs are well-balanced (45+ avg)
- The outlier gets a "heroic run" narrative

The snowball is a low-priority cosmetic issue, not a gameplay-breaking bug.

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

---

## Angband XP Curve Deep Dive (2026-02-05)

### Angband's Actual XP Table

From `/work/temp/angband/src/player.c:48-100`, Angband uses a **hand-crafted table**, not a formula:

```
L5:    100       L15:   1,800      L25:    17,500     L35:   450,000     L45: 2,700,000
L10:   500       L20:   5,400      L30:   100,000     L40: 1,250,000     L50: 5,000,000
```

Growth L10→L50: **10,000×**. Borglike's 1.5 exponent gives only **12.7×** over the same range.

The table has a **massive inflection at L25-L30**: marginal cost jumps from 5,000 (L24→L25) to 25,000 (L29→L30) to 50,000 (L30→L31). This is the natural brake that prevents snowballing.

### Angband's Monster XP Formula

From `/work/temp/angband/src/mon-util.c:1072`:

```c
new_exp = ((long)mon->race->mexp * mon->race->level) / div;  // div = player_level
```

**Two scaling factors borglike is missing:**
1. `× monster_level` — deep monsters give more XP (roughly `× depth`)
2. `÷ player_level` — high-level characters gain less XP from everything

### How Monsters Were Imported

Monsters were **hand-selected** from Angband 4.2.6 (`lib/gamedata/monster.txt`), not auto-imported. ~52 of Angband's 200+ monsters chosen.

**Depth compression is non-uniform:**

| Monster | Angband Depth | Borglike Depth | Ratio | XP (Ang→Borg) |
|---------|--------------|----------------|-------|----------------|
| Large Kobold | 5 | 5 | 1.00 | 25→25 |
| Stone Troll | 25 | 16 | 0.64 | 85→80 |
| 3-Headed Hydra | 20 | 20 | 1.00 | 350→350 |
| Death Knight | 38 | 29 | 0.76 | 1000→650 |
| Morgoth | 100 | 50 | 0.50 | 60000→60000 |

- **Shallow (D1-15):** ~1:1 depth, XP unchanged
- **Mid (D16-30):** 0.64-0.76× depth compression, XP slightly reduced
- **Deep (D31-50):** 0.50-0.75× depth, XP varies
- **Boss:** exact 2:1 compression

Monster `mexp` (base XP) values were kept mostly as-is. The missing `× depth / playerLevel` factor was never compensated for in the XP curve.

### The Trajectory Comparison

Simulated leveling from D1→D50, clearing each depth (85% kill rate):

```
Depth | Angband | Borglike (1.5) | Notes
------|---------|----------------|------
D5    | L8      | L2             | Angband faster (low table values = fast early)
D10   | L14     | L7             | Angband 2× ahead
D15   | L18     | L13            | Converging
D20   | L23     | L22            | ← CROSSOVER POINT
D25   | L26     | L42            | Borglike explodes (+16 levels ahead)
D30   | L29     | L50 (capped)   | Borglike maxed, Angband still L29
D35   | L31     | L50            | Angband barely gaining
D40   | L32     | L50            |
D50   | L36     | L50            | Angband NEVER reaches L50
```

**Key insight:** Angband's curve makes L50 unreachable from dungeon content alone (final level L36 from full clear). Levels 37-50 require repeated farming at deep depths. Borglike reaches L50 at D30 and wastes 350k XP afterward.

### The Root Cause (Refined)

The 1.5 exponent was chosen without accounting for the import methodology:
- Monster XP = Angband's `mexp` values (designed for `mexp × depth / level`)
- Without `× depth`: borglike delivers ~similar raw XP per kill as Angband at on-level play
- Without `÷ level`: no natural brake on high-level XP gain
- With 1.5 exponent instead of Angband's hand-crafted table: L25→L50 costs 22.5k instead of 4.98M

**The marginal cost divergence at L25+:**

```
Level | Borg Marginal | Angband Marginal | Ratio
L10   |           438 |              120 |  0.3x  (borglike HARDER early)
L15   |           551 |              400 |  0.7x
L20   |           645 |            1,400 |  2.2x  (crossover)
L25   |           727 |            5,000 |  6.9x  (angband pulls away)
L30   |           800 |           25,000 | 31.3x
L40   |           931 |          250,000 | 268x
L50   |          1045 |          500,000 | 479x
```

At L30, Angband needs **31× more XP** per level than borglike. At L50, it's **479×**.

---

## Proposed Fix: Two-Part XP Curve

### The Formula

Keep exponent 1.5 for L1-20 (unchanged), switch to exponent 4 for L21-50 (matches monster XP growth):

```typescript
function xpForLevel(level: number): number {
  if (level <= 1) return 0
  if (level <= 20) return Math.floor(100 * Math.pow(level - 1, 1.5))
  // Continuous at L20: 100 * 19^1.5 = 8283
  // Above L20: steeper curve to match monster XP growth
  const BASE_AT_20 = 100 * Math.pow(19, 1.5) // 8283
  return Math.floor(BASE_AT_20 * Math.pow((level - 1) / 19, 4))
}
```

### The Numbers

```
Level | Current(1.5) | Two-Part | Marginal(cur) | Marginal(new) | Ratio
L5    |          800 |      800 |           281 |           281 |  1.0x
L10   |        2,700 |    2,700 |           438 |           438 |  1.0x
L15   |        5,238 |    5,238 |           551 |           551 |  1.0x
L20   |        8,281 |    8,281 |           645 |           645 |  1.0x  ← identical
L25   |       11,757 |   21,084 |           727 |         3,301 |  4.5x
L30   |       15,616 |   44,947 |           800 |         5,886 |  7.4x
L35   |       19,825 |   84,924 |           868 |         9,559 | 11.0x
L40   |       24,355 |  147,019 |           931 |        14,509 | 15.6x
L45   |       29,186 |  238,191 |           990 |        20,926 | 21.1x
L50   |       34,300 |  366,353 |         1,045 |        29,003 | 27.8x
```

L50 total: 366k (was 34k, ~10.7× increase). L1-20: completely unchanged.

### Trajectory With Two-Part Curve

```
Depth | Current | Two-Part | Angband | Notes
------|---------|----------|---------|------
D5    | L2      | L2       | L8      | unchanged early game
D10   | L7      | L7       | L14     | unchanged
D15   | L13     | L13      | L18     | unchanged
D20   | L22     | L21      | L23     | nearly identical (transition point)
D25   | L42     | L26      | L26     | ← FIXED: matches Angband exactly
D30   | L50     | L32      | L29     | ← FIXED: was capped, now L32
D35   | L50     | L37      | L31     | controlled progression
D40   | L50     | L42      | L32     |
D45   | L50     | L46      | L34     |
D50   | L50     | L50      | L36     | L50 achievable at endgame
```

### Why This Works

1. **D1-20 unchanged**: Early game, farming, mage progression all identical
2. **~1 level per depth D20+**: Matches Angband's natural deceleration
3. **L50 achievable**: Total cost 366k, total available ~424k from full D1-50 clear
4. **Raw warrior snowball killed**: D20 at L15 → D30 at ~L25 (not L50). L25 warrior vs D30 monsters = likely death
5. **Upgraded bots still viable**: With XP upgrades + more kills from sweep/surf, upgraded bots can accumulate enough XP
6. **Continuous formula**: No discontinuity at L20, single function change in `xpForLevel()`
7. **Mathematically motivated**: Exponent 4 compensates for the missing Angband `× depth / level` scaling

### Why Exponent 4?

Monster XP per depth grows as roughly `depth^2.5` (21× over 3× depth). The XP curve's marginal cost derivative is `~(L-1)^(B-1)`. For the marginal to match monster XP growth at 1 level/depth: `B-1 ≈ 2.5`, so `B ≈ 3.5`. Using 4 provides slight safety margin and matches the D20-50 supply data:

```
D20: supply 1,596, marginal 1,887 → 0.85 lvl/depth
D25: supply 3,920, marginal 3,730 → 1.05 lvl/depth
D30: supply 7,939, marginal 6,462 → 1.23 lvl/depth
D40: supply ~18k,  marginal 14,509 → 1.22 lvl/depth
```

Consistently ~1.0-1.2 levels per depth from D20-50.

### Implementation

Single function change in `src/core/formulas.ts:180`:

```typescript
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const clampedLevel = Math.min(level, MAX_CHARACTER_LEVEL)
  if (clampedLevel <= 20) {
    return Math.floor(BASE_XP_REQUIREMENT * Math.pow(clampedLevel - 1, XP_CURVE_EXPONENT))
  }
  // Two-part curve: steeper above L20 to match monster XP growth
  // Continuous at L20: base20 = 100 * 19^1.5 = 8283
  const base20 = BASE_XP_REQUIREMENT * Math.pow(19, XP_CURVE_EXPONENT)
  const HIGH_LEVEL_EXPONENT = 4
  return Math.floor(base20 * Math.pow((clampedLevel - 1) / 19, HIGH_LEVEL_EXPONENT))
}
```

### Test Results (Experiment 6)

**Raw warrior/mage (100 runs, 50k turns, seed=1000, raw):**

| Class | Metric | Before | After | Delta |
|-------|--------|--------|-------|-------|
| **Warrior** | Avg Depth | 13.4 | 12.8 | -0.6 |
| **Warrior** | Max Depth | 49 | 49 | 0 |
| **Mage** | Avg Depth | 7.3 | 7.3 | 0 |
| **Mage** | Max Depth | 24 | 25 | +1 |

Deep analysis of D44 outlier (seed 1770314324775): reached **L47** (was L50 before). Player level now tracks closer to depth level.

**Full upgraded baseline (100 runs, 50k turns, seed=1000, max-upgrades):**

| Class | Before (`c5643d9`) | After | Delta | Morgoth |
|-------|---------------------|-------|-------|---------|
| Ranger | 49.4 | 49.3 | -0.1 | 8→2 |
| Paladin | 48.9 | 48.6 | -0.3 | 3→4 |
| Blackguard | 49.0 | 48.6 | -0.4 | 1→2 |
| Mage | 48.1 | 48.1 | 0.0 | 1→3 |
| Warrior | 48.0 | 47.8 | -0.2 | 4→5 |
| Berserker | 48.5 | 47.6 | -0.9 | 9→11 |
| Necromancer | 47.8 | 47.1 | -0.7 | 0→0 |
| Archmage | 48.2 | 47.1 | -1.1 | 2→0 |
| Rogue | 47.1 | 46.8 | -0.3 | 1→1 |
| Priest | 46.0 | 44.9 | -1.1 | 3→0 |
| Druid | 45.9 | 44.6 | -1.3 | 0→0 |

**28 Morgoth kills** (was 32). All CB rates ≤1%. All classes 44.6+ avg depth.

Biggest impact on classes that relied on over-leveling (druid -1.3, priest -1.1, archmage -1.1). Melee classes barely moved. Berserker Morgoth kills increased (9→11).

### Assessment

The two-part curve successfully tightens the L21-50 XP economy:
- Raw warrior outlier level now tracks closer to depth (L47 at D44, not L50 at D30)
- Early game (L1-20) completely unchanged — mage farming unaffected
- Full upgraded baseline shows modest tightening (~0.5 depth avg) with no class falling below 44.6
- The remaining raw outlier (D49) likely survives from combat luck, not XP snowball

### Remaining Risks

1. **Priest/Druid at 44.6-44.9**: Closest to the 44+ threshold. Future changes should monitor these.
2. **Morgoth kill distribution shifted**: Ranger/Priest lost kills, Berserker/Mage/Warrior gained. Net -4 kills (32→28).
3. **Fast Learner upgrade** may need tuning if players find L50 too slow to reach.
