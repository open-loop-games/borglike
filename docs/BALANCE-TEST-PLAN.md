# Balance Test Plan

## Current State (2026-02-05)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `8ed0786` (100 runs, 50k turns, seed=1000, max-upgrades) — Vitality Rework (baseHpFraction=0.70)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 48.8 | 50 | 0% | 22560 | 632 | 6 | ✅ Endgame |
| **Blackguard** | 48.7 | 50 | 0% | 15555 | 547 | 3 | ✅ Endgame |
| **Paladin** | 48.5 | 50 | 0% | 21646 | 664 | 5 | ✅ Endgame |
| **Mage** | 48.3 | 50 | 2% | 27670 | 644 | 2 | ✅ Endgame |
| **Warrior** | 47.6 | 50 | 0% | 15577 | 512 | 4 | ✅ Endgame |
| **Necromancer** | 47.3 | 50 | 0% | 23436 | 648 | 0 | ✅ Endgame |
| **Berserker** | 47.1 | 50 | 0% | 14065 | 491 | 5 | ✅ Endgame |
| **Archmage** | 47.0 | 50 | 1% | 27382 | 609 | 5 | ✅ Endgame |
| **Rogue** | 46.4 | 50 | 0% | 21595 | 590 | 1 | ✅ Endgame |
| **Priest** | 45.5 | 50 | 0% | 24077 | 696 | 0 | ✅ Endgame |
| **Druid** | 43.0 | 50 | 0% | 21365 | 537 | 0 | ✅ Endgame |

**Summary:** Vitality rework — base HP × 0.70, Vitality gives flat 15+10/level + 3%/level. **31 Morgoth kills** (6 ranger, 5 paladin, 5 berserker, 5 archmage, 4 warrior, 3 blackguard, 2 mage, 1 rogue). All CB rates ≤2%. Archmage 0→5 Morgoth kills confirms caster HP buff working. Druid -1.6 only notable regression (may need investigation).

**vs Previous Full (`e3a4f33`):**

| Class | Old | New | Delta | Notes |
|-------|-----|-----|-------|-------|
| Ranger | 49.3 | 48.8 | -0.5 | Within noise |
| Blackguard | 48.6 | 48.7 | +0.1 | Unchanged |
| Paladin | 48.6 | 48.5 | -0.1 | Unchanged |
| Mage | 48.1 | 48.3 | +0.2 | Slight buff |
| Warrior | 47.8 | 47.6 | -0.2 | Unchanged |
| Necromancer | 47.1 | 47.3 | +0.2 | Slight buff |
| Berserker | 47.6 | 47.1 | -0.5 | Within noise |
| Archmage | 47.1 | 47.0 | -0.1 | Unchanged (but +5 Morgoth!) |
| Rogue | 46.8 | 46.4 | -0.4 | Within noise |
| Priest | 44.9 | 45.5 | +0.6 | Healer buff |
| Druid | 44.6 | 43.0 | -1.6 | Regression |

### Raw Baseline @ `8ed0786` (100 runs, 50k turns, seed=1000, upgrades=none, capabilities=none, boosters=none) — Vitality Rework

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 9.4 | 35 | 0% | 2290 | 45 | 0 | ⚠️ Early |
| **Warrior** | 9.0 | 45 | 0% | 2229 | 44 | 0 | ⚠️ Early |
| **Berserker** | 8.2 | 43 | 0% | 2006 | 36 | 0 | ⚠️ Early |
| **Blackguard** | 7.7 | 17 | 0% | 1843 | 31 | 0 | ⚠️ Early |
| **Paladin** | 6.1 | 13 | 0% | 1444 | 22 | 0 | ⚠️ Early |
| **Necromancer** | 5.6 | 20 | 0% | 1273 | 23 | 0 | ⚠️ Early |
| **Mage** | 5.2 | 13 | 0% | 1201 | 20 | 0 | ⚠️ Early |
| **Druid** | 4.9 | 13 | 0% | 1132 | 16 | 0 | ⚠️ Early |
| **Priest** | 4.8 | 12 | 0% | 1097 | 16 | 0 | ⚠️ Early |
| **Archmage** | 4.5 | 10 | 0% | 1019 | 16 | 0 | ⚠️ Early |
| **Rogue** | 3.6 | 27 | 0% | 788 | 11 | 0 | ⚠️ Early |

**Summary:** Raw baseline after Vitality rework (baseHpFraction=0.70). **0 Morgoth kills**. Significant depth reduction across all classes: avg -2.9 depth vs pre-rework. Max depth outliers crushed: warrior 49→45, berserker 50→43, blackguard 47→17. All CB rates 0%. Spread: 3.6-9.4 (5.8 depth, was 9.2).

**vs Previous Raw (`6b5f82e`):**

| Class | Old | New | Delta | Old Max | New Max | Notes |
|-------|-----|-----|-------|---------|---------|-------|
| Berserker | 14.6 | 8.2 | **-6.4** | 50 | 43 | Biggest hit (was worst outlier) |
| Warrior | 12.8 | 9.0 | **-3.8** | 49 | 45 | Target outlier fixed |
| Ranger | 12.2 | 9.4 | **-2.8** | 34 | 35 | Slight max increase (noise) |
| Blackguard | 11.0 | 7.7 | **-3.3** | 47 | 17 | Max depth -30 |
| Paladin | 7.9 | 6.1 | -1.8 | 13 | 13 | Proportional |
| Priest | 7.8 | 4.8 | -3.0 | 15 | 12 | Proportional |
| Necromancer | 7.4 | 5.6 | -1.8 | 19 | 20 | Proportional |
| Mage | 7.3 | 5.2 | -2.1 | 25 | 13 | Max depth -12 |
| Druid | 6.5 | 4.9 | -1.6 | 22 | 13 | Proportional |
| Archmage | 6.3 | 4.5 | -1.8 | 12 | 10 | Proportional |
| Rogue | 5.4 | 3.6 | -1.8 | 26 | 27 | Proportional |

**Full vs Raw Comparison:**

| Class | Full | Raw | Delta | Notes |
|-------|------|-----|-------|-------|
| Archmage | 47.0 | 4.5 | +42.5 | Most capability-dependent |
| Rogue | 46.4 | 3.6 | +42.8 | Shadow Step useless without AI |
| Paladin | 48.5 | 6.1 | +42.4 | Healing/retreat/stats all critical |
| Mage | 48.3 | 5.2 | +43.1 | Needs kiting to function |
| Necromancer | 47.3 | 5.6 | +41.7 | Sustained damage needs kiting |
| Druid | 43.0 | 4.9 | +38.1 | Shapeshift AI critical |
| Priest | 45.5 | 4.8 | +40.7 | Healing AI critical for survival |
| Blackguard | 48.7 | 7.7 | +41.0 | Needs all AI systems |
| Ranger | 48.8 | 9.4 | +39.4 | Bow + kiting need capabilities |
| Warrior | 47.6 | 9.0 | +38.6 | Raw nerfed, full preserved |
| Berserker | 47.1 | 8.2 | +38.9 | Raw nerfed, full preserved |

**Observations:**
- Capabilities/upgrades provide +38 to +43 depth — even stronger progression feel than before
- Vitality rework increased progression delta by +3-5 depth (raw weaker, full unchanged)
- Raw melee outliers eliminated (no more depth 49 warriors or depth 50 berserkers)
- Casters benefit slightly at full (archmage +5 Morgoth kills from flat+percent HP)

## Race Baseline (Phase 1)

> **Run:** `pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades`
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Race Baseline @ `b4c83bc` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

| Race | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-------|-------|---------|--------|
| **Half-Troll** | 49.2 | 50 | 0% | 15627 | 558 | 7 | ✅ Endgame |
| **Kobold** | 49.1 | 50 | 0% | 15470 | 568 | 4 | ✅ Endgame |
| **Dwarf** | 48.4 | 50 | 0% | 16013 | 552 | 11 | ✅ Endgame |
| **High-Elf** | 48.4 | 50 | 0% | 15564 | 553 | 3 | ✅ Endgame |
| **Half-Orc** | 48.3 | 50 | 0% | 16647 | 543 | 7 | ✅ Endgame |
| **Gnome** | 48.1 | 50 | 0% | 15073 | 547 | 5 | ✅ Endgame |
| **Human** | 48.1 | 50 | 0% | 16176 | 522 | 3 | ✅ Endgame |
| **Dunadan** | 47.9 | 50 | 0% | 15769 | 529 | 4 | ✅ Endgame |
| **Elf** | 47.9 | 50 | 0% | 15572 | 536 | 2 | ✅ Endgame |
| **Hobbit** | 47.7 | 50 | 0% | 15322 | 540 | 4 | ✅ Endgame |
| **Half-Elf** | 47.6 | 50 | 0% | 15303 | 533 | 4 | ✅ Endgame |

**Summary:** All 11 races endgame-viable (47.6-49.2 avg depth). **54 Morgoth kills** (11 dwarf, 7 half-troll, 7 half-orc, 5 gnome, 4 kobold, 4 dunadan, 4 hobbit, 4 half-elf, 3 human, 3 high-elf, 2 elf). **All CB rates 0%** - perfect stability after melee balance pass. Spread of 1.6 depth between best/worst.

**Observed Tiers:**
- **Top** (half-troll, kobold): 49.1-49.2 avg, +1 above human
- **Middle** (dwarf, high-elf, half-orc, gnome, human): 48.1-48.4 avg, baseline cluster
- **Bottom** (dunadan, elf, hobbit, half-elf): 47.6-47.9 avg, slightly below but viable

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 47.6)
- ✅ No race exceeds human by >5 avg depth (max delta: +1.1)
- ✅ No race falls below human by >8 avg depth (max delta: -0.5)
- ✅ CB rates <5% (all 0%)

---

## Capability Progression (Phase 2)

Tests bot performance at different unlock stages.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Capability Presets

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town_1, farming, tactics_1, preparedness_1, targeting_1, retreat_1 | 15-20 |
| `mid` | town_2, farming, tactics_2, preparedness_2, sweep_1, surf_1, targeting_2, retreat_2 | 25-35 |
| `late` | town_3, farming, tactics_3, preparedness_3, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

**Tactics Levels:**
- L0: No debuffs/buffs (face-rush)
- L1: Basic debuffs (slow, weaken)
- L2: + Pre-combat buffs and buff spells
- L3: + Smart debuff targeting (threat analysis)

**Town Levels:**
- L0: No town access
- L1: Basic town (heal, sell)
- L2: + Equipment shopping
- L3: + Full services (enchanting, identify)

**Preparedness Levels:**
- L0: No readiness checks (descend immediately)
- L1: Check basic consumable counts before descent
- L2: + Require appropriate potion tiers and level
- L3: + Full Morgoth preparation protocol

**Targeting Levels:**
- L0: Attack closest monster only (no scoring)
- L1: + Low HP bonus, can-win bonus (prioritize wounded)
- L2: + Awake bonus, threat penalty, distance penalty (threat-aware)
- L3: + Class-aware optimal range (class mastery)

**Retreat Levels:**
- L0: Panic at 25% HP only (no status awareness)
- L1: + Personality caution threshold
- L2: + Status effect detection (paralyzed, poison, confused)
- L3: + Outnumbered, combat advantage, local danger, class mods

### Progression Test Commands

```bash
# Test each progression stage
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=none --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=early --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=mid --turns=30000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=late --turns=40000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=full --turns=50000
```

### Capability Progression @ `6b89d2a` (50 runs, seed=1000, class=warrior, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 32.2 | 50 | 0% | baseline |
| `early` | town, farming, tactics, preparedness_1, targeting_1, retreat_1 | 38.2 | 50 | 0% | +6.0 |
| `mid` | +preparedness_2, sweep_1, surf_1, targeting_2, retreat_2 | 44.2 | 50 | 0% | +12.0 |
| `late` | +preparedness_3, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 44.2 | 50 | 0% | +12.0 |
| `full` | (all maxed) | 43.6 | 50 | 0% | +11.4 |

**Observations:**
- Strong progression none → early → mid (+6.0 per tier)
- Late/full plateau for warrior (doesn't benefit from kiting or additional sweep)
- 1 victory at full tier
- All CB rates 0%

**Success Criteria:** ✅ Passed
- ✅ Clear progression through mid tier (+6 depth per tier)
- ✅ All CB rates 0%
- ⚠️ Late/full show no gain over mid for warrior (class-specific, not a bug)

### Capability Progression @ `6b89d2a` (50 runs, seed=1000, class=mage, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 28.9 | 49 | 4% | baseline |
| `early` | town, farming, tactics, preparedness_1, targeting_1, retreat_1 | 40.5 | 50 | 0% | +11.6 |
| `mid` | +preparedness_2, sweep_1, surf_1, targeting_2, retreat_2 | 45.4 | 50 | 0% | +16.5 |
| `late` | +preparedness_3, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 47.9 | 50 | 0% | +19.0 |
| `full` | (all maxed) | 47.8 | 50 | 6% | +18.9 |

**Observations:**
- Mage shows continued improvement through late tier (kiting matters for casters)
- Early tier critical: +11.6 depth (targeting/retreat compensate for low HP)
- Full tier has 6% CB rate (known caster CB issue at 50k turns)
- Mid test required 40k turns (sweep/surf extend run time)

**Cross-Class Comparison (Warrior vs Mage):**

| Preset | Warrior | Mage | Mage vs Warrior |
|--------|---------|------|-----------------|
| `none` | 32.2 | 28.9 | -3.3 (mage struggles without capabilities) |
| `early` | 38.2 | 40.5 | +2.3 (targeting/retreat critical for casters) |
| `mid` | 44.2 | 45.4 | +1.2 |
| `late` | 44.2 | 47.9 | +3.7 (kiting helps mage, not warrior) |
| `full` | 43.6 | 47.8 | +4.2 |

**Success Criteria:** ✅ Passed
- ✅ Clear progression through late tier for mage
- ✅ Kiting provides measurable benefit (+2.5 depth late vs mid)
- ⚠️ Full tier 6% CB rate (existing known issue)

---

## Upgrade Progression (Phase 3)

Tests meta-upgrade impact on bot performance.

### Upgrade Progression @ `b4c83bc` (50 runs, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Victories |
|--------|----------|-----------|-----------|---------|-------|-----------|
| `none` | No upgrades | 42.6 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 44.9 | 50 | 0% | +2.3 | 0 |
| `mid` | vit 5, mgt 5, res 3, swf 2, prc 2, cel 2 | 44.5 | 50 | 0% | +1.9 | 1 |
| `late` | vit 8, mgt 8, res 4, swf 4, prc 4, cel 4 | 45.6 | 50 | 0% | +3.0 | 2 |
| `full` | All maxed | 45.3 | 50 | 0% | +2.7 | 1 |

**Observations:**
- Base game much stronger: 42.6 without upgrades (was 37.2)
- Progression curve flatter: +2.7 total spread (was +9.3)
- Upgrades still help but less dramatically
- Some noise in mid/full tiers (within margin of error)

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide improvement at all tiers
- ✅ Bot viable even without upgrades (42.6 depth)

### Paired Progression @ `b4c83bc` (50 runs, seed=1000)

Tests realistic player progression with matching capability and upgrade tiers.

**Warrior:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 23.1 | 174 | 0% | baseline |
| early/early | 35.1 | 327 | 0% | +12.0 |
| mid/mid | 41.9 | 466 | 0% | +6.8 |
| late/late | 45.8 | 533 | 0% | +3.9 |
| full/full | 45.3 | 479 | 0% | -0.5 |

**Mage:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 14.1 | 73 | 6% | baseline |
| early/early | 24.9 | 196 | 0% | +10.8 |
| mid/mid | 43.8 | 820 | 0% | +18.9 |
| late/late | 48.1 | 784 | 0% | +4.3 |
| full/full | 47.9 | 648 | 0% | -0.2 |

**Cross-Class Comparison:**

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 23.1 | 14.1 | -9.0 (mage struggles) |
| early/early | 35.1 | 24.9 | -10.2 (mage struggles) |
| mid/mid | 41.9 | 43.8 | +1.9 (mage catches up) |
| late/late | 45.8 | 48.1 | +2.3 (mage exceeds) |
| full/full | 45.3 | 47.9 | +2.6 (mage exceeds) |

**Cost Breakdown:**

| Component | none | early | mid | late | full |
|-----------|------|-------|-----|------|------|
| Capabilities | 0 | 1,150 | 2,580 | 5,404 | 8,038 |
| Upgrades | 0 | 412 | 3,309 | 11,997 | 25,421 |
| **Total** | 0 | 1,562 | 5,889 | 17,401 | 33,459 |

**Progression Economics (Warrior):**

| Transition | Depth Gain | Essence Cost | Runs at Current Tier |
|------------|------------|--------------|----------------------|
| none → early | +12.0 | 1,562 | ~3 runs |
| early → mid | +6.8 | 4,327 | ~3-4 runs |
| mid → late | +3.9 | 11,512 | ~5 runs |
| late → full | -0.5 | 16,058 | ~6-7 runs |

**Observations:**
- Warrior: Smooth progression, early tiers best value (+12 depth for ~2 runs)
- Mage: Struggles at none/early (14.1, 24.9 depth), needs mid tier to be viable
- Mage mid tier is critical: +18.9 depth jump (vitality 5 + sweep/surf kick in)
- Both classes: late → full provides no benefit (-0.5 warrior, -0.2 mage)
- Mage exceeds warrior at mid+ tiers once HP threshold is reached

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression through late tier for both classes
- ✅ Reasonable time-to-tier (2-6 runs per tier)
- ⚠️ Mage early game harsh (6% CB at none, -10 depth vs warrior)
- ❌ Full tier provides no benefit over late for either class

---

## Upgrade Sensitivity (Phase 4)

Measures per-upgrade impact on bot performance.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

> **Run:** `pnpm diagnose sensitivity --seed=1000 --class=CLASS`

### Pre-Rebalance: Warrior Sensitivity @ `8ed0786` (50 runs, 30k turns, seed=1000) — Vitality Rework

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🟡 Vitality (+HP) | 47.1 | 44.0 | -3.1 | -6.6% |
| 🟢 Celerity (+Speed) | 47.1 | 46.2 | -1.0 | -2.0% |
| 🟢 Swiftness (+Dodge) | 47.1 | 47.5 | +0.4 | +0.8% |
| 🟢 Resilience (+Armor) | 47.1 | 47.8 | +0.7 | +1.4% |
| 🟢 Precision (+Acc) | 47.1 | 47.9 | +0.7 | +1.5% |
| 🟢 Might (+Dmg%) | 47.1 | 48.0 | +0.8 | +1.7% |

### Pre-Rebalance: Mage Sensitivity @ `8ed0786` (50 runs, 30k turns, seed=1000) — Vitality Rework

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🔴 Vitality (+HP) | 47.8 | 29.3 | -18.5 | -38.7% |
| 🟢 Resilience (+Armor) | 47.8 | 47.1 | -0.7 | -1.5% |
| 🟢 Celerity (+Speed) | 47.8 | 47.5 | -0.3 | -0.6% |
| 🟢 Might (+Dmg%) | 47.8 | 47.6 | -0.2 | -0.4% |
| 🟢 Swiftness (+Dodge) | 47.8 | 47.9 | +0.1 | +0.2% |
| 🟢 Precision (+Acc) | 47.8 | 48.2 | +0.4 | +0.8% |

### Post-Rebalance: 6-Class Sensitivity @ `b4a447f` (50 runs, 30k turns, seed=1000) — Survivability Redistribution

Changes: Vitality 3%→1%/level, Resilience maxLevel 5→10 +1% armor/level, Swiftness maxLevel 5→10 +1% dodge/level (hit formula multiplier).

| Upgrade | Warrior | Mage | Rogue | Ranger | Paladin | Druid |
|---------|---------|------|-------|--------|---------|-------|
| **Vitality** | -0.5% | **-39.0%** | **-6.9%** | -1.3% | -3.0% | -5.6% |
| **Swiftness** | -3.6% | -1.3% | -4.1% | -0.8% | -1.2% | -5.0% |
| **Resilience** | -0.3% | -0.3% | -2.5% | -1.6% | -0.0% | -4.8% |
| **Celerity** | +0.8% | -2.7% | +0.6% | -2.9% | -5.4% | -7.9% |
| **Might** | +1.5% | +0.0% | -1.0% | -1.6% | +0.1% | -1.0% |
| **Precision** | +0.8% | +0.4% | +0.0% | -0.4% | +0.5% | -1.9% |

**Per-class baselines:** Warrior 47.1, Mage 47.7, Rogue 46.7, Ranger 49.9, Paladin 48.3, Druid 45.1

**Analysis:**

The survivability redistribution works well for mid-tier classes. Key findings:

- **Druid** shows ideal balance: all 6 upgrades matter, spread from -7.9% (Celerity) to -1.0% (Might). Best-balanced class.
- **Rogue** shows the survivability trio working: Vitality -6.9%, Swiftness -4.1%, Resilience -2.5% — meaningful gradient.
- **Ranger/Paladin** show Celerity as surprisingly important (-2.9%, -5.4%) — speed enables better kiting/retreat.
- **Warrior** is the ceiling: too tanky for any single upgrade to register strongly. Expected for a high-armor, high-HP melee class.
- **Mage** is the floor: Vitality -39% because flat +105 HP on ~490 base HP is a 21% increase regardless of percent component. Thematically correct — squishy casters rely on HP upgrades for bot viability.
- **Resilience** works for low/mid-armor classes (rogue -2.5%, ranger -1.6%, druid -4.8%) via % armor closing the gap to DR cap. Dead for warrior (already near 50% DR cap) and mage (DR irrelevant when HP is the bottleneck).
- **Swiftness** dodge multiplier works broadly (warrior -3.6%, rogue -4.1%, druid -5.0%) — clean multiplicative effect on monster hit formula.

**Conclusion:** The rebalance successfully creates upgrade diversity for 4/6 classes. Warrior and mage are expected outliers due to fundamental class characteristics (ceiling/floor effects), not upgrade tuning problems. Mage/archmage/necro being squishy and Vitality-dependent is thematically appropriate.

**Interpretation:**
- 🔴 High impact (>10% loss): Critical upgrade, prioritize early
- 🟡 Medium impact (5-10%): Important but not blocking
- 🟢 Low impact (<5%): Nice-to-have, can defer

---

## Cross-Class Race Testing (Phase 5)

Tests race/class synergies across archetypes.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Cross-Class Race @ `b4c83bc` (100 runs, 50k turns, seed=1000, max-upgrades)

| Race | Warrior | Mage | Ranger | Spread | Notes |
|------|---------|------|--------|--------|-------|
| **Half-Troll** | **49.2** | 45.5 | 49.5 | 3.7 | Best melee, worst caster |
| **Kobold** | 49.1 | 48.7 | **49.8** | 1.1 | Consistent top performer |
| **Dwarf** | 48.4 | 48.3 | 49.5 | 1.2 | Steady across all |
| **Hobbit** | 47.7 | 48.5 | **49.8** | 2.1 | DEX shines on ranger |
| **Gnome** | 48.1 | 48.2 | **49.8** | 1.7 | DEX shines on ranger |
| **Half-Orc** | 48.3 | 48.1 | 49.6 | 1.5 | Balanced |
| **Human** | 48.1 | 48.1 | 49.5 | 1.4 | True baseline |
| **Dunadan** | 47.9 | **48.8** | 48.9 | 1.0 | INT bonus helps caster |
| **High-Elf** | 48.4 | 47.3 | 49.7 | 2.4 | Best on ranger, weak mage |
| **Elf** | 47.9 | 46.7 | 49.6 | 2.9 | DEX class specialist |
| **Half-Elf** | 47.6 | 46.9 | 49.3 | 2.4 | DEX class specialist |

**Summary:** Race/class synergies working as intended. Half-troll shows largest swing (3.7 depth between warrior and mage) due to INT penalty. DEX races (hobbit, gnome, kobold) excel on ranger. Ranger has tightest spread (0.9 depth) acting as equalizer. All 33 race/class combos viable (45.5+ avg depth).

**Class Spread:**
- Warrior: 1.6 depth spread (49.2 to 47.6)
- Mage: 3.3 depth spread (48.8 to 45.5) - race matters most
- Ranger: 0.9 depth spread (49.8 to 48.9) - most forgiving

**Success Criteria:** ✅ All passed
- ✅ No race/class combo >10% better than human/same-class (max: +2.9% ranger/hobbit)
- ✅ No race/class combo >15% worse than human/same-class (max: -5.4% mage/half-troll)
- ✅ Synergies feel intentional (STR→melee, INT→caster, DEX→ranger)

---

## Personality Comparison (Phase 6 - Low Priority)

Tests personality impact across class archetypes.

```bash
pnpm diagnose compare --runs=50 --seed=1000 --class=CLASS --turns=50000
```

### Personality @ `<commit>` (50 runs, 50k turns, seed=1000)

| Personality | Warrior | Mage | Ranger | Notes |
|-------------|---------|------|--------|-------|
| cautious | (baseline) | (baseline) | (baseline) | Reference |
| aggressive | | | | Higher variance expected |
| greedy | | | | More gold, lower depth |
| speedrunner | | | | Faster, lower depth |

**Success Criteria:**
- All personalities viable (reach depth 35+)
- No personality strictly dominates cautious

---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 50,000 | Catches caster CB issues that emerge at higher turn counts |
| `--runs` | 100 | Statistical significance, ~2-3 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--upgrades` | full | Consistent meta-progression state (or use `--max-upgrades`) |
| `--boosters` | class | Class-optimized booster loadout |

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

# Race baseline across all 11 races (~16 min)
pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades > /tmp/[name].txt 2>&1

# Upgrade sensitivity test (~10 min)
pnpm diagnose sensitivity --seed=1000 --class=warrior > /tmp/[name].txt 2>&1

# Test with capability preset
pnpm diagnose batch --runs=50 --seed=1000 --capabilities=mid --class=warrior
```

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--max-upgrades` | off | Apply all upgrades at max (includes 25% bestiary) |
| `--turns=N` | 20000 | Max turns per run |
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

### Upgrade & Booster Presets

| Flag | Default | Options | Description |
|------|---------|---------|-------------|
| `--upgrades=X` | full | none, early, mid, late, full | Meta-progression upgrade level |
| `--boosters=X` | class | none, class, IDs | Per-run booster loadout |

**Upgrade Presets:**
| Preset | Upgrades |
|--------|----------|
| `none` | No upgrades |
| `early` | vitality 2, might 2, resilience 1 |
| `mid` | vitality 5, might 5, resilience 5, swiftness 4, precision 2, celerity 2 |
| `late` | vitality 8, might 8, resilience 7, swiftness 6, precision 4, celerity 4 |
| `full` | All upgrades at max level |

**Booster Presets:**
| Preset | Description |
|--------|-------------|
| `none` | No boosters |
| `class` | Primary stat (superior) + CON (superior) based on class |
| `str_superior,con_superior` | Custom comma-separated booster IDs |

**Class Booster Defaults (--boosters=class):**
- STR classes (warrior, berserker, blackguard): `str_superior + con_superior`
- INT classes (mage, archmage, necromancer, bard): `int_superior + con_superior`
- WIS classes (priest, paladin, druid): `wis_superior + con_superior`
- DEX classes (rogue, ranger, monk): `dex_superior + con_superior`

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
- `docs/BALANCE-PASS-4.md` - Goal oscillation, caution threshold, vault fixes, TP scroll fixes
- `docs/BALANCE-PASS-5.md` - Historical baselines and archived test data
- `docs/XP-CURVE-ANALYSIS.md` - XP curve analysis and two-part curve implementation
