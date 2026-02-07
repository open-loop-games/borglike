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
| `--runs` | 100 | Statistical significance, ~1 min per class |
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

# Full baseline across all 11 classes (~8 min)
pnpm diagnose baseline --seed=1000 --turns=50000

# Race baseline across all 11 races (~8 min)
pnpm diagnose baseline-races --seed=1000 --turns=50000

# Upgrade sensitivity, single class (~5 min)
pnpm diagnose sensitivity --seed=1000 --class=warrior

# Upgrade sensitivity, all 6 classes in one pool (~8 min)
pnpm diagnose sensitivity --classes=all --seed=1000

# Personality comparison
pnpm diagnose compare --runs=50 --seed=1000 --class=CLASS --turns=50000

# Matrix: cross-class race testing (single shared pool)
pnpm diagnose matrix --classes=warrior,mage,ranger --races=all --runs=50 --turns=50000

# Matrix: capability progression sweep
pnpm diagnose matrix --class=warrior --upgrades=mid --cap-tiers=none,early,mid,late,full

# Matrix: paired progression (upgrade + capability at same tier)
pnpm diagnose matrix --class=warrior --progression=none,early,mid,late,full

# Matrix: all classes × 2 races
pnpm diagnose matrix --classes=all --races=human,dwarf --runs=100 --turns=50000
```

### Output

Most modes write to `/tmp/borglike-diagnose/` as timestamped `.txt` + `.json` pairs.
Matrix mode uses subfolders per cell. Quick mode defaults to stdout. Use `--stdout` to force stdout for any mode.

```bash
# List recent results
ls -lt /tmp/borglike-diagnose/

# Read human-friendly text
cat /tmp/borglike-diagnose/20260206-143000-baseline-seed1000-100runs.txt

# Matrix results use subfolders
cat /tmp/borglike-diagnose/20260206-143000-matrix/summary.txt
ls /tmp/borglike-diagnose/20260206-143000-matrix/warrior-human/

# Parse JSON with jq
jq '.result[] | {classId, avgDepth, morgothKills}' /tmp/borglike-diagnose/*baseline*.json
jq '.result.runs[] | select(.depth >= 50)' /tmp/borglike-diagnose/*batch*.json
jq '.config' /tmp/borglike-diagnose/*baseline*.json  # check run config
```

**Thread pool:** All modes share a singleton thread pool. Use `matrix` mode instead of parallel processes for cross-class/race testing — one pool of 20 threads beats 9 processes × 8 threads each.

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

### Matrix Flags

| Flag | Description |
|------|-------------|
| `--classes=X` | Comma-separated class IDs or `all` (11 classes) |
| `--races=X` | Comma-separated race IDs or `all` (11 races) |
| `--personalities=X` | Comma-separated or `all` (4 personalities) |
| `--cap-tiers=X` | Capability tiers to sweep (e.g., `none,early,mid,late,full`) |
| `--upgrade-tiers=X` | Upgrade tiers to sweep |
| `--progression=X` | Paired tiers: sets both upgrades AND capabilities (zipped, not crossed) |

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
# Single tier
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=mid --capabilities=TIER --turns=50000

# All tiers at once (matrix mode)
pnpm diagnose matrix --class=warrior --upgrades=mid --cap-tiers=none,early,mid,late,full --runs=50 --turns=50000
```

**Success Criteria:**
- Clear progression: each tier > previous by 5+ avg depth
- No tier feels "wasted" (< 3 depth gain)
- No single capability dominates (test via exclusion)

### Phase 3: Upgrade Progression

**Goal:** Validate meta-upgrades provide meaningful progression.

Upgrades are the permanent progression layer. Need to validate they compound well with capabilities.

```bash
# Single tier
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --upgrades=TIER --capabilities=full --turns=50000

# All tiers at once (matrix mode)
pnpm diagnose matrix --class=warrior --upgrade-tiers=none,early,mid,late,full --capabilities=full --runs=50 --turns=50000

# Paired progression (upgrade + capability at same tier)
pnpm diagnose matrix --class=warrior --progression=none,early,mid,late,full --runs=50 --turns=50000
```

**Success Criteria:**
- Clear progression curve
- Upgrades + capabilities compound (full/full > full/none + none/full)
- No upgrade tier feels mandatory (can progress without)

### Phase 4: Upgrade Sensitivity

**Goal:** Identify which individual upgrades matter most.

Helps prioritize unlock order UX and identify overpowered/underpowered upgrades.

```bash
# Single class
pnpm diagnose sensitivity --seed=1000 --class=CLASS

# All classes (single pool, per-class + cross-class summary)
pnpm diagnose sensitivity --classes=all --seed=1000
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
pnpm diagnose matrix --classes=warrior,mage,rogue --runs=50 --seed=1000 --turns=50000
```

---

## Baselines

### Class Baseline @ `62bddb9` (100 runs, 50k turns, seed=1000, upgrades=full)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Paladin** | 49.7 | 50 | 0% | 22388 | 686 | 8 | ✅ Endgame |
| **Priest** | 48.4 | 50 | 0% | 25468 | 782 | 1 | ✅ Endgame |
| **Druid** | 48.2 | 50 | 0% | 22828 | 633 | 0 | ✅ Endgame |
| **Mage** | 47.7 | 50 | 1% | 28113 | 631 | 2 | ✅ Endgame |
| **Necromancer** | 47.7 | 50 | 2% | 23784 | 651 | 3 | ✅ Endgame |
| **Ranger** | 47.1 | 50 | 0% | 21521 | 606 | 1 | ✅ Endgame |
| **Blackguard** | 46.9 | 50 | 0% | 15143 | 515 | 2 | ✅ Endgame |
| **Rogue** | 46.4 | 50 | 0% | 21402 | 577 | 1 | ✅ Endgame |
| **Berserker** | 45.7 | 50 | 0% | 14063 | 466 | 1 | ✅ Endgame |
| **Archmage** | 45.4 | 50 | 4% | 25714 | 579 | 0 | ✅ Endgame |
| **Warrior** | 44.1 | 50 | 0% | 14909 | 454 | 1 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable. **20 Morgoth kills** (8 paladin, 3 necromancer, 2 blackguard, 2 mage, 1 each priest/ranger/rogue/berserker/warrior). CB rates: archmage 4%, necromancer 2%, mage 1%, all others 0%. Spread: 44.1-49.7 (5.6 depth). Runtime: 367s.

**Tiers:**
- **S:** Paladin (49.7) — dominant, 8 Morgoth kills
- **A:** Priest (48.4), Druid (48.2), Mage (47.7), Necromancer (47.7)
- **B:** Ranger (47.1), Blackguard (46.9), Rogue (46.4)
- **C:** Berserker (45.7), Archmage (45.4), Warrior (44.1)

---

### Race Baseline @ `62bddb9` (100 runs, 50k turns, seed=1000, class=warrior, upgrades=full)

| Race | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Dunadan** | 46.8 | 50 | 0% | 15924 | 505 | 3 | ✅ Endgame |
| **Kobold** | 46.7 | 50 | 0% | 14896 | 511 | 0 | ✅ Endgame |
| **Half-Orc** | 46.5 | 50 | 0% | 15170 | 505 | 2 | ✅ Endgame |
| **Half-Troll** | 46.4 | 50 | 0% | 15091 | 504 | 3 | ✅ Endgame |
| **Dwarf** | 45.8 | 50 | 0% | 14666 | 504 | 2 | ✅ Endgame |
| **Gnome** | 45.1 | 50 | 0% | 14517 | 483 | 3 | ✅ Endgame |
| **High-Elf** | 44.5 | 50 | 0% | 14546 | 480 | 0 | ✅ Endgame |
| **Half-Elf** | 44.5 | 50 | 0% | 14740 | 468 | 1 | ✅ Endgame |
| **Human** | 44.1 | 50 | 0% | 14909 | 454 | 1 | ✅ Endgame |
| **Elf** | 43.8 | 50 | 0% | 14361 | 465 | 1 | ✅ Endgame |
| **Hobbit** | 42.6 | 50 | 0% | 14029 | 452 | 2 | ✅ Endgame |

**Summary:** All 11 races endgame-viable. **16 Morgoth kills** (3 dunadan, 3 half-troll, 3 gnome, 2 half-orc, 2 dwarf, 2 hobbit, 1 half-elf, 1 human, 1 elf). All CB rates 0%. Spread: 42.6-46.8 (4.2 depth). Runtime: 222s.

**Tiers:**
- **A:** Dunadan (46.8), Kobold (46.7), Half-Orc (46.5), Half-Troll (46.4) — top cluster
- **B:** Dwarf (45.8), Gnome (45.1) — solid middle
- **C:** High-Elf (44.5), Half-Elf (44.5), Human (44.1), Elf (43.8), Hobbit (42.6) — viable but trailing

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

### Mage @ `62bddb9` (50 runs, 50k turns, seed=1000, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|-----------|-----------|---------|-----------|-------|-------|
| `none` | 15.5 | 25 | 0% | 4027 | 87 | baseline |
| `early` | 15.7 | 24 | 0% | 4077 | 87 | +0.2 |
| `mid` | 23.9 | 38 | 0% | 25706 | 542 | +8.4 |
| `late` | 41.8 | 50 | 6% | 42320 | 943 | +26.3 |
| `full` | 42.8 | 50 | 2% | 43888 | 943 | +27.3 |

**Observations:**
- Dramatic progression: none→full is +27.3 depth
- Early tier no longer regresses (+0.2) — hitdie bump fixes the early survivability cliff
- Mid tier meaningful (+8.4) — sweep/surf let mage avoid threats
- Late tier transformative (+17.9 from mid) — kiting is the single biggest unlock for casters
- Late tier 6% CB rate — improved from 14% (hitdie bump helps kiting bot survive longer)
- Full tier reduces CB to 2% — additional caps (targeting_3, retreat_3) stabilize kiting

### Cross-Class Comparison

| Preset | Warrior | Mage | Mage vs Warrior |
|--------|---------|------|-----------------|
| `none` | 32.6 | 15.5 | -17.1 (mage struggles hard without capabilities) |
| `early` | 31.4 | 15.7 | -15.7 (basic capabilities insufficient for either) |
| `mid` | 33.3 | 23.9 | -9.4 (sweep/surf help mage more) |
| `late` | 38.5 | 41.8 | +3.3 (kiting equalizes, mage passes warrior) |
| `full` | 38.2 | 42.8 | +4.6 (mage exceeds warrior at full) |

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression mid→late→full for both classes
- ✅ Kiting transforms mage (+17.9 depth from mid→late)
- ✅ Mage crosses over warrior at late tier (kiting equalizes)
- ✅ Early tier no longer regresses for mage (+0.2, was -1.3)
- ⚠️ Early tier still regresses for warrior (-1.2)
- ⚠️ Mage late 6% CB rate (improved from 14%)

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

**Mage @ `62bddb9`:**

| Tier | Avg Depth | Max Depth | CB | Kills | Delta |
|------|-----------|-----------|-----|-------|-------|
| none/none | 6.5 | 17 | 0% | 26 | baseline |
| early/early | 11.5 | 20 | 0% | 57 | +5.0 |
| mid/mid | 23.9 | 38 | 0% | 542 | +17.4 |
| late/late | 45.9 | 50 | 6% | 828 | +39.4 |
| full/full | 47.9 | 50 | 0% | 640 | +41.4 |

### Mage Upgrade Tiers @ `62bddb9` (50 runs, 50k turns, seed=1000, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|----------|-----------|-----------|---------|-----------|-------|-------|
| `none` | No upgrades | 27.1 | 44 | 4% | 39152 | 825 | baseline |
| `early` | vit 2, mgt 2, res 1 | 38.6 | 49 | 10% | 45885 | 983 | +11.5 |
| `mid` | vit 5, mgt 5, res 5, rfx 4, prc 2, swf 2 | 42.8 | 50 | 2% | 43888 | 943 | +15.7 |
| `late` | vit 8, mgt 8, res 7, rfx 6, prc 4, swf 4 | 46.0 | 50 | 2% | 37606 | 814 | +18.9 |
| `full` | All maxed | 47.9 | 50 | 0% | 29020 | 640 | +20.8 |

**Observations:**
- Strong monotonic progression: none→full is +20.8 depth
- Early tier huge jump (+11.5) — Vitality is transformative for squishy mage
- Early tier 10% CB rate — bot pushes deeper but gets stuck more
- Mid/late/full all improve while reducing CB rates
- Full tier 0% CB — upgrades fully stabilize mage at endgame
- Total progression: +20.8 depth from none→full (vs warrior's +10.2)

### Cross-Class Comparison (Paired)

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 19.3 | 6.5 | -12.8 (mage nearly unplayable) |
| early/early | 22.7 | 11.5 | -11.2 (both struggle, mage worse) |
| mid/mid | 33.3 | 23.9 | -9.4 (mage still behind) |
| late/late | 41.5 | 45.9 | +4.4 (mage surges past — kiting) |
| full/full | 43.9 | 47.9 | +4.0 (mage exceeds warrior) |

**Observations:**
- **Warrior smooth progression**: none/none 19.3 → full/full 43.9 (+24.6 total)
- **Mage explosive late surge**: none/none 6.5 → late/late 45.9 (+39.4) — kiting + late upgrades combine
- **Mage crosses warrior at late tier** — same crossover point as capability progression
- **Mage full/full gets 1 Morgoth kill** and reaches 47.9 avg depth with 0% CB
- **Early tier works for paired** (+3.3 warrior, +5.0 mage) — unlike capability-only where early hurt warrior

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide meaningful improvement at all tiers (+10.2 warrior, +20.8 mage)
- ✅ Strong paired progression feel (each tier noticeably better)
- ✅ Mage full/full viable and endgame (47.9 avg, 1 Morgoth, 0% CB)
- ⚠️ Late/full plateau for warrior (43.6 vs 43.9)

---

## Upgrade Sensitivity

### 6-Class Sensitivity @ `bd42bbf` (50 runs, 30k turns, seed=1000)

*Changes from `62bddb9`: Precision replaced accuracy (+3/lvl) with armor pen (+1%/lvl, maxLevel 10). Swiftness extended maxLevel 5→10 (+20 speed at full vs +10).*

| Upgrade | Warrior | Mage | Rogue | Ranger | Paladin | Druid |
|---------|---------|------|-------|--------|---------|-------|
| **Vitality** | -0.8% | **-39.5%** | -2.5% | -0.7% | -0.6% | -3.8% |
| **Resilience** | -0.8% | -1.5% | +0.1% | -0.2% | -0.4% | -2.1% |
| **Reflexes** | -0.7% | -1.6% | -0.7% | +0.7% | +0.1% | -0.1% |
| **Swiftness** | -0.7% | -3.0% | -1.0% | **-7.0%** | -0.2% | -0.8% |
| **Might** | -0.2% | -1.5% | +0.7% | -0.4% | -0.5% | -1.2% |
| **Precision** | -0.5% | -0.8% | -0.5% | -0.4% | -0.2% | -0.5% |

**Per-class baselines:** Warrior 49.2, Mage 49.2, Rogue 49.6, Ranger 49.5, Paladin 50.0, Druid 49.5

**Analysis:**

- **Baselines all rose** from doubled Swiftness: Ranger +1.4, Warrior +0.9, Mage +0.7, Druid +0.6, Rogue +0.3, Paladin +0.1
- **Mage Vitality dominance** (-39.5%) — unchanged, structural
- **Ranger Swiftness now medium-impact** (-7.0%, was -3.9%) — doubled speed levels transform kiting. Ranger gained +1.4 avg depth from this change alone
- **Precision now registers negatively across all classes** (-0.2% to -0.8%) — armor pen works. Low impact but consistently correct direction, no longer negligible noise like accuracy was
- **Druid Vitality dependency** (-3.8%, was -5.2%) — reduced because baseline rose
- **Warrior sensitivity compressed** — baseline 49.2 (was 48.3), all impacts <1%. Less headroom to lose
- **Paladin ceiling** at 50.0 — perfect baseline, all impacts <0.6%
- **Ranger Reflexes anomaly persists** (+0.7%, was +1.7%) — still positive but reduced

**Success Criteria:** ✅ Improved
- ✅ No single upgrade >15% impact except mage Vitality (expected/thematic)
- ✅ Precision now registers across all 6 classes (was negligible/positive)
- ✅ All 6 upgrades register negatively for mage (was 5 of 6)
- ✅ Swiftness meaningful for ranger (-7.0%) and mage (-3.0%)
- ⚠️ Warrior compressed — all upgrades <1% impact at 49.2 baseline
- ⚠️ Ranger Reflexes positive anomaly persists (+0.7%)

---

## Cross-Class Race Testing

```bash
# All races × 3 archetype classes (matrix mode, single pool)
pnpm diagnose matrix --classes=warrior,mage,ranger --races=all --runs=50 --turns=50000 --seed=1000
```

### Cross-Class × Race @ `62bddb9` (50 runs, 50k turns, seed=1000, upgrades=full)

*Changes from previous: Mage hitdie 0→1, Half-Elf CON -1→0 + new abilities (Quick Learner +5% XP, Elven Reflexes +2 evasion), Elf Swift Feet +3→+5 speed.*

| Class | Race | Avg Depth | Max Depth | CB Rate | Kills | Morgoth | Turns |
|-------|------|-----------|-----------|---------|-------|---------|-------|
| **Ranger** | **High_elf** | 49.7 | 50 | 0% | 685 | 4 | 20680 |
| **Ranger** | **Hobbit** | 49.4 | 50 | 0% | 677 | 6 | 20286 |
| **Ranger** | **Kobold** | 49.3 | 50 | 2% | 679 | 3 | 20580 |
| **Mage** | **Dunadan** | 48.8 | 50 | 2% | 677 | 2 | 31672 |
| **Ranger** | **Half_orc** | 48.8 | 50 | 0% | 657 | 2 | 22291 |
| **Mage** | **Gnome** | 48.3 | 50 | 0% | 654 | 2 | 28000 |
| **Ranger** | **Gnome** | 48.3 | 50 | 2% | 673 | 2 | 19843 |
| **Ranger** | **Half_elf** | 48.3 | 50 | 0% | 642 | 1 | 21031 |
| **Ranger** | **Dunadan** | 48.2 | 50 | 0% | 651 | 1 | 22639 |
| **Mage** | **Dwarf** | 48.0 | 50 | 0% | 648 | 0 | 27891 |
| **Ranger** | **Dwarf** | 48.0 | 50 | 0% | 669 | 3 | 22318 |
| **Mage** | **Human** | 47.9 | 50 | 0% | 640 | 1 | 29020 |
| **Ranger** | **Elf** | 47.7 | 50 | 0% | 650 | 1 | 21218 |
| **Ranger** | **Half_troll** | 47.6 | 50 | 0% | 654 | 0 | 21127 |
| **Mage** | **Kobold** | 47.6 | 50 | 0% | 640 | 2 | 28207 |
| **Warrior** | **Dunadan** | 47.5 | 50 | 0% | 515 | 2 | 16288 |
| **Mage** | **Hobbit** | 47.5 | 50 | 2% | 638 | 0 | 27009 |
| **Warrior** | **Half_orc** | 47.4 | 50 | 0% | 519 | 2 | 15353 |
| **Mage** | **Half_orc** | 47.1 | 50 | 0% | 638 | 1 | 27194 |
| **Warrior** | **Kobold** | 46.9 | 50 | 0% | 515 | 0 | 14972 |
| **Warrior** | **Half_troll** | 46.5 | 50 | 0% | 510 | 2 | 15123 |
| **Ranger** | **Human** | 46.4 | 50 | 0% | 597 | 0 | 21261 |
| **Warrior** | **High_elf** | 45.9 | 50 | 0% | 496 | 0 | 14594 |
| **Mage** | **High_elf** | 45.8 | 50 | 4% | 629 | 1 | 27852 |
| **Warrior** | **Gnome** | 45.8 | 50 | 0% | 491 | 0 | 14804 |
| **Warrior** | **Dwarf** | 45.1 | 50 | 0% | 496 | 1 | 14480 |
| **Warrior** | **Elf** | 44.5 | 50 | 0% | 470 | 1 | 14583 |
| **Warrior** | **Half_elf** | 44.5 | 50 | 0% | 471 | 0 | 15055 |
| **Mage** | **Elf** | 44.3 | 50 | 4% | 589 | 0 | 25403 |
| **Warrior** | **Human** | 43.9 | 50 | 0% | 450 | 0 | 14447 |
| **Mage** | **Half_troll** | 43.4 | 50 | 0% | 573 | 0 | 25140 |
| **Warrior** | **Hobbit** | 43.4 | 50 | 0% | 457 | 2 | 14638 |
| **Mage** | **Half_elf** | 43.0 | 50 | 2% | 570 | 1 | 25229 |

Runtime: 486s (33 cells, 1650 total runs, 20 threads).

### Per-Class Summary

| Class | Avg Depth | Range | Morgoth | CB Max |
|-------|-----------|-------|---------|--------|
| **Ranger** | 48.3 | 46.4–49.7 | 23 | 2% |
| **Mage** | 46.5 | 43.0–48.8 | 10 | 4% |
| **Warrior** | 45.5 | 43.4–47.5 | 10 | 0% |

**Ranger** is the strongest archetype across all races — tight clustering, high Morgoth kills. **Mage** improved significantly (avg 45.3→46.5, range narrowed from 10→5.8 depth gap). **Warrior** is consistent (all 0% CB) but lower ceiling.

### Race Rankings (averaged across 3 classes)

| Race | Avg Depth | Best Class | Worst Class |
|------|-----------|------------|-------------|
| Dunadan | 48.2 | Mage 48.8 | Warrior 47.5 |
| Half-Orc | 47.8 | Ranger 48.8 | Warrior 47.4 |
| Kobold | 47.9 | Ranger 49.3 | Warrior 46.9 |
| Gnome | 47.5 | Mage 48.3 | Warrior 45.8 |
| Dwarf | 47.0 | Ranger 48.0 | Warrior 45.1 |
| High-Elf | 47.1 | Ranger 49.7 | Warrior 45.9 |
| Hobbit | 46.8 | Ranger 49.4 | Warrior 43.4 |
| Half-Troll | 45.8 | Ranger 47.6 | Mage 43.4 |
| Half-Elf | 45.3 | Ranger 48.3 | Mage 43.0 |
| Human | 46.1 | Mage 47.9 | Warrior 43.9 |
| Elf | 45.5 | Ranger 47.7 | Mage 44.3 |

### Observations

- **Ranger dominates**: 10 of top 12 slots. High-Elf Ranger (49.7, 4 Morgoth) and Hobbit Ranger (49.4, 6 Morgoth) are the strongest combos in the game
- **Ranger/Human is surprisingly weak**: 46.4 avg, worst ranger by 1.3 depth — human's "average at everything" doesn't help ranger's DEX-favoring kit
- **Mage race sensitivity reduced**: 5.8 depth gap (was 10.0) between best (Dunadan 48.8) and worst (Half-Elf 43.0). Hitdie bump helps all races
- **Mage/Half-Elf fixed**: 43.0 (was 38.3), now -10.2% vs Mage/Human (was -19.4%). No longer a trap — CON 0, Quick Learner +5% XP, Elven Reflexes +2 evasion all contribute
- **Mage/Elf fixed**: 44.3 (was 41.4), now -7.5% vs Mage/Human (was -12.8%). Swift Feet +5 speed compensates for low CON
- **Warrior Elf/Half-Elf improved**: Both now 44.5 (were 43.3/45.2). Elf speed buff helps warrior too
- **Warrior is race-insensitive**: 4.1 depth spread (43.4–47.5), all 0% CB
- **43 Morgoth kills total**: Ranger accounts for 23 (53%). Hobbit Ranger leads with 6 kills in 50 runs

### Success Criteria: ✅ Passed

- ✅ No race/class combo >10% better than human/same-class (max: Ranger/High-Elf +7.1% vs Ranger/Human)
- ✅ Mage/Half-Elf -10.2% vs Mage/Human (was -19.4%, threshold: 15%) — **fixed**
- ✅ Mage/Elf -7.5% vs Mage/Human (was -12.8%) — **fixed**
- ✅ All warrior combos viable (43.4+ avg depth)
- ✅ All ranger combos viable (46.4+ avg depth)
- ✅ CB rates ≤4% across all combos

**Remaining items:**
- Ranger/Human underperformance (46.4, worst ranger) — human's neutral stats miss a breakpoint that other races hit
- Mage/Half-Troll (43.4) and Mage/Half-Elf (43.0) are the weakest mage combos — intentional weakness (low INT/CON respectively)

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
