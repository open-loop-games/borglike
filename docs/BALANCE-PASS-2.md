# Balance Test Plan

Target win rates:
- **Unupgraded:** 1:1,000,000 (possible with perfect luck)
- **Max Upgrades:** 1:5,000 (achievable with good play)

Current state (200 runs):
- Unupgraded: avg depth 4.9, max depth 9
- Max upgrades: avg depth 9.9, max depth 16
- Victory requires: depth 50, kill Morgoth (20k HP)

---

## Diagnostic Flags

All flags work with `batch`, `deep`, and `quick` modes.

### Tier 1: High Impact

| Flag | Default | Description |
|------|---------|-------------|
| `--monster-hp=N` | 100 | Monster HP percentage (50 = half HP) |
| `--monster-damage=N` | 100 | Monster damage percentage |
| `--start-potions=N` | 3 | Starting healing potions |
| `--potion-rate=N` | 100 | Potion spawn rate percentage |
| `--regen=N` | 0 | Passive HP regen per 10 turns (out of combat) |
| `--armor-pen=N` | 0 | Flat armor penetration for player |

### Tier 2: Medium Impact

| Flag | Default | Description |
|------|---------|-------------|
| `--enchant-rate=N` | 100 | Enchantment chance multiplier |
| `--item-rate=N` | 100 | Items per level multiplier |
| `--levelup-hp=N` | 100 | Level-up HP gain multiplier |

### Tier 3: Tuning

| Flag | Default | Description |
|------|---------|-------------|
| `--xp-rate=N` | 100 | XP gain multiplier |
| `--upgrade-power=N` | 100 | Upgrade effect multiplier |

---

## Test Matrix

### Phase 1: Identify Primary Bottleneck

**Hypothesis A: Kill speed is the bottleneck**
```bash
# Baseline
npx tsx scripts/diagnose.ts batch --runs=200

# Test: Monsters have 50% HP
npx tsx scripts/diagnose.ts batch --runs=200 --monster-hp=50

# Test: Monsters have 25% HP
npx tsx scripts/diagnose.ts batch --runs=200 --monster-hp=25
```

**Hypothesis B: Sustain is the bottleneck**
```bash
# Test: Double starting potions
npx tsx scripts/diagnose.ts batch --runs=200 --start-potions=6

# Test: Passive regen
npx tsx scripts/diagnose.ts batch --runs=200 --regen=1

# Test: More potion drops
npx tsx scripts/diagnose.ts batch --runs=200 --potion-rate=200
```

**Hypothesis C: Monster damage is too high**
```bash
# Test: Monsters deal 75% damage
npx tsx scripts/diagnose.ts batch --runs=200 --monster-damage=75

# Test: Monsters deal 50% damage
npx tsx scripts/diagnose.ts batch --runs=200 --monster-damage=50
```

### Phase 2: Refine Winning Hypothesis

Once we identify which lever moves depth the most, test combinations:

```bash
# Example: If sustain wins, test sustain + mild monster nerf
npx tsx scripts/diagnose.ts batch --runs=200 --start-potions=5 --monster-hp=75

# Example: If kill speed wins, test with upgrades
npx tsx scripts/diagnose.ts batch --runs=200 --monster-hp=50 --max-upgrades
```

### Phase 3: Tune for Target Win Rates

Find settings where:
- Unupgraded reaches depth 30-40 occasionally (extrapolate to 1:1M for D50)
- Max upgrades reaches depth 45-50 occasionally (target 1:5000)

```bash
# Long runs to find rare deep runs
npx tsx scripts/diagnose.ts batch --runs=1000 --turns=10000 [tuned flags]
```

---

## Success Metrics

| Metric | Unupgraded Target | Max Upgrades Target |
|--------|-------------------|---------------------|
| Avg Depth | 8-12 | 25-35 |
| Max Depth (per 200) | 20-25 | 40-45 |
| P99 Depth (per 1000) | 30+ | 48+ |

---

## Test Results

### Phase 1: Identify Primary Bottleneck (2026-01-21)

**Unupgraded (200 runs each):**

| Test | Avg Depth | Max Depth | Avg Kills | CB% |
|------|-----------|-----------|-----------|-----|
| **Baseline** | 4.8 | 9 | 15.7 | 2% |
| Monster HP 50% | 7.4 | 15 | 29.0 | 6% |
| Monster HP 25% | 10.9 | 17 | 50.4 | 14% |
| Monster Damage 50% | 4.9 | 11 | 16.0 | 4% |
| Start Potions 6 | 5.0 | 11 | 16.8 | 2% |
| Regen 1/10 turns | 5.3 | 11 | 18.2 | 4% |
| Potion Rate 200% | 4.9 | 9 | 16.2 | 3% |
| Armor Pen 10 | 5.3 | 10 | 18.0 | 4% |

**Max Upgrades (200 runs each):**

| Test | Avg Depth | Max Depth | Avg Kills | CB% |
|------|-----------|-----------|-----------|-----|
| Baseline | 9.7 | 14 | 39.5 | 12% |
| Monster HP 50% | 12.0 | 16 | 54.7 | 14% |
| Monster HP 25% | 13.2 | 19 | 64.8 | 23% |

**Key Findings:**
1. **Monster HP is the dominant factor** - 50% HP doubles depth, sustain barely moves needle
2. Monster damage reduction has almost no effect (4.9 vs 4.8 baseline)
3. Sustain (potions, regen) has minimal impact (~0.2-0.5 depth gain)
4. Max upgrades roughly doubles performance
5. Circuit breaker rate increases with depth (bot exploration limits)

**Conclusion:** Kill speed is the bottleneck, not sustain. Need to reduce monster HP or increase player damage to reach depth 50.

### Phase 1b: Extreme Monster HP (2026-01-21)

| Test | Avg Depth | Max Depth | Avg Kills | CB% |
|------|-----------|-----------|-----------|-----|
| Unupgraded HP 10% | 12.7 | 19 | 64.6 | 23% |
| Max Upgrades HP 10% | 15.1 | 19 | 81.8 | 14% |
| Max Upgrades HP 5% | 15.3 | 20 | 84.9 | 18% |

**Observation:** Even at 5-10% monster HP, max depth plateaus around 19-20. This suggests a **bot/exploration ceiling**, not a combat ceiling. The circuit breaker rate (14-23%) confirms the bot gets stuck exploring.

### Phase 1c: Tier 2 Levers (2026-01-21)

**Unupgraded (200 runs each):**

| Test | Avg Depth | Max Depth | Avg Kills | CB% |
|------|-----------|-----------|-----------|-----|
| Baseline | 4.8 | 9 | 15.7 | 2% |
| Enchant 200% | 4.7 | 10 | 15.3 | 5% |
| Item 200% | 4.9 | 9 | 15.4 | 3% |
| Levelup HP 200% | 4.8 | 9 | 15.7 | 2% |
| XP 200% | 5.4 | 12 | 18.3 | 7% |

**Observation:** Only XP rate has a modest effect (+0.6 avg depth). Other tier 2 levers are ineffective.

### Death Cause Analysis (100 runs baseline)

| Monster | Deaths | % |
|---------|--------|---|
| Orc | 24 | 24% |
| Large Kobold | 20 | 20% |
| Kobold | 9 | 9% |
| Giant Bat | 9 | 9% |
| Bullroarer the Hobbit | 7 | 7% |
| Large White Snake | 6 | 6% |

**Key Finding:** Common early-game monsters (Orc, Large Kobold) account for ~44% of all deaths. These appear at depths 1-4.

### Death Cause at Higher Depths (HP 25%, 200 runs)

**Unupgraded (avg depth 10.5):**
| Monster | Deaths | % |
|---------|--------|---|
| Giant Spider | 39 | 20% |
| Wormtongue, Agent of Saruman | 32 | 16% |
| Grishnakh, the Hill Orc | 25 | 13% |
| Large Kobold | 11 | 6% |

**Max Upgrades (avg depth 12.8):**
| Monster | Deaths | % |
|---------|--------|---|
| Grishnakh, the Hill Orc | 31 | 16% |
| (Others <2%) | - | - |

**Critical Finding:** With max upgrades + HP 25%, **23% of runs hit circuit breaker** vs only 16% dying to combat. The bottleneck has shifted from combat to **bot exploration AI limitations**.

### Conclusions

1. **Monster HP is the only effective combat lever** - sustain and tier 2 levers are negligible
2. **Bot exploration is the ceiling** - even with trivial combat, max depth plateaus at ~19-20
3. **Uniques become gatekeepers** at mid-depths (Wormtongue d8, Grishnakh d10)
4. **To reach depth 50**, we need either:
   - Massively improved bot navigation AI
   - Or accept that depth 20 is the practical ceiling with current AI

---

## Seeds to Investigate

**Circuit Breaker (bot stuck) - max upgrades + HP 25%:**
```bash
# Early stuck (depths 3-7)
npx tsx scripts/diagnose.ts deep 1769022038599 --max-upgrades --monster-hp=25 --map  # D3
npx tsx scripts/diagnose.ts deep 1769022038589 --max-upgrades --monster-hp=25 --map  # D4
npx tsx scripts/diagnose.ts deep 1769022038588 --max-upgrades --monster-hp=25 --map  # D6
npx tsx scripts/diagnose.ts deep 1769022038603 --max-upgrades --monster-hp=25 --map  # D7

# Deep stuck (depths 11-13)
npx tsx scripts/diagnose.ts deep 1769022038573 --max-upgrades --monster-hp=25 --map  # D11
npx tsx scripts/diagnose.ts deep 1769022038575 --max-upgrades --monster-hp=25 --map  # D12
npx tsx scripts/diagnose.ts deep 1769022038580 --max-upgrades --monster-hp=25 --map  # D13
```

**Deaths at various depths:**
```bash
npx tsx scripts/diagnose.ts deep 1769022038586 --max-upgrades --monster-hp=25  # D14 death
npx tsx scripts/diagnose.ts deep 1769022038591 --max-upgrades --monster-hp=25  # D12 death
npx tsx scripts/diagnose.ts deep 1769022038604 --max-upgrades --monster-hp=25  # D15 death
```

**Baseline circuit breakers:**
```bash
npx tsx scripts/diagnose.ts deep 1769022252262 --full-map  # D3 CB
npx tsx scripts/diagnose.ts deep 1769022252300 --full-map  # D2 CB
npx tsx scripts/diagnose.ts deep 1769022252310 --full-map  # D3 CB
npx tsx scripts/diagnose.ts deep 1769022252304 --full-map  # D6 CB
```

### Investigation Notes

**Seed 1769022252300 (D2 circuit breaker):**
- Explored 70.9% of map, but stairs not found
- Stairs (>) visible at ~(16, 26), player at ~(9, 24) - only ~10 tiles away!
- Key issue: "61% of EXPLORE goals were short-distance" - bot thrashing
- "10 consecutive short-distance goals (< 3 tiles)" - exploration inefficient
- **Root cause:** Bot not prioritizing stairs once visible, short-distance goal thrashing

**Seed 1769022252262 (D5 death):**
- Explored only 32% of map
- Bot fought Large Kobold from HP 9 → 0 without retreating
- 25 consecutive attack actions while taking damage every turn
- **Root cause:** Bug in `handleCriticalTier()` (tick.ts:156-221)

**Detailed Analysis:**

The "cautious" personality has `caution: 50`, meaning retreat at 50% HP. With HP 9 (likely ~30% of max), `shouldRetreat()` would return `true`. However, the retreat logic is never consulted during CRITICAL tier handling.

The bug flow:
1. `getImmediateDangerTier()` returns CRITICAL when `immediateDanger >= currentHP`
2. `handleCriticalTier()` is called
3. Steps 1-4 try escape spells, consumables, healing - all fail (no items)
4. **Step 5: If adjacent monster → ATTACK** (the bug!)
5. Step 6 (move away) is never reached

The FLEE goal evaluation only happens in `handleGoalMovement()` (fallback), but `handleCriticalTier()` short-circuits by returning an attack action.

**Investigation Result (2026-01-21):** Tested adding flee-before-attack logic, but this caused a regression (avg depth 4.8 → 3.9). Fighting to death is actually optimal because:
- Fleeing delays death but doesn't prevent it
- Fleeing forfeits XP from kills → weaker character
- Weaker character dies to later monsters anyway

**Conclusion:** Not a bug - the "desperate attack" behavior is intentional and optimal for progression.

---

## Bot AI Issues Identified

| Issue | Location | Impact | Priority | Status |
|-------|----------|--------|----------|--------|
| Desperate attack overrides flee | `tick.ts:handleCriticalTier()` | Deaths at critical HP | LOW | ✅ WORKING AS INTENDED |
| Stairs not prioritized when visible | `tick.ts:updateKnownStairs()` | Circuit breakers | MEDIUM | ✅ FIXED |
| Short-distance exploration thrashing | `exploration.ts` | Inefficient movement | LOW | ⚠️ LIMITED BY FOV 2 |
| Stuck on level without finding stairs | `survival-consumables.ts` | Circuit breakers | HIGH | ✅ FIXED (scroll system) |

### Stairs Visibility Fix (2026-01-21)

**Problem:** Bot only marked stairs as "known" when walked on (tile.explored). Could see stairs but not prioritize them.

**Fix:** Also mark stairs known when `tile.visible && reachable` (verified via flow computation).

**Results (100 runs, seed=999999, max upgrades, HP 25%):**
| Metric | Before | After |
|--------|--------|-------|
| Avg Depth | 12.5 | 13.3 |
| CB Rate | 25% | 20% |

Fix reduces circuit breaker rate by 5% at deeper depths with no impact on baseline performance.

### Stuck Exploration Scrolls (2026-01-21)

**Problem:** Bot still hitting circuit breakers ~20% at higher depths due to inability to find stairs.

**Solution:** Added tiered scroll usage system based on turns-on-level:

| Threshold | Scroll | Effect |
|-----------|--------|--------|
| 200+ turns | Scroll of Detect Stairs | Reveals stairs location only |
| 400+ turns | Scroll of Magic Mapping | Reveals entire level |
| 600+ turns | Scroll of Teleport Level | Skips to next depth |

**Implementation:**
1. New scroll: `Scroll of Detect Stairs` (tier 1, minDepth 0)
2. Starting inventory: +1 Detect Stairs scroll
3. Bot uses scrolls via `getStuckExplorationAction()` in fallback handling
4. Uses only when not in combat and threshold exceeded

**Results (100 runs, seed=999999, max upgrades, HP 25%):**
| Metric | Before (stairs fix only) | After (+ scroll system) |
|--------|--------------------------|-------------------------|
| Avg Depth | 13.3 | 13.8 |
| Max Depth | 19 | 19 |
| CB Rate | 20% | 15% |

Scroll system reduces circuit breaker rate by additional 5 percentage points.

**Verified scroll usage in deep dive:**
- Turn 528 (depth 2): `use:Scroll of Detect Stairs` → bot immediately changes goal to DESCEND
- Turn 1805 (depth 6): `use:Scroll of Magic Mapping` → reveals entire level

---

## Angband-Style Anti-Stuck System

### Current State

**Short-term stuck recovery** (turns since last progress):
| Level | Threshold | Action |
|-------|-----------|--------|
| 1 | 5 turns | Wall following |
| 2 | 12 turns | Clear history / fight adjacent |
| 3 | 25 turns | Force descent (if stairs known) |
| 4 | 50 turns | Wait (give up) |

**Gap:** 50-200 turns has no intervention

**Scroll system** (turns on level):
| Threshold | Action |
|-----------|--------|
| 200 turns | Detect Stairs scroll |
| 400 turns | Magic Mapping scroll |
| 600 turns | Teleport Level scroll |

**Circuit breaker:** 1000 turns on level → hard kill

### Angband Borg Reference

| Threshold | Action | Purpose |
|-----------|--------|---------|
| 300 turns | Clear goals | Soft reset |
| 500 turns | Forget monsters/objects | Clear cached knowledge |
| 700 turns | Start fleeing | Give up on level |
| 10000 turns | "Boredom" | Final flee |

Key insight: Angband never hard-kills, just escalates behavioral changes.

### Planned Improvements

| # | Change | Location | Threshold |
|---|--------|----------|-----------|
| 1 | Extend stuck thresholds | `stuck.ts` | Add levels 5-7 at 100, 200, 300 |
| 2 | Clear goals action | `stuck.ts` | ~150 turns |
| 3 | Clear blacklist action | `stuck.ts` | ~300 turns |
| 4 | Force flee behavior | `stuck.ts` | ~500 turns |
| 5 | Soft CB (flee not kill) | `tick.ts` | 1000 turns |

### A/B Tests To Run

After implementing the anti-stuck improvements:

```bash
# Baseline (current, with scroll system)
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888

# Test A: Extended stuck thresholds only
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888
# (compare after implementing #1)

# Test B: Clear goals at 150 turns
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888
# (compare after implementing #2)

# Test C: Clear blacklist at 300 turns
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888
# (compare after implementing #3)

# Test D: Force flee at 500 turns
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888
# (compare after implementing #4)

# Test E: Soft CB (no hard kill)
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888
# (compare after implementing #5)

# Full system test (max upgrades + HP 25% to stress test)
npx tsx scripts/diagnose.ts batch --runs=200 --seed=888888 --max-upgrades --monster-hp=25
```

**Success Metrics:**
| Metric | Current | Target |
|--------|---------|--------|
| CB Rate (baseline) | 0-2% | 0% |
| CB Rate (max+HP25) | 15% | <5% |
| Avg Depth (max+HP25) | 13.8 | 15+ |

### A/B Test Results (2026-01-21)

All tests run with `--seed=888888 --max-upgrades --monster-hp=25`

**200-run tests (high variance):**

| Test | CB Rate | Avg Depth | Max Depth | Notes |
|------|---------|-----------|-----------|-------|
| Baseline | 18% (35) | 13.4 | 19 | Scroll system only |
| A: +clear_goals (100t) | 17% (34) | 14.0 | 21 | Marginal improvement |
| B: +clear_blacklist (200t) | 13% (25) | 13.8 | 19 | Apparent best |
| C: +force_flee (300t) | 15% (30) | 13.9 | 20 | Regression, reverted |
| D: B + Soft CB (800/1200) | 16% (31) | 13.7 | 19 | No improvement, reverted |

**500-run verification (Test B - more stable):**

| Metric | Value |
|--------|-------|
| CB Rate | **16% (78/500)** |
| Avg Depth | 13.6 |
| Max Depth | 19 |

**Conclusion:** Test B is kept. Final implementation includes:
- `clear_goals` at 100 turns since progress (LEVEL_5)
- `clear_blacklist` at 200 turns since progress (LEVEL_6)
- Hard CB unchanged at 1000 turns on level

**Impact:** CB rate reduced from ~18% → ~16% (~11% relative reduction). The 200-run tests showed higher variance than expected.

---

## Combat System Review (2026-01-21)

### Borglike Combat Formula Summary

#### Player Melee Damage
```
baseDamage = STR/3 + weaponDamage + enchantment + artifactBonus
scaledDamage = baseDamage * (1 + upgradeDamagePercent/100)
effectiveArmor = max(0, defenderArmor - armorPenetration)
finalBase = max(1, scaledDamage - effectiveArmor/2)
variance = random(0.8, 1.2)
critical = 5% chance → 2x multiplier
knowledgeBonus = 0-25% based on kills
```

#### Player Ranged Damage
```
baseDamage = DEX/3 + bowDamage + enchantment + artifactBonus
distancePenalty = max(0, distance - 2) * 5  // -5% hit per tile beyond 2
(same scaling as melee)
```

#### Monster Damage
```
baseDamage = template.damage (flat value)
accuracy = 50 + (speed - 110) / 2
weakenDebuff → damage * (100 - debuffValue) / 100
blindDebuff → accuracy * (100 - blindValue) / 100
```

#### Armor Reduction
- Armor halves when reducing: `damage - armor/2`
- AC cap: None (unlike Angband's 240 cap)
- Armor penetration: Subtracted before calculation

#### Hit Chance
```
hitChance = 50 + attackerAccuracy - defenderEvasion
clamped to 5-95%
```

### Angband Reference (for comparison)

| Mechanic | Angband | Borglike |
|----------|---------|----------|
| Armor reduction | `damage * (1 - AC/400)` max 60% | `damage - armor/2` |
| Critical chance | Scaled by weight/skill/level | Flat 5% |
| Critical damage | 2x-4x + flat bonus | 2x only |
| Hit floor/ceiling | 12% always hit, 5% always miss | 5-95% clamp |
| Distance penalty | -1 to-hit per tile | -5% accuracy per tile beyond 2 |
| Deadliness | Lookup table 0-255% | Linear percentage |

### Wiring Verification ✅

All modifiers correctly applied:
- ✅ Upgrade bonuses (Might, Resilience, Precision, Swiftness)
- ✅ Equipment enchantments and artifacts
- ✅ Status effects (Heroism, Blessing, Berserk)
- ✅ Knowledge bonuses (bestiary damage bonus)
- ✅ Armor penetration balance override
- ✅ Critical hits (5% → 2x)
- ✅ Damage variance (±20%)
- ✅ Monster debuffs (Weaken, Blind)

### Potential Balance Levers

Based on Angband comparison, potential improvements:

1. **Scaled criticals** - Weight/skill-based crit chance instead of flat 5%
2. **AC cap** - Angband caps AC effect at 240 (60% reduction)
3. **Guaranteed hit/miss** - Angband has 12% floor, 5% ceiling
4. **Deadliness scaling** - Non-linear damage bonus curve
5. **Stun mechanics** - Angband reduces both hit and damage by 25% when stunned

### Current Balance State

With max upgrades + HP 25%:
- CB rate: ~12% (with CB threshold at 2000)
- Avg depth: ~14
- Max depth: 19
- Main killer: Grishnakh (depth 10 unique)

### Baseline Stats at Death (No Upgrades)

200 runs, Human Warrior, seed 888888:

| Stat | Min | Avg | Max | Notes |
|------|-----|-----|-----|-------|
| Level | 1 | 1.1 | 2 | Rarely level up before death |
| Depth | 2 | 4.8 | 11 | Consistent with key metrics |
| Armor | 15 | 17.1 | 27 | Little variation from base gear |
| Melee Damage | 8 | 8.2 | 12 | Short Sword + STR mod baseline |
| Ranged Damage | 4 | 4 | 4 | No bow upgrades |
| Accuracy | 63 | 63 | 64 | Essentially constant |
| Evasion | 6 | 6 | 6 | No DEX gear |
| Max HP | 30 | 32.7 | 60 | Some level-up HP |
| Speed | 100 | 100 | 100 | No speed items |
| Weapon Enchant | 0 | 0.1 | +2 | Most die with basic gear |
| Armor Protection | 12 | 12 | 16 | Studded leather base |

**Key Observations:**
1. Characters rarely level up (1.1 avg) - XP gain too slow vs death rate
2. Gear stays near starting quality - enchanted items rare on early depths
3. Melee damage flat at 8 - no damage progression
4. Armor 17 vs monster damage 10-20 → taking 5-15 damage per hit

**Top Killers (No Upgrades):**
1. Orc (29%) - 15 HP, 8 damage, depth 3-5
2. Large Kobold (16%) - 10 HP, 6 damage, depth 2-3
3. Giant Bat (7%) - 7 HP, 5 damage, depth 2-4
4. Kobold (7%) - 4 HP, 4 damage, depth 1-2

### Max Upgrades Stats at Death

200 runs, Human Warrior, seed 888888, --max-upgrades:

| Stat | Min | Avg | Max | vs No Upgrades |
|------|-----|-----|-----|----------------|
| Level | 1 | 3.5 | 8 | **3.2x** |
| Depth | 4 | 10.0 | 17 | **2.1x** |
| Armor | 20 | 25.8 | 47 | 1.5x |
| Melee Damage | 9 | 10.7 | 34 | 1.3x |
| Ranged Damage | 4 | 4 | 4 | 1.0x |
| Accuracy | 78 | 80.6 | 99 | 1.3x |
| Evasion | 31 | 31 | 32 | **5.2x** |
| Max HP | 80 | 155.8 | 293 | **4.8x** |
| Speed | 110 | 110 | 110 | 1.1x |
| Weapon Enchant | 0 | 0.3 | +2 | — |
| Armor Protection | 12 | 12.4 | 18 | — |
| Kills | 13 | 39.5 | 70 | **2.6x** |
| Damage Taken | 62 | 464.8 | 988 | 3.8x |

**Upgrade Impact Analysis:**

| Category | Impact | Notes |
|----------|--------|-------|
| HP | **+4.8x** | Dominant upgrade effect |
| Evasion | **+5.2x** | From 6→31, huge relative gain |
| Accuracy | +1.3x | 63→81, modest improvement |
| Armor | +1.5x | 17→26, helpful but not dominant |
| Melee Dmg | +1.3x | 8→11, underwhelming scaling |
| Ranged Dmg | 0 | No improvement at all |
| Speed | +1.1x | 100→110, minor benefit |

**Top Killers (Max Upgrades):**
1. Wormtongue (22%) - Unique, depth 8, paralyze spell
2. Giant Spider (11%) - 20 HP, 12 damage, poison, depth 8-10
3. Large Kobold (10%) - Still killing despite upgrades!
4. Grishnakh (8%) - Unique, depth 10, high damage

**Key Finding: Damage is the Bottleneck**

Upgrades massively boost survivability but barely improve kill speed:
- Characters live 3.8x longer (damage taken 123→465)
- But only deal 1.3x more damage
- This means fights take longer → more attrition damage
- Eventually overwhelmed by stronger monsters at depth 10+

**Potential Fixes:**
1. Add damage-focused upgrades (currently HP/evasion dominant)
2. Improve weapon enchant scaling
3. Add ranged damage upgrades
4. Scale melee damage with level more aggressively

---

## Multi-Attack Implementation (2026-01-21)

### The Problem

The `maxAttacks` field was defined for every class but **never used in combat**:
- Warrior: 6 attacks (displayed in UI, but combat did 1 attack)
- Berserker: 7 attacks (same issue)
- Mage: 4 attacks (same issue)

This was the missing baseline damage scaling mechanism.

### Implementation

Added Angband-style multi-attack scaling:

```typescript
function calculateAttackCount(character: Character): number {
  // Class bonus: melee classes (maxAttacks >= 6) get +1 base
  const classBonus = gameClass.maxAttacks >= 6 ? 1 : 0

  // STR bonus: +1 attack per 3 STR above 12
  const strBonus = Math.max(0, Math.floor((character.stats.str - 12) / 3))

  // Level bonus: +1 attack per 3 levels
  const levelBonus = Math.floor(character.level / 3)

  // Total: base 1 + bonuses, capped at class max
  return Math.min(1 + classBonus + strBonus + levelBonus, gameClass.maxAttacks)
}
```

**Attack Scaling Examples (Warrior, STR 13):**
| Level | Class | STR | Level Bonus | Total Attacks |
|-------|-------|-----|-------------|---------------|
| 1 | +1 | 0 | 0 | 2 |
| 3 | +1 | 0 | +1 | 3 |
| 6 | +1 | 0 | +2 | 4 |
| 9 | +1 | 0 | +3 | 5 |
| 12+ | +1 | 0 | +4 | 6 (capped) |

### Results: No Upgrades

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Avg Depth | 4.8 | **7.3** | **+52%** |
| Max Depth | 11 | 15 | +36% |
| Avg Kills | 15.2 | **27.1** | **+78%** |
| Avg Level | 1.1 | **1.8** | +64% |
| Max Level | 2 | 5 | +150% |

**Top Killers Shift:**
- Before: Orc (29%), Large Kobold (16%)
- After: Large Kobold (37%), Wormtongue (11%)

### Results: Max Upgrades

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Avg Depth | 10.0 | **13.1** | **+31%** |
| Max Depth | 17 | 18 | +6% |
| Avg Kills | 39.5 | **59.9** | **+52%** |
| Avg Level | 3.5 | **6.2** | **+77%** |
| Max Level | 8 | 12 | +50% |

**Top Killers Shift:**
- Before: Wormtongue (22%), Giant Spider (11%), Grishnakh (8%)
- After: Grishnakh (23%), Wormtongue (2%)

### Key Insight

Multi-attack addresses the damage bottleneck directly:
- Characters now kill faster → take less attrition damage
- Faster kills → more XP → higher levels → more attacks (positive feedback loop)
- Wormtongue dropped from 22% killer to 2% because characters kill it before paralysis

### Files Modified

- `src/game/character.ts` - Added `calculateAttackCount()`
- `src/game/combat.ts` - Added `meleeAttack()`, `MultiAttackResult`, `formatMultiAttackMessage()`
- `src/game/actions/combat.ts` - Updated `handleAttack()` to use multi-attack

---

## Angband-Inspired Damage Scaling (2026-01-21)

Following the multi-attack implementation, added 4 more Angband-inspired scaling mechanisms.

### 1. FAST_SHOT (Ranger)

Rangers get additional ranged attacks per 3 levels:

```typescript
function calculateRangedAttackCount(character: Character): number {
  if (character.classId === 'ranger') {
    return 1 + Math.floor(character.level / 3)
  }
  return 1
}
```

| Ranger Level | Shots |
|--------------|-------|
| 1-2 | 1 |
| 3-5 | 2 |
| 6-8 | 3 |
| 9-11 | 4 |
| 12+ | 5+ |

### 2. Scaled Criticals

Replaced flat 5% crit with weight/level-based system:

```typescript
function calculateScaledCritical(weaponWeight: number, level: number): CriticalResult {
  // Crit chance: (weight/10 + level*3)%, capped at 50%
  const critChance = Math.min(50, weaponWeight/10 + level*3)

  // On crit, roll for tier:
  // 0-50%: good (2x)
  // 50-85%: great (3x)
  // 85-100%: superb (4x)
}
```

**Examples (14 STR Warrior):**
| Weapon | Weight | Level 1 | Level 5 | Level 10 |
|--------|--------|---------|---------|----------|
| Dagger | 12 | 4.2% | 16.2% | 31.2% |
| Long Sword | 130 | 16% | 28% | 43% |
| Executioner's Sword | 260 | 29% | 41% | 50% (cap) |

### 3. BEAM Mechanic (Mages)

Bolt spells can pierce multiple enemies in a line:

```typescript
function calculateBeamChance(level: number, spellLevel: number, classId: string): number {
  // Base: (level - spell_level + 5) * 2%
  let chance = (level - spellLevel + 5) * 2

  // Mages/Archmages get +20% bonus
  if (classId === 'mage' || classId === 'archmage') chance += 20

  return Math.min(75, chance)  // Cap at 75%
}
```

**Beam Spells:** Magic Missile, Frost Bolt, Lightning Bolt, Shadow Bolt

**Mage Beam Chance:**
| Spell | Level Req | Mage L5 | Mage L10 | Mage L20 |
|-------|-----------|---------|----------|----------|
| Magic Missile | 1 | 38% | 48% | 68% |
| Frost Bolt | 5 | 30% | 40% | 60% |
| Lightning Bolt | 10 | 20% | 30% | 50% |

### 4. Deadliness Table

Non-linear damage multiplier from stats and enchantment:

**Deadliness Calculation:**
```typescript
// Melee: weapon enchant×2 + (STR-10) + level/2
// Ranged: bow enchant×2 + (DEX-10) + level/2
```

**Deadliness → Damage Multiplier:**
| Deadliness | Multiplier | Example |
|------------|------------|---------|
| 0 | 100% (1.0x) | Level 1, no gear |
| 10 | 120% (1.2x) | STR 14, +1 weapon |
| 20 | 150% (1.5x) | STR 16, +2 weapon |
| 30 | 190% (1.9x) | Level 10, STR 18, +3 weapon |
| 50 | 300% (3.0x) | Level 20, STR 22, +5 weapon |
| 100 | 750% (7.5x) | Endgame gear |
| 150 | 1250% (12.5x) | Theoretical max |

### Test Results (100 runs each)

**Comparison: Multi-Attack Only vs + All 4 Mechanics:**

| Metric | Multi-Attack Only | + All 4 | Change |
|--------|-------------------|---------|--------|
| **No Upgrades** | | | |
| Avg Depth | 7.3 | **8.0** | **+10%** |
| Avg Kills | 27.1 | **31.2** | **+15%** |
| Avg Level | 1.8 | **2.1** | +17% |
| **Max Upgrades** | | | |
| Avg Depth | 13.1 | **13.1** | 0% |
| Avg Level | 6.2 | **6.4** | +3% |
| Avg Melee Damage | 10.7 | **13.6** | **+27%** |
| Avg Kills | 59.9 | **60.8** | +2% |

**Key Observations:**
1. No-upgrades path improved significantly (+10% depth, +15% kills)
2. Max-upgrades melee damage jumped 27% (deadliness scaling)
3. Depth ceiling remains ~13-14 (bot exploration limit, not damage)
4. Characters gain more levels due to faster kills

### Files Modified

- `src/game/character.ts` - `calculateRangedAttackCount()`
- `src/game/combat.ts` - `calculateScaledCritical()`, `calculateDeadliness()`, `calculateRangedDeadliness()`, `applyDeadliness()`, `DEADLINESS_TABLE[]`, `multiRangedAttack()`
- `src/game/data/spells.ts` - Added `canBeam` flag to bolt spells
- `src/game/spell-resolution.ts` - `calculateBeamChance()`, `findMonstersInBeam()`, `castBeamSpell()`
- `src/game/actions/combat.ts` - Updated to use `multiRangedAttack()`

---

## Class & Ability Comparison: Borglike vs Angband

### Class Coverage

| Category | Angband | Borglike | Notes |
|----------|---------|----------|-------|
| Total classes | 9 | 13 | Borglike has 4 unique prestige classes |
| Overlapping | 9 | 9 | Warrior, Mage, Priest, Rogue, Ranger, Paladin, Druid, Necromancer, Blackguard |
| Unique | 0 | 4 | Monk, Bard, Berserker, Archmage |

### Spell System Gap

| Metric | Angband | Borglike | Gap |
|--------|---------|----------|-----|
| Total spells | ~110 | 22 | **5x fewer** |
| Spells per realm | 25-30 | 5-6 | **5x fewer** |
| Spell books | 5 per realm | — | No book system |
| Utility spells | Many | Few | Detection, enchant, recall missing |

### Missing Class Mechanics

| Angband Feature | Class | Effect | Priority | Status |
|-----------------|-------|--------|----------|--------|
| **Shapeshifting** | Druid/Necro | Bear/Raven/Shadow forms with stat mods | HIGH | ✅ IMPLEMENTED |
| **FAST_SHOT** | Ranger | +1 ranged attack per 3 levels | HIGH | ✅ IMPLEMENTED |
| **STEAL** | Rogue | Pickpocket gold from adjacent monsters | MEDIUM | ✅ IMPLEMENTED |
| **BEAM** | Mage | Bolt spells pierce multiple enemies | MEDIUM | ✅ IMPLEMENTED |
| **ZERO_FAIL** | Casters | No spell failure mechanic | LOW | ✅ N/A (see below) |
| **COMBAT_REGEN** | Blackguard | 10% lifesteal on melee damage | MEDIUM | ✅ IMPLEMENTED |
| **SHIELD_BASH** | Warrior/Paladin | 20% chance for +50% melee damage with shield | LOW | ✅ IMPLEMENTED |
| **BRAVERY_30** | Warrior | Fear immunity at level 30 | LOW | ✅ IMPLEMENTED |

#### ZERO_FAIL Note

Borglike has no spell failure mechanic. Spells always succeed if:
- Character knows the spell (level requirement met)
- Character has enough mana
- Spell is not on cooldown

This differs from Angband where spell failure depends on INT/WIS and spell level. We intentionally simplified this for the auto-battler format where the bot can't strategize around failure chances.

### Missing Utility Spells (High Impact)

| Spell | Angband Effect | Why It Matters |
|-------|----------------|----------------|
| Word of Recall | Return to town instantly | Escape mechanic |
| Detect Traps/Doors | Find hidden features | Exploration safety |
| Identify/Recharging | ID items, recharge wands | Item management |
| Teleport Level | Skip entire dungeon level | Escape/speedrun |
| Detection (all) | Map reveal + monster/item detect | Tactical awareness |
| Create Arrows | Ranger makes own ammo | Ranged sustain |
| Enchant Weapon/Armor | Upgrade gear | Progression |

### Damage Scaling Mechanics Status

| Mechanic | Angband | Borglike | Status |
|----------|---------|----------|--------|
| Multiple attacks | Increases with level/STR | Level/STR/class scaling | ✅ IMPLEMENTED |
| Deadliness | 0-255% lookup table | 0-150 → 100-1250% table | ✅ IMPLEMENTED |
| Critical | Weight/skill/level scaled | Weight/level, tiered 2x/3x/4x | ✅ IMPLEMENTED |
| Ranged scaling | FAST_SHOT + ammo brands | FAST_SHOT for Ranger | ✅ IMPLEMENTED |
| Spell beams | Pierce multiple enemies | Level-based beam chance | ✅ IMPLEMENTED |

### Recommendations for Balance

**High Priority (Damage Scaling):** ✅ ALL IMPLEMENTED
1. ~~Add FAST_SHOT for Ranger~~ ✅
2. ~~Add BEAM for Mage~~ ✅
3. Add shapeshifting for Druid (Bear form = melee boost)

**Medium Priority (Class Identity):**
1. Add STEAL for Rogue
2. Add COMBAT_REGEN for Blackguard
3. Add more spells per class (especially utility)

**Low Priority (Polish):**
1. SHIELD_BASH for Warrior/Paladin
2. BRAVERY for Warrior (fear immunity)
3. ZERO_FAIL for casters

---

## Implementation Notes

Balance flags are applied via `BalanceOverrides` passed to game creation:

```typescript
interface BalanceOverrides {
  monsterHpPercent: number      // 100 = normal
  monsterDamagePercent: number  // 100 = normal
  startingPotions: number       // default 3
  potionRatePercent: number     // 100 = normal
  regenPer10Turns: number       // 0 = disabled
  armorPenetration: number      // 0 = none
  enchantRatePercent: number    // 100 = normal
  itemRatePercent: number       // 100 = normal
  levelupHpPercent: number      // 100 = normal
  xpRatePercent: number         // 100 = normal
  upgradePowerPercent: number   // 100 = normal
}
```

These overrides are stored on `GameState` and checked by relevant systems.
