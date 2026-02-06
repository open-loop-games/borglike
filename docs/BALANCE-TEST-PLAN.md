# Balance Test Plan

## Current State (2026-02-05)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `25c9691` (100 runs, 50k turns, seed=1000, max-upgrades) — Ranger Nerf + Bow Fix

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Mage** | 48.4 | 50 | 2% | 28091 | 638 | 2 | ✅ Endgame |
| **Berserker** | 48.2 | 50 | 0% | 14220 | 503 | 5 | ✅ Endgame |
| **Paladin** | 48.1 | 50 | 0% | 21305 | 648 | 4 | ✅ Endgame |
| **Blackguard** | 48.0 | 50 | 0% | 15211 | 542 | 4 | ✅ Endgame |
| **Ranger** | 47.9 | 50 | 0% | 21635 | 633 | 5 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 0% | 15596 | 518 | 6 | ✅ Endgame |
| **Archmage** | 46.7 | 50 | 3% | 27220 | 602 | 3 | ✅ Endgame |
| **Rogue** | 46.7 | 50 | 0% | 22491 | 595 | 2 | ✅ Endgame |
| **Necromancer** | 46.2 | 50 | 0% | 23124 | 622 | 0 | ✅ Endgame |
| **Priest** | 45.1 | 50 | 0% | 24274 | 683 | 0 | ✅ Endgame |
| **Druid** | 43.9 | 50 | 0% | 22396 | 548 | 0 | ✅ Endgame |

**Summary:** Ranger nerf + bow evaluation fix. Ranger changes: fix bot bow eval (getEquipSlot + multiplier/hitBonus scoring), cap FAST_SHOT at 6, remove thorn strike/summon bear/summon pack from spells, Root Shot 100% stun→50% slow. Non-ranger guard: prevent non-rangers from equipping bows (casters were picking up bows and shooting instead of casting). **31 Morgoth kills** (6 warrior, 5 berserker, 5 ranger, 4 paladin, 4 blackguard, 3 archmage, 2 mage, 2 rogue). All CB rates ≤3%. Ranger drops from #1 to #5 (-1.6 depth).

**vs Previous Full (`b4a447f`):**

| Class | Old | New | Delta | Notes |
|-------|-----|-----|-------|-------|
| Mage | 47.8 | 48.4 | +0.6 | Noise |
| Berserker | 48.0 | 48.2 | +0.2 | Noise |
| Paladin | 48.2 | 48.1 | -0.1 | Noise |
| Blackguard | 48.4 | 48.0 | -0.4 | Noise |
| Ranger | 49.5 | 47.9 | **-1.6** | Intended nerf (Root Shot 50% slow) |
| Warrior | 47.0 | 47.8 | +0.8 | Noise |
| Archmage | 46.7 | 46.7 | 0.0 | Unchanged |
| Rogue | 46.8 | 46.7 | -0.1 | Noise |
| Necromancer | 46.4 | 46.2 | -0.2 | Noise |
| Priest | 45.4 | 45.1 | -0.3 | Noise |
| Druid | 45.2 | 43.9 | -1.3 | Slight dip |

### Full Baseline @ `b4a447f` (100 runs, 50k turns, seed=1000, max-upgrades) — Survivability Rebalance

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.5 | 50 | 0% | 21944 | 639 | 6 | ✅ Endgame |
| **Blackguard** | 48.4 | 50 | 0% | 14995 | 543 | 2 | ✅ Endgame |
| **Paladin** | 48.2 | 50 | 0% | 21320 | 660 | 3 | ✅ Endgame |
| **Berserker** | 48.0 | 50 | 0% | 14157 | 505 | 12 | ✅ Endgame |
| **Mage** | 47.8 | 50 | 2% | 28869 | 634 | 1 | ✅ Endgame |
| **Warrior** | 47.0 | 50 | 0% | 15606 | 504 | 7 | ✅ Endgame |
| **Rogue** | 46.8 | 50 | 0% | 21968 | 596 | 1 | ✅ Endgame |
| **Archmage** | 46.7 | 50 | 4% | 27588 | 606 | 0 | ✅ Endgame |
| **Necromancer** | 46.4 | 50 | 0% | 23077 | 622 | 1 | ✅ Endgame |
| **Priest** | 45.4 | 50 | 0% | 24542 | 696 | 0 | ✅ Endgame |
| **Druid** | 45.2 | 50 | 0% | 22575 | 567 | 1 | ✅ Endgame |

**Summary:** Survivability rebalance — Vitality 3%→1%/level, Resilience/Swiftness maxLevel 5→10 with +1% armor/dodge per level. **34 Morgoth kills** (12 berserker, 7 warrior, 6 ranger, 3 paladin, 2 blackguard, 1 mage, 1 rogue, 1 necro, 1 druid). All CB rates ≤4%. Druid +2.2 depth recovery (was previous regression). Berserker surges to 12 Morgoth kills.

**vs Previous Full (`8ed0786`):**

| Class | Old | New | Delta | Notes |
|-------|-----|-----|-------|-------|
| Ranger | 48.8 | 49.5 | +0.7 | Slight buff |
| Blackguard | 48.7 | 48.4 | -0.3 | Noise |
| Paladin | 48.5 | 48.2 | -0.3 | Noise |
| Berserker | 47.1 | 48.0 | +0.9 | Dodge helps melee |
| Mage | 48.3 | 47.8 | -0.5 | Noise (Vitality nerf) |
| Warrior | 47.6 | 47.0 | -0.6 | Slight dip (Vitality nerf) |
| Rogue | 46.4 | 46.8 | +0.4 | Slight buff |
| Archmage | 47.0 | 46.7 | -0.3 | Noise |
| Necromancer | 47.3 | 46.4 | -0.9 | Slight dip |
| Priest | 45.5 | 45.4 | -0.1 | Unchanged |
| Druid | 43.0 | 45.2 | **+2.2** | Biggest winner (all upgrades matter) |

### Raw Baseline @ `b4a447f` (100 runs, 50k turns, seed=1000, upgrades=none, capabilities=none, boosters=none) — Survivability Rebalance

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

**Summary:** Raw baseline unchanged from `8ed0786` — identical numbers. Expected: no upgrades = no effect from upgrade rebalance. **0 Morgoth kills**. All CB rates 0%. Spread: 3.6-9.4.

**Full vs Raw Comparison:**

| Class | Full | Raw | Delta | Notes |
|-------|------|-----|-------|-------|
| Mage | 47.8 | 5.2 | +42.6 | Needs kiting to function |
| Rogue | 46.8 | 3.6 | +43.2 | Shadow Step useless without AI |
| Archmage | 46.7 | 4.5 | +42.2 | Most capability-dependent |
| Paladin | 48.2 | 6.1 | +42.1 | Healing/retreat/stats all critical |
| Necromancer | 46.4 | 5.6 | +40.8 | Sustained damage needs kiting |
| Priest | 45.4 | 4.8 | +40.6 | Healing AI critical for survival |
| Blackguard | 48.4 | 7.7 | +40.7 | Needs all AI systems |
| Ranger | 49.5 | 9.4 | +40.1 | Bow + kiting need capabilities |
| Druid | 45.2 | 4.9 | +40.3 | Shapeshift AI critical (+2.2 from rebalance) |
| Berserker | 48.0 | 8.2 | +39.8 | Dodge helps melee |
| Warrior | 47.0 | 9.0 | +38.0 | Slight Vitality nerf absorbed |

**Observations:**
- Capabilities/upgrades provide +38 to +43 depth — strong progression feel
- Raw baseline unchanged (upgrade-only changes don't affect raw)
- Druid progression delta increased by +2.2 (survivability upgrades now all contribute)
- Berserker progression delta increased by +0.9 (dodge multiplier helps melee)

## Race Baseline (Phase 1)

> **Run:** `pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades`
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Race Baseline @ `0789dc4` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

| Race | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-------|-------|---------|--------|
| **Kobold** | 48.9 | 50 | 0% | 15495 | 559 | 8 | ✅ Endgame |
| **Dunadan** | 48.7 | 50 | 0% | 16142 | 537 | 10 | ✅ Endgame |
| **Half-Orc** | 48.3 | 50 | 0% | 15379 | 545 | 8 | ✅ Endgame |
| **Half-Troll** | 48.1 | 50 | 0% | 15911 | 535 | 4 | ✅ Endgame |
| **Dwarf** | 47.9 | 50 | 0% | 15253 | 544 | 7 | ✅ Endgame |
| **Gnome** | 47.9 | 50 | 0% | 15021 | 539 | 6 | ✅ Endgame |
| **Half-Elf** | 47.7 | 50 | 0% | 15217 | 528 | 2 | ✅ Endgame |
| **Hobbit** | 47.4 | 50 | 0% | 15196 | 531 | 5 | ✅ Endgame |
| **High-Elf** | 47.3 | 50 | 0% | 14969 | 530 | 2 | ✅ Endgame |
| **Human** | 47.0 | 50 | 0% | 15606 | 504 | 7 | ✅ Endgame |
| **Elf** | 47.0 | 50 | 0% | 15478 | 520 | 6 | ✅ Endgame |

**Summary:** All 11 races endgame-viable (47.0-48.9 avg depth). **65 Morgoth kills** (10 dunadan, 8 kobold, 8 half-orc, 7 dwarf, 7 human, 6 gnome, 6 elf, 5 hobbit, 4 half-troll, 2 half-elf, 2 high-elf). **All CB rates 0%**. Spread of 1.9 depth between best/worst.

**vs Previous (`b4c83bc`):**

| Race | Old | New | Delta | Notes |
|------|-----|-----|-------|-------|
| Kobold | 49.1 | 48.9 | -0.2 | Noise |
| Dunadan | 47.9 | 48.7 | +0.8 | Surges to #2, 10 Morgoth kills |
| Half-Orc | 48.3 | 48.3 | 0.0 | Unchanged |
| Half-Troll | 49.2 | 48.1 | -1.1 | Drops from #1 |
| Dwarf | 48.4 | 47.9 | -0.5 | Noise |
| Gnome | 48.1 | 47.9 | -0.2 | Noise |
| Half-Elf | 47.6 | 47.7 | +0.1 | Unchanged |
| Hobbit | 47.7 | 47.4 | -0.3 | Noise |
| High-Elf | 48.4 | 47.3 | -1.1 | Noise |
| Human | 48.1 | 47.0 | -1.1 | Noise |
| Elf | 47.9 | 47.0 | -0.9 | Noise |

All deltas within noise range (no game code changed between commits). Ranking shuffled but all races remain endgame-viable.

**Observed Tiers:**
- **Top** (kobold, dunadan): 48.7-48.9 avg, +1.7-1.9 above human
- **Middle** (half-orc, half-troll, dwarf, gnome, half-elf): 47.7-48.3 avg, baseline cluster
- **Bottom** (hobbit, high-elf, human, elf): 47.0-47.4 avg, slightly below but viable

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 47.0)
- ✅ No race exceeds human by >5 avg depth (max delta: +1.9)
- ✅ No race falls below human by >8 avg depth (min delta: 0.0)
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
# Test each progression stage (upgrades=mid for progression feel)
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=none --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=early --turns=25000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=mid --turns=35000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=late --turns=45000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=full --turns=50000
```

### Capability Progression @ `0789dc4` (50 runs, seed=1000, class=warrior, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 32.9 | 50 | 0% | baseline |
| `early` | town, farming, tactics, preparedness_1, targeting_1, retreat_1 | 32.3 | 50 | 0% | -0.6 |
| `mid` | +preparedness_2, sweep_1, surf_1, targeting_2, retreat_2 | 37.1 | 50 | 0% | +4.2 |
| `late` | +preparedness_3, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 39.8 | 50 | 0% | +6.9 |
| `full` | (all maxed) | 39.9 | 50 | 0% | +7.0 |

**Observations:**
- Progression from none→mid→late: +4.2 then +2.7 (diminishing returns for warrior)
- Early tier shows no gain (-0.6, noise) — basic capabilities don't help tanky warrior at mid upgrades
- Late/full plateau for warrior (kiting doesn't help melee)
- All CB rates 0%

### Capability Progression @ `0789dc4` (50 runs, seed=1000, class=mage, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 16.9 | 27 | 0% | baseline |
| `early` | town, farming, tactics, preparedness_1, targeting_1, retreat_1 | 17.7 | 31 | 0% | +0.8 |
| `mid` | +preparedness_2, sweep_1, surf_1, targeting_2, retreat_2 | 25.9 | 39 | 4% | +9.0 |
| `late` | +preparedness_3, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 40.8 | 50 | 0% | +23.9 |
| `full` | (all maxed) | 42.9 | 50 | 4% | +26.0 |

**Observations:**
- Mage shows dramatic progression: none→late is +23.9 depth
- Kiting (late tier) is transformative: +14.9 depth jump from mid→late
- Early tier minimal (+0.8) — basic capabilities can't compensate for squishy mage at mid upgrades
- Mid tier 4% CB rate, full tier 4% CB rate

**Cross-Class Comparison (Warrior vs Mage):**

| Preset | Warrior | Mage | Mage vs Warrior |
|--------|---------|------|-----------------|
| `none` | 32.9 | 16.9 | -16.0 (mage struggles hard without capabilities) |
| `early` | 32.3 | 17.7 | -14.6 (basic capabilities insufficient for mage) |
| `mid` | 37.1 | 25.9 | -11.2 (sweep/surf help but mage still behind) |
| `late` | 39.8 | 40.8 | +1.0 (kiting equalizes) |
| `full` | 39.9 | 42.9 | +3.0 (mage exceeds warrior) |

**vs Previous (`6b89d2a`):**

| Preset | War Old | War New | Mage Old | Mage New | Notes |
|--------|---------|---------|----------|----------|-------|
| `none` | 32.2 | 32.9 | 28.9 | 16.9 | Mage -12 (Vitality nerf) |
| `early` | 38.2 | 32.3 | 40.5 | 17.7 | Both regressed |
| `mid` | 44.2 | 37.1 | 45.4 | 25.9 | Both regressed |
| `late` | 44.2 | 39.8 | 47.9 | 40.8 | Kiting partially compensates |
| `full` | 43.6 | 39.9 | 47.8 | 42.9 | Gap narrows at full |

Regressions caused by Vitality nerf (3%→1%/level) in survivability rebalance. At mid-tier upgrades, Vitality 5 now gives +5% HP instead of +15%. Power was redistributed to Resilience/Swiftness but those need max levels to compensate. At max-upgrades, both classes are endgame-viable (warrior 47.0, mage 47.8 in full baseline).

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression mid→late→full for both classes
- ✅ Kiting transforms mage performance (+14.9 depth)
- ⚠️ Early tier provides no meaningful benefit for either class at mid upgrades
- ⚠️ Mid-tier upgrades significantly weaker post-Vitality nerf (mage none: 28.9→16.9)
- ⚠️ Mage 4% CB at mid and full tiers

---

## Upgrade Progression (Phase 3)

Tests meta-upgrade impact on bot performance.

### Upgrade Progression @ `0789dc4` (50 runs, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Victories |
|--------|----------|-----------|-----------|---------|-------|-----------|
| `none` | No upgrades | 31.2 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 35.6 | 50 | 0% | +4.4 | 0 |
| `mid` | vit 5, mgt 5, res 5, swf 4, prc 2, cel 2 | 39.9 | 50 | 0% | +8.7 | 0 |
| `late` | vit 8, mgt 8, res 7, swf 6, prc 4, cel 4 | 40.2 | 50 | 0% | +9.0 | 0 |
| `full` | All maxed | 45.1 | 50 | 0% | +13.9 | 0 |

**vs Previous (`b4c83bc`):**

| Preset | Old | New | Delta | Notes |
|--------|-----|-----|-------|-------|
| `none` | 42.6 | 31.2 | -11.4 | Base much weaker |
| `early` | 44.9 | 35.6 | -9.3 | Early less impactful |
| `mid` | 44.5 | 39.9 | -4.6 | Narrowing |
| `late` | 45.6 | 40.2 | -5.4 | Late plateau |
| `full` | 45.3 | 45.1 | -0.2 | Full tier unchanged |

**Observations:**
- Upgrades now provide much stronger progression: +13.9 total spread (was +2.7)
- Base game weaker without upgrades: 31.2 (was 42.6) — upgrades matter more
- Clear staircase: none→early +4.4, early→mid +4.3, mid→late +0.3, late→full +4.9
- Late plateau: mid→late only +0.3 (resilience/swiftness diminishing returns at caps=full)
- Full tier converges: 45.1 vs old 45.3 — endgame unchanged

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide meaningful improvement at all tiers (+13.9 total)
- ✅ Strong progression feel (each tier noticeably better)
- ⚠️ Late plateau (mid→late only +0.3) — resilience/swiftness saturate with full capabilities

### Paired Progression @ `0789dc4` (50 runs, seed=1000)

Tests realistic player progression with matching capability and upgrade tiers.

**Warrior:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 21.1 | 144 | 0% | baseline |
| early/early | 19.9 | 126 | 0% | -1.2 |
| mid/mid | 37.1 | 372 | 0% | +16.0 |
| late/late | 40.0 | 441 | 0% | +18.9 |
| full/full | 45.1 | 463 | 0% | +24.0 |

**Mage:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 6.5 | 27 | 0% | baseline |
| early/early | 12.1 | 61 | 0% | +5.6 |
| mid/mid | 25.9 | 582 | 4% | +19.4 |
| late/late | 46.3 | 816 | 0% | +39.8 |
| full/full | 48.2 | 638 | 2% | +41.7 |

**Cross-Class Comparison:**

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 21.1 | 6.5 | -14.6 (mage nearly unplayable) |
| early/early | 19.9 | 12.1 | -7.8 (both struggle) |
| mid/mid | 37.1 | 25.9 | -11.2 (mage still behind) |
| late/late | 40.0 | 46.3 | +6.3 (mage surges past) |
| full/full | 45.1 | 48.2 | +3.1 (mage exceeds) |

**vs Previous (`b4c83bc`):**

| Tier | War Old | War New | Mage Old | Mage New |
|------|---------|---------|----------|----------|
| none/none | 23.1 | 21.1 | 14.1 | 6.5 |
| early/early | 35.1 | 19.9 | 24.9 | 12.1 |
| mid/mid | 41.9 | 37.1 | 43.8 | 25.9 |
| late/late | 45.8 | 40.0 | 48.1 | 46.3 |
| full/full | 45.3 | 45.1 | 47.9 | 48.2 |

**Cost Breakdown:**

| Component | none | early | mid | late | full |
|-----------|------|-------|-----|------|------|
| Capabilities | 0 | 1,150 | 2,580 | 5,404 | 8,038 |
| Upgrades | 0 | 412 | 3,309 | 11,997 | 25,421 |
| **Total** | 0 | 1,562 | 5,889 | 17,401 | 33,459 |

**Observations:**
- **Warrior early/early regression**: 19.9 < none/none 21.1 — early capabilities (town/farming) waste turns that warrior could use face-rushing. Early upgrades too weak to compensate.
- **Mage none/none collapsed**: 14.1 → 6.5 — Vitality nerf devastates raw mage (no HP buffer)
- **Mage late/late surges**: 46.3 depth — kiting + late upgrades combine powerfully
- **Full tier converges**: warrior 45.1 (was 45.3), mage 48.2 (was 47.9) — endgame stable
- **Mid-game valley**: Both classes significantly weaker at early/mid tiers post-rebalance
- **Mage crossover shifted**: Mage now exceeds warrior at late tier (was mid)

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression late→full for both classes
- ✅ Full tier endgame unchanged (warrior 45.1, mage 48.2)
- ⚠️ Warrior early/early is a regression (-1.2 vs none/none)
- ⚠️ Mage none/none nearly unplayable (6.5 avg depth)
- ⚠️ Mid-game valley: early/mid tiers significantly weaker than pre-rebalance
- ❌ Mage doesn't catch warrior until late tier (was mid)

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
