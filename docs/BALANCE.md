# Balance

Game balance methodology, diagnostic tooling, and historical baselines.

## Testing Dimensions

```
Character:     11 classes × 11 races = 121 combinations
Boosters:      class-optimal vs custom loadouts
Personality:   4 types (cautious, aggressive, greedy, speedrunner)
Bot caps:      5 tiers (none, early, mid, late, full)
Upgrades:      5 tiers (none, early, mid, late, full)
```

Full combinatorial testing is impractical (~12,100 configs). This guide defines a progressive approach that validates balance efficiently.

## Reference Configuration

All tests use this baseline unless specified:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--seed` | 1000 | Reproducibility |
| `--runs` | 100 | Statistical significance, ~2-3 min per class |
| `--turns` | 50000 | Catches caster CB issues at high turn counts |
| `--race` | human | Neutral baseline |
| `--class` | warrior | Simplest mechanics |
| `--personality` | cautious | Default, most tested |
| `--upgrades` | full | Meta-progression maxed |
| `--boosters` | class | Class-optimal loadout |
| `--capabilities` | full | Bot fully unlocked |

---

## Diagnostic Tooling

```bash
# Quick single run (stdout by default)
pnpm diagnose quick --seed=12345 --class=warrior

# Deep dive with turn log
pnpm diagnose deep --seed=12345 --class=warrior --map

# Standard batch test
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --turns=50000

# Find problematic seeds
pnpm diagnose find --runs=100 --seed=1000 --class=mage --turns=50000

# Full baseline across all 11 classes (~16 min)
pnpm diagnose baseline --seed=1000 --turns=50000

# Race baseline across all 11 races (~16 min)
pnpm diagnose baseline-races --seed=1000 --turns=50000

# Upgrade sensitivity test (~10 min)
pnpm diagnose sensitivity --seed=1000 --class=warrior

# Personality comparison
pnpm diagnose compare --runs=50 --seed=1000 --class=CLASS --turns=50000
```

### Output

Most modes write to `/tmp/borglike-diagnose/` as timestamped `.txt` + `.json` pairs.
Quick mode defaults to stdout. Use `--stdout` to force stdout for any mode.

```bash
# List recent results
ls -lt /tmp/borglike-diagnose/

# Read human-friendly text
cat /tmp/borglike-diagnose/20260206-143000-baseline-seed1000-100runs.txt

# Parse JSON with jq
jq '.result[] | {classId, avgDepth, morgothKills}' /tmp/borglike-diagnose/*baseline*.json
jq '.result.runs[] | select(.depth >= 50)' /tmp/borglike-diagnose/*batch*.json
jq '.config' /tmp/borglike-diagnose/*baseline*.json  # check run config
```

**Parallel execution:** Run only 2 batch commands simultaneously (8 threads each = 16 total).

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--upgrades=X` | full | Upgrade preset: none, early, mid, late, full |
| `--boosters=X` | class | Booster preset: none, class, or comma-separated IDs |
| `--capabilities=X` | full | Capability preset: none, early, mid, late, full |
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

### Upgrade Presets (`--upgrades=X`)

| Preset | Upgrades |
|--------|----------|
| `none` | No upgrades |
| `early` | vitality 2, might 2, resilience 1 |
| `mid` | vitality 5, might 5, resilience 5, reflexes 4, precision 2, swiftness 2 |
| `late` | vitality 8, might 8, resilience 7, reflexes 6, precision 4, swiftness 4 |
| `full` | All upgrades at max level |

### Booster Presets (`--boosters=X`)

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

### Capability Presets (`--capabilities=X`)

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town_1, farming, tactics_1, preparedness_1, targeting_1, retreat_1 | 15-20 |
| `mid` | town_2, farming, tactics_2, preparedness_2, sweep_1, surf_1, kiting_1, targeting_2, retreat_2 | 25-35 |
| `late` | town_3, farming, tactics_3, preparedness_3, sweep_2, surf_2, kiting_2, targeting_3, retreat_3 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

### Interpreting Results

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Depth | 45+ | 35-44 | <35 |
| Max Depth | 50 | 48-49 | <48 |
| CB Rate | 0-2% | 3-10% | >10% |
| Morgoth Kills | >=1 | 0 | N/A |

**Common Issues:**
- **High CB Rate:** Bot getting stuck, investigate with `deep` mode
- **Low Avg Depth:** Class/race underpowered or bot can't handle playstyle
- **High Variance:** Inconsistent performance, may indicate RNG sensitivity

---

## Testing Phases

### Phase 1: Race Baseline

**Goal:** Establish race balance with human as reference.

Races are character-defining choices made at game start. Players need to understand relative power levels before investing in unlocks.

```bash
pnpm diagnose baseline-races --seed=1000 --turns=50000
```

**Success Criteria:**
- All races reach depth 40+ average
- No race exceeds human by >5 avg depth (power creep)
- No race falls below human by >8 avg depth (trap option)
- CB rates <5% across all races

### Phase 2: Capability Progression

**Goal:** Validate bot performs progressively better with unlocks.

Bot capabilities are the primary unlock loop. Players need to feel progression as they purchase upgrades.

```bash
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=TIER --turns=50000
```

**Success Criteria:**
- Clear progression: each tier > previous by 5+ avg depth
- No tier feels "wasted" (< 3 depth gain)
- No single capability dominates (test via exclusion)

### Phase 3: Upgrade Progression

**Goal:** Validate meta-upgrades provide meaningful progression.

Upgrades are the permanent progression layer. Need to validate they compound well with capabilities.

```bash
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=TIER --capabilities=full --turns=50000
```

**Success Criteria:**
- Clear progression curve
- Upgrades + capabilities compound (full/full > full/none + none/full)
- No upgrade tier feels mandatory (can progress without)

### Phase 4: Upgrade Sensitivity

**Goal:** Identify which individual upgrades matter most.

Helps prioritize unlock order UX and identify overpowered/underpowered upgrades.

```bash
pnpm diagnose sensitivity --seed=1000 --class=CLASS
```

| Impact | Delta | Meaning |
|--------|-------|---------|
| 🔴 High | >10% depth loss | Critical, prioritize early |
| 🟡 Medium | 5-10% | Important but not blocking |
| 🟢 Low | <5% | Nice-to-have, can defer |

**Success Criteria:**
- No single upgrade > 15% impact (too dominant)
- Stat upgrades roughly equal impact across classes
- QoL upgrades < 5% impact (convenience, not power)

### Phase 5: Cross-Class Race Testing

**Goal:** Validate races work across class archetypes.

Race/class synergies may create outliers not visible in warrior-only testing.

| Archetype | Classes | Primary Stat |
|-----------|---------|--------------|
| Melee | warrior, berserker, blackguard | STR |
| Caster | mage, archmage, necromancer | INT |
| Hybrid | ranger, paladin, druid | Mixed |
| Specialist | rogue, priest | DEX/WIS |

**Success Criteria:**
- No race/class combo > 10% better than human/same-class
- No race/class combo > 15% worse than human/same-class
- Synergies feel intentional, not broken

### Phase 6: Personality Comparison (Low Priority)

**Goal:** Validate personality behaviors don't break baseline classes.

| Personality | Behavior | Expected Impact |
|-------------|----------|-----------------|
| cautious | Safe play, retreat early | Baseline |
| aggressive | Push deeper, risk more | Higher variance, similar avg |
| greedy | Prioritize loot | More gold, slightly lower depth |
| speedrunner | Rush stairs | Faster runs, lower depth |

**Success Criteria:**
- All personalities viable (reach depth 35+)
- No personality strictly dominates cautious

### Regression Testing

Re-run full class baseline after combat formula changes, monster stat/spawn changes, bot AI behavior changes, or new class/race additions.

**Quick regression check (3 most sensitive classes):**
```bash
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --turns=50000
pnpm diagnose batch --runs=50 --seed=1000 --class=mage --turns=50000
pnpm diagnose batch --runs=50 --seed=1000 --class=necromancer --turns=50000
```

---

## Baselines

### Class Baseline @ `b42c753` (50 runs, 50k turns, seed=1000, upgrades=full)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Paladin** | 49.7 | 50 | 0% | 22388 | 686 | 8 | ✅ Endgame |
| **Priest** | 48.4 | 50 | 0% | 25468 | 782 | 1 | ✅ Endgame |
| **Druid** | 48.2 | 50 | 0% | 22828 | 633 | 0 | ✅ Endgame |
| **Mage** | 47.7 | 50 | 2% | 26522 | 613 | 1 | ✅ Endgame |
| **Necromancer** | 47.7 | 50 | 2% | 23784 | 651 | 3 | ✅ Endgame |
| **Ranger** | 47.1 | 50 | 0% | 21521 | 606 | 1 | ✅ Endgame |
| **Blackguard** | 46.9 | 50 | 0% | 15143 | 515 | 2 | ✅ Endgame |
| **Rogue** | 46.4 | 50 | 0% | 21402 | 577 | 1 | ✅ Endgame |
| **Berserker** | 45.7 | 50 | 0% | 14063 | 466 | 1 | ✅ Endgame |
| **Archmage** | 45.4 | 50 | 4% | 25714 | 579 | 0 | ✅ Endgame |
| **Warrior** | 44.1 | 50 | 0% | 14909 | 454 | 1 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable. **19 Morgoth kills** (8 paladin, 3 necromancer, 2 blackguard, 1 each priest/mage/ranger/rogue/berserker/warrior). CB rates: archmage 4%, mage/necromancer 2%, all others 0%. Spread: 44.1-49.7 (5.6 depth). Runtime: 364s.

**Tiers:**
- **S:** Paladin (49.7) — dominant, 8 Morgoth kills
- **A:** Priest (48.4), Druid (48.2), Mage (47.7), Necromancer (47.7)
- **B:** Ranger (47.1), Blackguard (46.9), Rogue (46.4)
- **C:** Berserker (45.7), Archmage (45.4), Warrior (44.1)

---

### Race Baseline @ `b42c753` (50 runs, 50k turns, seed=1000, class=warrior, upgrades=full)

| Race | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Dunadan** | 46.8 | 50 | 0% | 15924 | 505 | 3 | ✅ Endgame |
| **Kobold** | 46.7 | 50 | 0% | 14896 | 511 | 0 | ✅ Endgame |
| **Half-Orc** | 46.5 | 50 | 0% | 15170 | 505 | 2 | ✅ Endgame |
| **Half-Troll** | 46.4 | 50 | 0% | 15091 | 504 | 3 | ✅ Endgame |
| **Dwarf** | 45.8 | 50 | 0% | 14666 | 504 | 2 | ✅ Endgame |
| **Gnome** | 45.1 | 50 | 0% | 14517 | 483 | 3 | ✅ Endgame |
| **High-Elf** | 44.5 | 50 | 0% | 14546 | 480 | 0 | ✅ Endgame |
| **Half-Elf** | 44.4 | 50 | 0% | 15314 | 477 | 0 | ✅ Endgame |
| **Elf** | 44.1 | 50 | 0% | 14586 | 472 | 3 | ✅ Endgame |
| **Human** | 44.1 | 50 | 0% | 14909 | 454 | 1 | ✅ Endgame |
| **Hobbit** | 42.6 | 50 | 0% | 14029 | 452 | 2 | ✅ Endgame |

**Summary:** All 11 races endgame-viable. **19 Morgoth kills** (3 dunadan, 3 half-troll, 3 gnome, 3 elf, 2 half-orc, 2 dwarf, 2 hobbit, 1 human). All CB rates 0%. Spread: 42.6-46.8 (4.2 depth). Runtime: 280s.

**Tiers:**
- **A:** Dunadan (46.8), Kobold (46.7), Half-Orc (46.5), Half-Troll (46.4) — top cluster
- **B:** Dwarf (45.8), Gnome (45.1) — solid middle
- **C:** High-Elf (44.5), Half-Elf (44.4), Elf (44.1), Human (44.1), Hobbit (42.6) — viable but trailing

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 42.6)
- ✅ No race exceeds human by >5 avg depth (max delta: +2.7)
- ✅ No race falls below human by >8 avg depth (min delta: -1.5)
- ✅ CB rates <5% (all 0%)

---

## Capability Progression

### Warrior @ `b42c753` (50 runs, 50k turns, seed=1000, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|-----------|-----------|---------|-----------|-------|-------|
| `none` | 32.6 | 50 | 0% | 8796 | 256 | baseline |
| `early` | 31.4 | 50 | 0% | 8396 | 240 | -1.2 |
| `mid` | 33.3 | 50 | 0% | 9893 | 314 | +0.7 |
| `late` | 38.5 | 50 | 0% | 13692 | 426 | +5.9 |
| `full` | 38.2 | 50 | 0% | 14786 | 419 | +5.6 |

**Observations:**
- Early tier regression (-1.2) — town/farming waste turns that warrior could use face-rushing
- Mid tier barely helps (+0.7, noise) — sweep/surf minor for tanky melee
- Late tier jump (+5.9) — retreat/kiting tier is where warrior benefits
- Full plateau (38.2 vs 38.5) — extra caps don't help warrior beyond late
- All CB rates 0%

### Mage @ `b42c753` (50 runs, 50k turns, seed=1000, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|-----------|-----------|---------|-----------|-------|-------|
| `none` | 15.0 | 23 | 0% | 3803 | 82 | baseline |
| `early` | 13.7 | 24 | 0% | 3454 | 74 | -1.3 |
| `mid` | 23.0 | 40 | 2% | 25842 | 541 | +8.0 |
| `late` | 40.1 | 50 | 14% | 41803 | 913 | +25.1 |
| `full` | 42.2 | 50 | 4% | 43767 | 940 | +27.2 |

**Observations:**
- Dramatic progression: none→full is +27.2 depth
- Early tier regression (-1.3) — same pattern as warrior, basic caps can't help squishy mage
- Mid tier meaningful (+8.0) — sweep/surf let mage avoid threats
- Late tier transformative (+17.1 from mid) — kiting is the single biggest unlock for casters
- Late tier 14% CB rate — kiting pushes mage deeper but bot gets stuck more often
- Full tier reduces CB to 4% — additional caps (targeting_3, retreat_3) stabilize kiting

### Cross-Class Comparison

| Preset | Warrior | Mage | Mage vs Warrior |
|--------|---------|------|-----------------|
| `none` | 32.6 | 15.0 | -17.6 (mage struggles hard without capabilities) |
| `early` | 31.4 | 13.7 | -17.7 (basic capabilities insufficient for either) |
| `mid` | 33.3 | 23.0 | -10.3 (sweep/surf help mage more) |
| `late` | 38.5 | 40.1 | +1.6 (kiting equalizes, mage passes warrior) |
| `full` | 38.2 | 42.2 | +4.0 (mage exceeds warrior at full) |

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression mid→late→full for both classes
- ✅ Kiting transforms mage (+17.1 depth from mid→late)
- ✅ Mage crosses over warrior at late tier (kiting equalizes)
- ⚠️ Early tier provides no benefit for either class at mid upgrades
- ⚠️ Mage late 14% CB rate (kiting bot gets stuck)

---

## Upgrade Progression

### Warrior Upgrade Tiers @ `b42c753` (50 runs, 50k turns, seed=1000, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|----------|-----------|-----------|---------|-----------|-------|-------|
| `none` | No upgrades | 33.7 | 50 | 0% | 13263 | 355 | baseline |
| `early` | vit 2, mgt 2, res 1 | 32.7 | 50 | 0% | 12749 | 340 | -1.0 |
| `mid` | vit 5, mgt 5, res 5, rfx 4, prc 2, swf 2 | 38.2 | 50 | 0% | 14786 | 419 | +4.5 |
| `late` | vit 8, mgt 8, res 7, rfx 6, prc 4, swf 4 | 43.6 | 50 | 0% | 16088 | 496 | +9.9 |
| `full` | All maxed | 43.9 | 50 | 0% | 14447 | 450 | +10.2 |

**Observations:**
- Early tier slight regression (-1.0, noise) — early upgrades too weak to register on warrior
- Mid tier meaningful jump (+4.5) — reflexes/resilience start mattering
- Late tier big jump (+9.9) — full survivability suite kicks in
- Late/full plateau (43.6 vs 43.9) — diminishing returns at max caps
- Total progression: +10.2 depth from none→full
- All CB rates 0%

### Paired Progression @ `b42c753` (50 runs, 50k turns, seed=1000)

Matching capability and upgrade tiers — simulates realistic player progression.

**Warrior:**

| Tier | Avg Depth | Max Depth | CB | Kills | Delta |
|------|-----------|-----------|-----|-------|-------|
| none/none | 19.3 | 50 | 0% | 122 | baseline |
| early/early | 22.7 | 50 | 0% | 157 | +3.3 |
| mid/mid | 33.3 | 50 | 0% | 314 | +13.9 |
| late/late | 41.5 | 50 | 0% | 465 | +22.1 |
| full/full | 43.9 | 50 | 0% | 450 | +24.6 |

**Mage:**

| Tier | Avg Depth | Max Depth | CB | Kills | Delta |
|------|-----------|-----------|-----|-------|-------|
| none/none | 5.6 | 11 | 0% | 22 | baseline |
| early/early | 11.7 | 22 | 0% | 57 | +6.0 |
| mid/mid | 23.0 | 40 | 2% | 541 | +17.4 |
| late/late | 45.7 | 50 | 4% | 806 | +40.0 |
| full/full | 47.5 | 50 | 2% | 612 | +41.8 |

### Cross-Class Comparison (Paired)

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 19.3 | 5.6 | -13.7 (mage nearly unplayable) |
| early/early | 22.7 | 11.7 | -11.0 (both struggle, mage worse) |
| mid/mid | 33.3 | 23.0 | -10.3 (mage still behind) |
| late/late | 41.5 | 45.7 | +4.2 (mage surges past — kiting) |
| full/full | 43.9 | 47.5 | +3.6 (mage exceeds warrior) |

**Observations:**
- **Warrior smooth progression**: none/none 19.3 → full/full 43.9 (+24.6 total)
- **Mage explosive late surge**: none/none 5.6 → late/late 45.7 (+40.0) — kiting + late upgrades combine
- **Mage crosses warrior at late tier** — same crossover point as capability progression
- **Mage full/full gets 1 Morgoth kill** and reaches 47.5 avg depth
- **Early tier works for paired** (+3.3 warrior, +6.0 mage) — unlike capability-only where early hurt

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide meaningful improvement at all tiers (+10.2 total for warrior)
- ✅ Strong paired progression feel (each tier noticeably better)
- ✅ Mage full/full viable and endgame (47.5 avg, 1 Morgoth kill)
- ⚠️ Late/full plateau for warrior (43.6 vs 43.9)

---

## Upgrade Sensitivity

### 6-Class Sensitivity @ `b42c753` (50 runs, 20k turns, seed=1000)

*Note: Previous run had a bug — `celerity` (non-existent ID) instead of `swiftness`, and `swiftness` mislabeled as dodge instead of `reflexes`. Fixed in sensitivity.ts, re-run with correct IDs.*

| Upgrade | Warrior | Mage | Rogue | Ranger | Paladin | Druid |
|---------|---------|------|-------|--------|---------|-------|
| **Vitality** | -2.3% | **-39.6%** | -2.6% | -1.6% | -1.2% | **-5.2%** |
| **Resilience** | -2.7% | -1.9% | -0.9% | +0.0% | -0.7% | -2.5% |
| **Reflexes** | **-2.8%** | +0.5% | -2.1% | +1.7% | -0.4% | -0.5% |
| **Swiftness** | -2.5% | -2.6% | -1.0% | **-3.9%** | -0.7% | +0.2% |
| **Might** | -0.4% | -0.5% | -0.1% | +0.1% | -0.4% | +0.2% |
| **Precision** | +0.2% | +0.5% | -0.6% | +0.4% | +0.0% | +0.2% |

**Per-class baselines:** Warrior 48.3, Mage 47.9, Rogue 49.3, Ranger 48.1, Paladin 49.9, Druid 48.9

**Analysis:**

- **Mage Vitality dominance** (-39.6%) — squishy casters live or die by HP buffer
- **Warrior balanced survivability**: Reflexes -2.8%, Resilience -2.7%, Swiftness -2.5%, Vitality -2.3% — four defensive upgrades matter roughly equally
- **Druid Vitality dependency** (-5.2%) — medium impact, shapeshift forms need HP
- **Ranger Swiftness** (-3.9%) — speed is critical for ranger's kiting playstyle
- **Ranger Reflexes anomaly** (+1.7%) — removing dodge *helps* ranger. Hypothesis: dodge procs interfere with kiting rhythm, or evasion stat already high enough that the upgrade pushes into diminishing returns
- **Swiftness matters across classes**: Warrior -2.5%, Mage -2.6%, Ranger -3.9% — speed upgrade is impactful (previous 0% was due to test bug using non-existent `celerity` ID)
- **Paladin ceiling**: baseline 49.9, all impacts <1.3% — too strong for any single upgrade to register
- **Precision/Might negligible** — accuracy and damage % have near-zero impact at endgame power levels

**Success Criteria:** ⚠️ Partial
- ✅ No single upgrade >15% impact except mage Vitality (expected/thematic)
- ✅ Survivability quartet (Vitality/Resilience/Reflexes/Swiftness) works for warrior
- ✅ Swiftness is functional and impactful (bug fixed — was testing phantom `celerity` ID)
- ⚠️ Precision/Might negligible — only 4 of 6 upgrades matter for most classes
- ⚠️ Ranger Reflexes positive anomaly needs investigation

---

## Cross-Class Race Testing

*Not yet run at current commit. Next: test 11 races x 3 archetype classes (warrior, mage, ranger).*

---

## Personality Comparison (Low Priority)

*Not yet run at current commit.*

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate tuning
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
- `docs/BALANCE-PASS-3.md` - Pure caster fixes (vision, stair-surf, phase door)
- `docs/BALANCE-PASS-4.md` - Goal oscillation, caution threshold, vault fixes, TP scroll fixes
- `docs/BALANCE-PASS-5.md` - Historical baselines and archived test data
- `docs/XP-CURVE-ANALYSIS.md` - XP curve analysis and two-part curve implementation
