# Balance Test Plan

## Current State (2026-02-05)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `e3a4f33` (100 runs, 50k turns, seed=1000, max-upgrades) — Two-Part XP Curve

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.3 | 50 | 0% | 22335 | 636 | 2 | ✅ Endgame |
| **Paladin** | 48.6 | 50 | 0% | 21720 | 671 | 4 | ✅ Endgame |
| **Blackguard** | 48.6 | 50 | 0% | 15111 | 543 | 2 | ✅ Endgame |
| **Mage** | 48.1 | 50 | 1% | 28314 | 635 | 3 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 0% | 15727 | 519 | 5 | ✅ Endgame |
| **Berserker** | 47.6 | 50 | 0% | 14593 | 496 | 11 | ✅ Endgame |
| **Necromancer** | 47.1 | 50 | 1% | 23536 | 639 | 0 | ✅ Endgame |
| **Archmage** | 47.1 | 50 | 1% | 26988 | 606 | 0 | ✅ Endgame |
| **Rogue** | 46.8 | 50 | 0% | 22231 | 597 | 1 | ✅ Endgame |
| **Priest** | 44.9 | 50 | 0% | 23726 | 695 | 0 | ✅ Endgame |
| **Druid** | 44.6 | 50 | 0% | 22113 | 561 | 0 | ✅ Endgame |

**Summary:** Two-part XP curve (L1-20: exponent 1.5, L21-50: exponent 4). Modest tightening ~0.5 avg depth. **28 Morgoth kills** (11 berserker, 5 warrior, 4 paladin, 3 mage, 2 ranger, 2 blackguard, 1 rogue). All CB rates ≤1%. Biggest impact on over-leveling classes (druid -1.3, priest -1.1, archmage -1.1). See `docs/XP-CURVE-ANALYSIS.md` for full analysis.

### Raw Baseline @ `c5643d9` (100 runs, 50k turns, seed=1000, upgrades=none, capabilities=none, boosters=none)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Berserker** | 14.2 | 50 | 2% | 3650 | 86 | 0 | ⚠️ Mid |
| **Warrior** | 13.1 | 50 | 0% | 3347 | 73 | 0 | ⚠️ Mid |
| **Ranger** | 12.6 | 50 | 0% | 3087 | 70 | 0 | ⚠️ Mid |
| **Blackguard** | 11.2 | 46 | 0% | 2789 | 57 | 0 | ⚠️ Mid |
| **Paladin** | 7.9 | 13 | 0% | 1894 | 30 | 0 | ⚠️ Early |
| **Priest** | 7.8 | 15 | 0% | 1882 | 31 | 0 | ⚠️ Early |
| **Necromancer** | 7.4 | 20 | 0% | 1725 | 33 | 0 | ⚠️ Early |
| **Mage** | 7.3 | 22 | 0% | 1732 | 32 | 0 | ⚠️ Early |
| **Druid** | 6.5 | 21 | 0% | 1549 | 24 | 0 | ⚠️ Early |
| **Archmage** | 6.3 | 12 | 0% | 1453 | 26 | 0 | ⚠️ Early |
| **Rogue** | 5.5 | 25 | 0% | 1306 | 20 | 0 | ⚠️ Early |

**Summary:** First valid raw baseline. Previous `d56d88f` raw was invalid — `diagnose baseline` had a bug where `--capabilities` wasn't passed through to `runBaseline()`, so capabilities were always `full`. **0 Morgoth kills**. Melee classes (berserker/warrior) lead via face-rush. Casters collapse without capabilities. Spread: 5.5-14.2 (8.7 depth). All CB rates ≤2%.

**Full vs Raw Comparison:**

| Class | Full | Raw | Delta | Notes |
|-------|------|-----|-------|-------|
| Archmage | 48.2 | 6.3 | +41.9 | Most capability-dependent |
| Rogue | 47.1 | 5.5 | +41.6 | Shadow Step useless without AI |
| Paladin | 48.9 | 7.9 | +41.0 | Healing/retreat/stats all critical |
| Mage | 48.1 | 7.3 | +40.8 | Needs kiting to function |
| Necromancer | 47.8 | 7.4 | +40.4 | Sustained damage needs kiting |
| Druid | 45.9 | 6.5 | +39.4 | Shapeshift AI critical |
| Priest | 46.0 | 7.8 | +38.2 | Healing AI critical for survival |
| Blackguard | 49.0 | 11.2 | +37.8 | Needs all AI systems |
| Ranger | 49.4 | 12.6 | +36.8 | Bow + kiting need capabilities |
| Warrior | 48.0 | 13.1 | +34.9 | Solid raw melee, big upgrade benefit |
| Berserker | 48.5 | 14.2 | +34.3 | Best raw, still needs retreat/stats |

**Observations:**
- Capabilities/upgrades provide +34 to +42 depth — excellent progression feel
- Melee classes strongest raw (face-rush works), casters weakest (need capabilities)
- Previous `d56d88f` raw baseline was invalid (diagnose bug: capabilities not passed through)

#### Ungated Bot Behaviors (Investigation @ `d56d88f`)

> **Note:** This investigation was conducted against the `d56d88f` raw baseline, which was later found to be invalid — `diagnose baseline` wasn't passing `--capabilities` through, so capabilities were always `full`. The findings below about ungated behaviors are still accurate (kiting was gated in `66fdc7f`, tactics graded in same commit), but the inflated raw numbers that motivated the investigation were primarily caused by the diagnose bug.

Ranger (48.5) and casters (41-45) perform unexpectedly well with no capabilities. Investigation found several behaviors NOT gated by capability toggles:

**1. `prefersRanged` Class Profile = Free Kiting**

Classes with `prefersRanged: true` (mage, ranger, necromancer, archmage) get kiting behavior regardless of `kiting` capability level. In `tier-actions.ts`:
```typescript
// CRITICAL tier, DANGER tier, SAFE tier all have:
if (classProfile.prefersRanged) {
  if (adjacentMonster) {
    const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
    if (kiteDir) return { type: 'move', direction: kiteDir }  // FREE KITING
  }
}
```

**2. Spell Casting = Ungated**

All spell casting (`getHealingSpellAction`, `getDamageSpellAction`, `getDebuffSpellAction`) has no capability checks. Any class with spells uses them automatically.

**3. Ranged Attacks = Ungated**

Bow attacks (`ranged_attack`) happen automatically for ranged classes without capability checks.

**Impact Analysis:**

| Behavior | Affects | Ungated? | Should Gate? |
|----------|---------|----------|--------------|
| Kiting movement | mage, ranger, necro, archmage | ✅ Yes | ⚠️ Consider |
| Spell damage | mage, archmage, necro, priest, druid | ✅ Yes | ❓ Debatable |
| Spell healing | priest, paladin, druid | ✅ Yes | ❓ Debatable |
| Bow attacks | ranger | ✅ Yes | ⚠️ Consider |
| Target selection | all | ❌ Gated by `targeting` | ✅ Good |
| Retreat logic | all | ❌ Gated by `retreat` | ✅ Good |
| KITE goal | ranged | ❌ Gated by `kiting` | ✅ Good |

**Options:**
1. ~~**Gate kiting in tier-actions**: Add `effective.kiting > 0` check before `findKitePosition` calls~~ ✅ Done in `66fdc7f`

**Resolution:** Kiting gated behind `kiting >= 1` and tactics converted to graded (0-3) in `66fdc7f`. Remaining ungated: spell damage, spell healing, bow attacks.

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

### Warrior Sensitivity @ `b4c83bc` (50 runs, 30k turns, seed=1000)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🟢 Vitality (+HP) | 48.5 | 47.3 | -1.3 | -2.6% |
| 🟢 Celerity (+Speed) | 48.5 | 47.4 | -1.1 | -2.3% |
| 🟢 Swiftness (+Dodge) | 48.5 | 47.8 | -0.7 | -1.5% |
| 🟢 Resilience (+Armor) | 48.5 | 48.1 | -0.4 | -0.8% |
| 🟢 Might (+Dmg%) | 48.5 | 48.6 | +0.0 | +0.0% |
| 🟢 Precision (+Acc) | 48.5 | 48.6 | +0.1 | +0.2% |

### Mage Sensitivity @ `b4c83bc` (50 runs, 30k turns, seed=1000)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🔴 Vitality (+HP) | 49.0 | 38.4 | -10.6 | -21.6% |
| 🟢 Might (+Dmg%) | 49.0 | 48.0 | -1.1 | -2.2% |
| 🟢 Resilience (+Armor) | 49.0 | 48.0 | -1.0 | -2.1% |
| 🟢 Celerity (+Speed) | 49.0 | 48.1 | -1.0 | -2.0% |
| 🟢 Swiftness (+Dodge) | 49.0 | 48.6 | -0.4 | -0.9% |
| 🟢 Precision (+Acc) | 49.0 | 48.8 | -0.3 | -0.6% |

### Cross-Class Comparison

| Upgrade | Warrior | Mage | Notes |
|---------|---------|------|-------|
| **Vitality** | -2.6% | -21.6% | Critical for casters (low base HP) |
| Celerity | -2.3% | -2.0% | Consistent across classes |
| Might | +0.0% | -2.2% | Only helps casters |
| Resilience | -0.8% | -2.1% | Slightly more for casters |
| Swiftness | -1.5% | -0.9% | Consistent |
| Precision | +0.2% | -0.6% | Minimal impact |

**Summary:** Vitality is the most impactful upgrade, especially for casters (8x more critical for mage than warrior). Offensive upgrades (Might, Precision) provide minimal benefit for warrior but help mage. Game is balanced for max upgrades, so high single-upgrade impact is expected for progression feel.

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
| `mid` | vitality 5, might 5, resilience 3, swiftness 2, precision 2, celerity 2 |
| `late` | vitality 8, might 8, resilience 4, swiftness 4, precision 4, celerity 4 |
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
