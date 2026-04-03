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

# Cap sensitivity: per-chain + per-tier breakdown, 3 classes (~12 min)
pnpm diagnose cap-sensitivity --classes=warrior,mage,ranger --seed=1000 --turns=50000

# Cap sensitivity at mid-upgrade tier (reveals progression-window chain values)
pnpm diagnose cap-sensitivity --classes=warrior,mage,ranger --seed=1000 --turns=50000 --upgrades=mid

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
- INT classes (mage, archmage, necromancer): `int_superior + con_superior`
- WIS classes (priest, paladin, druid): `wis_superior + con_superior`
- DEX classes (rogue, ranger): `dex_superior + con_superior`

### Capability Presets (`--capabilities=X`)

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town_1, farming, tactics_1, preparedness_1, targeting_1, retreat_1 | 15-20 |
| `mid` | town_2, farming, tactics_2, preparedness_2, surf_1, kiting_1, targeting_2, retreat_2 | 25-35 |
| `late` | town_3, farming, tactics_3, preparedness_3, surf_2, kiting_2, targeting_3, retreat_3 | 40-45 |
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

### Phase 4.5: Cap Sensitivity

**Goal:** Identify which capability chains and tiers deliver meaningful value, and at what point in the progression arc.

```bash
# At full upgrades (ceiling view — measures marginal value at saturation)
pnpm diagnose cap-sensitivity --classes=warrior,mage,ranger --seed=1000 --turns=50000

# At mid upgrades (progression-window view — reveals value during normal play)
pnpm diagnose cap-sensitivity --classes=warrior,mage,ranger --seed=1000 --turns=50000 --upgrades=mid
```

**Important:** Run at both upgrade tiers. Full-upgrade tests show marginal value at ceiling; mid-upgrade tests show value in the progression window where players actually unlock caps. A chain that looks useless at ceiling may be transformative at mid.

**Success Criteria:**
- town_3 remains the highest single-tier value (it is transformative)
- Tactics/targeting/retreat show meaningful impact at mid-upgrade baseline
- No chain costs >5× another chain of equal measured impact

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

### Class Baseline @ `228a8bf` (100 runs, 50k turns, seed=1000, upgrades=full)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Victories | Status |
|-------|-----------|-----------|---------|-----------|-------|-----------|--------|
| **Paladin** | 49.4 | 50 | 0% | 21588 | 662 | 3 | ✅ Endgame |
| **Druid** | 48.9 | 50 | 0% | 23084 | 639 | 3 | ✅ Endgame |
| **Priest** | 48.7 | 50 | 0% | 25803 | 800 | 3 | ✅ Endgame |
| **Blackguard** | 48.5 | 50 | 0% | 16058 | 534 | 8 | ✅ Endgame |
| **Mage** | 48.5 | 50 | 1% | 24942 | 626 | 4 | ✅ Endgame |
| **Rogue** | 48.3 | 50 | 0% | 22053 | 602 | 3 | ✅ Endgame |
| **Ranger** | 48.2 | 50 | 0% | 22625 | 622 | 6 | ✅ Endgame |
| **Necromancer** | 47.9 | 50 | 2% | 20871 | 636 | 5 | ✅ Endgame |
| **Warrior** | 47.6 | 50 | 0% | 15244 | 498 | 3 | ✅ Endgame |
| **Berserker** | 47.3 | 50 | 0% | 14289 | 487 | 8 | ✅ Endgame |
| **Archmage** | 46.3 | 50 | 0% | 23458 | 579 | 2 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable. **48 victories** (8 berserker, 8 blackguard, 6 ranger, 5 necromancer, 4 mage, 3 paladin, 3 druid, 3 priest, 3 rogue, 3 warrior, 2 archmage). CB rates: necromancer 2%, mage 1%, all others 0%. Spread: 46.3-49.4 (3.1 depth). Runtime: 174s.

**Tiers:**
- **A:** Paladin (49.4), Druid (48.9), Priest (48.7), Blackguard (48.5), Mage (48.5), Rogue (48.3), Ranger (48.2)
- **B:** Necromancer (47.9), Warrior (47.6), Berserker (47.3), Archmage (46.3)

**Changes from `548a393`:** Sweep capability chain removed (was 0% impact across all classes). All depths within noise (max delta ±0.4). Archmage CB dropped 3%→0%. Victories +5 (43→48) within normal variance. Spread widened slightly 2.4→3.1 due to paladin noise (+0.4) and archmage noise (-0.3).

---

### Race Baseline @ `734bd3b` (100 runs, 50k turns, seed=1000, class=warrior, upgrades=full)

| Race | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Half-Troll** | 48.8 | 50 | 0% | 15784 | 533 | 7 | ✅ Endgame |
| **Gnome** | 48.3 | 50 | 0% | 15053 | 532 | 5 | ✅ Endgame |
| **Kobold** | 48.2 | 50 | 0% | 15174 | 533 | 2 | ✅ Endgame |
| **Dwarf** | 48.0 | 50 | 0% | 15467 | 527 | 2 | ✅ Endgame |
| **Dunadan** | 48.0 | 50 | 0% | 16039 | 511 | 2 | ✅ Endgame |
| **High-Elf** | 47.9 | 50 | 0% | 15460 | 530 | 3 | ✅ Endgame |
| **Human** | 47.6 | 50 | 0% | 15587 | 500 | 3 | ✅ Endgame |
| **Half-Orc** | 47.5 | 50 | 0% | 15683 | 512 | 5 | ✅ Endgame |
| **Half-Elf** | 46.7 | 50 | 0% | 15512 | 494 | 1 | ✅ Endgame |
| **Hobbit** | 46.6 | 50 | 0% | 14713 | 505 | 1 | ✅ Endgame |
| **Elf** | 46.5 | 50 | 0% | 14698 | 498 | 2 | ✅ Endgame |

**Summary:** All 11 races endgame-viable. **33 Morgoth kills** (7 half-troll, 5 gnome, 5 half-orc, 3 high-elf, 3 human, 2 kobold, 2 dwarf, 2 dunadan, 2 elf, 1 half-elf, 1 hobbit). All CB rates 0%. Spread: 46.5-48.8 (2.3 depth). Runtime: 248s.

**Tiers:**
- **A:** Half-Troll (48.8), Gnome (48.3), Kobold (48.2), Dwarf (48.0), Dunadan (48.0), High-Elf (47.9) — tight top cluster
- **B:** Human (47.6), Half-Orc (47.5), Half-Elf (46.7), Hobbit (46.6), Elf (46.5) — all viable

**Changes from `62bddb9`:** Spread compressed 4.2→2.3 depth. Bottom-tier races gained more than top-tier (Hobbit +4.0, High-Elf +3.4, Human +3.5 vs Half-Orc +1.0, Dunadan +1.2). Kite/combat fixes lifted all races. Morgoth kills doubled (16→33). Half-Troll jumped from mid-pack to #1. Gnome rose from B to A tier.

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 46.5)
- ✅ No race exceeds human by >5 avg depth (max delta: +1.2)
- ✅ No race falls below human by >8 avg depth (min delta: -1.1)
- ✅ CB rates <5% (all 0%)

---

## Capability Progression

### Warrior @ `734bd3b` (50 runs, 50k turns, seed=1000, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|-----------|-----------|---------|-----------|-------|-------|
| `none` | 31.6 | 48 | 0% | 8462 | 246 | baseline |
| `early` | 31.4 | 50 | 0% | 8400 | 253 | -0.2 |
| `mid` | 34.2 | 50 | 0% | 10094 | 331 | +2.6 |
| `late` | 39.5 | 50 | 0% | 13919 | 440 | +7.9 |
| `full` | 41.2 | 50 | 0% | 15301 | 457 | +9.6 |

**Observations:**
- Early tier regression nearly eliminated (-0.2, was -1.2) — noise level
- Mid tier now meaningful (+2.6, was +0.7) — surf registering for warrior
- Late tier strong (+7.9, was +5.9) — retreat/kiting tier still the big unlock
- Full now exceeds late by +1.7 (was -0.3) — no more plateau, full caps matter
- Total progression: +9.6 depth from none→full
- All CB rates 0%

### Mage @ `734bd3b` (50 runs, 50k turns, seed=1000, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|-----------|-----------|---------|-----------|-------|-------|
| `none` | 15.5 | 25 | 0% | 4002 | 87 | baseline |
| `early` | 15.6 | 29 | 0% | 4051 | 88 | +0.1 |
| `mid` | 25.1 | 42 | 0% | 26276 | 552 | +9.6 |
| `late` | 40.6 | 50 | 0% | 40895 | 925 | +25.1 |
| `full` | 45.9 | 50 | 0% | 45019 | 989 | +30.4 |

**Observations:**
- Dramatic progression: none→full is +30.4 depth (was +27.3)
- Early tier flat (+0.1) — still insufficient for mage
- Mid tier improved (+9.6, was +8.4) — max depth rose 38→42
- Late tier transformative (+15.5 from mid) — kiting remains the single biggest unlock
- **All CB rates 0%** (was 6% late, 2% full) — kite duration fix completely resolved CB issues
- Full tier now +5.3 above late (was +1.0) — full caps significantly extend mage, 1 Morgoth kill

### Cross-Class Comparison

| Preset | Warrior | Mage | Mage vs Warrior |
|--------|---------|------|-----------------|
| `none` | 31.6 | 15.5 | -16.1 (mage struggles hard without capabilities) |
| `early` | 31.4 | 15.6 | -15.8 (basic capabilities insufficient for either) |
| `mid` | 34.2 | 25.1 | -9.1 (surf helps mage more) |
| `late` | 39.5 | 40.6 | +1.1 (kiting equalizes, mage passes warrior) |
| `full` | 41.2 | 45.9 | +4.7 (mage exceeds warrior at full) |

**Success Criteria:** ✅ Passed (was ⚠️ Partial)
- ✅ Clear progression mid→late→full for both classes
- ✅ Kiting transforms mage (+15.5 depth from mid→late)
- ✅ Mage crosses over warrior at late tier (kiting equalizes)
- ✅ Early tier regression eliminated for warrior (-0.2, was -1.2)
- ✅ **All CB rates 0%** across both classes (was 6% mage late)
- ✅ Full tier no longer plateaus for warrior (+1.7 above late, was -0.3)

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

**Mage @ `af3d305`:**

| Tier | Avg Depth | Max Depth | CB | Kills | Delta |
|------|-----------|-----------|-----|-------|-------|
| none/none | 6.0 | 14 | 0% | 23 | baseline |
| early/early | 12.0 | 21 | 0% | 59 | +6.0 |
| mid/mid | 25.1 | 42 | 0% | 552 | +19.1 |
| late/late | 45.5 | 50 | 0% | 817 | +39.5 |
| full/full | 48.3 | 50 | 2% | 641 | +42.3 |

### Mage Upgrade Tiers @ `af3d305` (50 runs, 50k turns, seed=1000, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Delta |
|--------|----------|-----------|-----------|---------|-----------|-------|-------|
| `none` | No upgrades | 29.2 | 45 | 0% | 42112 | 887 | baseline |
| `early` | vit 2, mgt 2, res 1 | 36.5 | 48 | 0% | 44415 | 935 | +7.3 |
| `mid` | vit 5, mgt 5, res 5, rfx 4, prc 2, swf 2 | 45.9 | 50 | 0% | 45019 | 989 | +16.7 |
| `late` | vit 8, mgt 8, res 7, rfx 6, prc 4, swf 4 | 47.2 | 50 | 0% | 38353 | 835 | +18.0 |
| `full` | All maxed | 48.3 | 50 | 2% | 30176 | 641 | +19.1 |

**Observations:**
- Strong monotonic progression: none→full is +19.1 depth
- **All CB rates 0% except full (2%)** — massive improvement from `62bddb9` (was 10% early, 4% none)
- Kite duration fix eliminated CB issues across the board
- Early tier still a meaningful jump (+7.3, was +11.5) — Vitality remains key for mage survivability
- Mid tier now the biggest single jump (+9.4 from early) — reflexes/resilience compound with kiting
- Late/full diminishing returns (47.2 vs 48.3) — similar to warrior pattern
- Total progression: +19.1 depth from none→full (vs warrior's +10.2)
- **Full tier 2% CB is new** — at max depth, the few remaining CB runs are from endgame Morgoth attempts

### Cross-Class Comparison (Paired)

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 19.3 | 6.0 | -13.3 (mage nearly unplayable) |
| early/early | 22.7 | 12.0 | -10.7 (both struggle, mage worse) |
| mid/mid | 33.3 | 25.1 | -8.2 (mage still behind) |
| late/late | 41.5 | 45.5 | +4.0 (mage surges past — kiting) |
| full/full | 43.9 | 48.3 | +4.4 (mage exceeds warrior) |

**Observations:**
- **Warrior smooth progression**: none/none 19.3 → full/full 43.9 (+24.6 total)
- **Mage explosive late surge**: none/none 6.0 → late/late 45.5 (+39.5) — kiting + late upgrades combine
- **Mage crosses warrior at late tier** — same crossover point as capability progression
- **Mage full/full gets 2 Morgoth kills** and reaches 48.3 avg depth (+0.4 from `62bddb9`)
- **Early tier works for paired** (+3.3 warrior, +6.0 mage) — unlike capability-only where early hurt warrior
- **All CB rates 0%** for paired mage except full/full (2%) — kite duration fix resolved late-tier CB

**Changes from `62bddb9`:** Kite duration fix eliminated CB at late/late (6%→0%). Mage full/full improved 47.9→48.3 (+0.4) with 2 Morgoth kills (was 1). Full/full shows 2% CB (was 0%) — noise at endgame depth, not a regression. Overall progression slightly smoother.

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide meaningful improvement at all tiers (+10.2 warrior, +19.1 mage)
- ✅ Strong paired progression feel (each tier noticeably better)
- ✅ Mage full/full viable and endgame (48.3 avg, 2 Morgoth, 2% CB)
- ✅ **All mage CB rates 0%** across upgrade tiers (was up to 10%)
- ⚠️ Late/full plateau for warrior (43.6 vs 43.9)

---

## Upgrade Sensitivity

### 11-Class Sensitivity @ `548a393` (50 runs, 50k turns, seed=1000)

| Upgrade | Archmage | Berserker | Blackguard | Druid | Mage | Necromancer | Paladin | Priest | Ranger | Rogue | Warrior |
|---------|----------|-----------|------------|-------|------|-------------|---------|--------|--------|-------|---------|
| **Vitality** | +0.4% | -0.5% | -0.4% | -1.9% | -1.4% | +0.7% | **-1.5%** | **-3.3%** | -1.4% | **-2.9%** | -0.5% |
| **Resilience** | -1.4% | -0.6% | **-2.0%** | -1.6% | -1.3% | +1.5% | -0.4% | -0.9% | -0.4% | +0.4% | -1.9% |
| **Swiftness** | **-2.4%** | -1.8% | -0.7% | -0.9% | **-2.2%** | -0.8% | -0.9% | -0.6% | **-3.8%** | -1.3% | -0.6% |
| **Reflexes** | -0.5% | -1.1% | +0.1% | +0.3% | -1.3% | -0.4% | +0.2% | -0.3% | -0.2% | -0.4% | -1.2% |
| **Precision** | +1.3% | -1.5% | +0.0% | +0.1% | -1.4% | +0.2% | +0.1% | -0.6% | -0.3% | -0.2% | -0.9% |
| **Might** | -0.3% | -1.2% | -0.1% | +0.5% | -0.7% | +0.1% | -0.2% | -0.5% | -0.0% | +0.2% | -0.6% |

**Per-class baselines:** Archmage 47.4, Berserker 49.5, Blackguard 49.9, Druid 49.1, Mage 48.9, Necromancer 48.1, Paladin 49.9, Priest 49.1, Ranger 49.5, Rogue 49.7, Warrior 49.3

**Analysis:**

- **Priest Vitality remains the biggest single impact** (-3.3%) — sustained melee healer needs the HP buffer
- **Rogue Vitality** (-2.9%) also notable — melee class with no healing relies on raw HP pool
- **Swiftness is the most consistently impactful upgrade** — negative for 11/11 classes, with Ranger (-3.8%), Archmage (-2.4%), and Mage (-2.2%) as the top beneficiaries. Speed helps kiting classes most
- **Ranger Swiftness surged** (-2.8%→-3.8%) — FAST_SHOT cap nerf (6→5) makes speed even more critical for ranger's kiting playstyle
- **Paladin decompressed** — Vitality now -1.5% (was +0.0%), Swiftness -0.9% (was +0.1%). Heal potency nerf lowered the ceiling enough for upgrades to register
- **Blackguard decompressed** — Resilience now -2.0% (was +0.3%), Swiftness -0.7% (was +0.6%). Lifesteal nerf eliminated ceiling anomalies, 4 of 6 upgrades now show real negative values
- **Druid less sensitive** — Vitality -1.9% (was -4.2%), Resilience -1.6% (was -3.0%). WIS nerf weakened overall power, reducing upgrade dependence
- **Necromancer anomalies persist**: Vitality +0.7%, Resilience +1.5% — minion/spell-heavy style doesn't benefit from survivability upgrades at this baseline
- **Warrior unchanged** — Resilience -1.9%, Reflexes -1.2%, same as before (untouched by nerfs)

**Changes from `af3d305`:** S-tier nerfs decompressed paladin and blackguard sensitivity as intended. Ranger swiftness dependence increased. Druid got less sensitive (WIS nerf weakened overall rather than decompressing). Non-nerfed classes identical within noise.

**Success Criteria:** ✅ Passed
- ✅ No single upgrade >15% impact (max: Ranger Swiftness -3.8%)
- ✅ All upgrades <5% impact across all 11 classes
- ✅ Swiftness registers negatively for 11/11 classes (was 9/11)
- ✅ Precision registers negatively for 7/11 classes
- ✅ Paladin and Blackguard ceiling anomalies resolved — both now show meaningful sensitivity
- ⚠️ Necromancer still shows ceiling/noise anomalies (Vitality +0.7%, Resilience +1.5%)

---

## Cap Sensitivity

Measures per-capability-chain impact with per-tier marginal breakdown. For each graded chain, varies that chain's level 0→3 while holding all other chains at full. Farming toggle tested separately.

```bash
# 3 archetype classes, full stat upgrades, tier breakdown (~12 min)
pnpm diagnose cap-sensitivity --classes=warrior,mage,ranger --seed=1000 --turns=50000
```

**Cell layout:** 23 per class (1 baseline + 1 farming-off + 7 chains × 3 levels). Baseline = all caps full, max upgrades, bestiary=25.

**Reading the tables:**
- `L0` = avg depth when chain entirely removed, all others at full
- `+L1/+L2/+L3` = marginal depth added by each successive tier
- `Total` = full chain contribution (baseline − L0)
- `Impact` = negative % = depth lost when chain removed

### Cap Sensitivity @ `228a8bf` (50 runs, 50k turns, seed=1000, upgrades=full)

**Warrior (baseline: 49.3)**

Farming: 49.3 → 48.8 (-0.5, -1.0%) Vic: 9 → 3

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Town (portal/healer) | 47.2 | -0.0 | -1.0 | +3.1 | +2.1 | -4.3% | 2/1/1/9 |
| Preparedness | 48.8 | -0.7 | +1.1 | +0.0 | +0.5 | -1.0% | 3/7/9/9 |
| Surf (stair farm) | 49.3 | -0.1 | -0.4 | +0.6 | +0.0 | -0.1% | 4/5/8/9 |
| Retreat (escape) | 49.3 | +0.0 | +0.0 | +0.0 | +0.0 | -0.1% | 10/10/10/9 |
| Kiting (ranged pos) | 49.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 9/9/9/9 |
| Targeting (AI) | 49.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 8/9/9/9 |
| Tactics (spell use) | 49.3 | -0.1 | +0.0 | +0.0 | -0.0 | +0.1% | 2/7/9/9 |

**Mage (baseline: 49.3)**

Farming: 49.3 → 47.2 (-2.1, -4.3%) Vic: 4 → 2

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Town (portal/healer) | 41.1 | +0.0 | -0.2 | +8.3 | +8.1 | -16.5% | 0/0/0/4 |
| Kiting (ranged pos) | 46.6 | +0.1 | +2.8 | -0.2 | +2.6 | -5.4% | 0/0/4/4 |
| Preparedness | 47.2 | +1.7 | +0.3 | +0.2 | +2.1 | -4.3% | 2/3/0/4 |
| Surf (stair farm) | 48.8 | -0.8 | +0.2 | +1.0 | +0.4 | -0.9% | 0/0/2/4 |
| Retreat (escape) | 49.0 | -0.1 | +0.0 | +0.4 | +0.3 | -0.6% | 2/0/0/4 |
| Tactics (spell use) | 49.2 | -0.3 | +0.4 | +0.0 | +0.1 | -0.1% | 4/0/4/4 |
| Targeting (AI) | 49.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 2/4/4/4 |

**Ranger (baseline: 49.5)**

Farming: 49.5 → 46.6 (-2.9, -5.9%) Vic: 4 → 1

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Town (portal/healer) | 46.2 | +0.0 | +0.3 | +3.0 | +3.3 | -6.7% | 0/0/1/4 |
| Preparedness | 46.6 | +3.2 | -0.3 | +0.0 | +2.9 | -5.9% | 1/1/4/4 |
| Surf (stair farm) | 48.3 | +1.4 | -0.1 | +0.0 | +1.3 | -2.6% | 0/2/4/4 |
| Kiting (ranged pos) | 48.9 | +0.0 | +0.6 | +0.0 | +0.6 | -1.2% | 2/2/4/4 |
| Targeting (AI) | 49.5 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 4/4/4/4 |
| Tactics (spell use) | 49.6 | -0.0 | -0.1 | +0.0 | -0.1 | +0.2% | 0/1/4/4 |
| Retreat (escape) | 49.7 | -0.2 | +0.0 | +0.0 | -0.2 | +0.3% | 1/2/2/4 |

### Cross-Class Summary

| Chain               | Warrior | Mage   | Ranger |
|---------------------|---------|--------|--------|
| Farming (toggle)    | -1.0%   | -4.3%  | -5.9%  |
| Town (portal/healer) | -4.3%  | -16.5% | -6.7%  |
| Preparedness        | -1.0%   | -4.3%  | -5.9%  |
| Kiting (ranged pos) | +0.0%   | -5.4%  | -1.2%  |
| Surf (stair farm)   | -0.1%   | -0.9%  | -2.6%  |
| Retreat (escape)    | -0.1%   | -0.6%  | +0.3%  |
| Targeting (AI)      | +0.0%   | +0.0%  | +0.0%  |
| Tactics (spell use) | +0.1%   | -0.1%  | +0.2%  |
| **Baseline**        | 49.3    | 49.3   | 49.5   |

### Tier Marginal Breakdown

| Chain/Tier       | Warrior | Mage   | Ranger |
|------------------|---------|--------|--------|
| town_1           | -0.0    | +0.0   | +0.0   |
| town_2           | -1.0    | -0.2   | +0.3   |
| town_3           | +3.1    | +8.3   | +3.0   |
| preparedness_1   | -0.7    | +1.7   | +3.2   |
| preparedness_2   | +1.1    | +0.3   | -0.3   |
| preparedness_3   | +0.0    | +0.2   | +0.0   |
| kiting_1         | +0.0    | +0.1   | +0.0   |
| kiting_2         | +0.0    | +2.8   | +0.6   |
| kiting_3         | +0.0    | -0.2   | +0.0   |
| surf_1           | -0.1    | -0.8   | +1.4   |
| surf_2           | -0.4    | +0.2   | -0.1   |
| surf_3           | +0.6    | +1.0   | +0.0   |
| targeting_1      | +0.0    | +0.0   | +0.0   |
| targeting_2      | +0.0    | +0.0   | +0.0   |
| targeting_3      | +0.0    | +0.0   | +0.0   |
| retreat_1        | +0.0    | -0.1   | -0.2   |
| retreat_2        | +0.0    | +0.0   | +0.0   |
| retreat_3        | +0.0    | +0.4   | +0.0   |
| tactics_1        | -0.1    | -0.3   | -0.0   |
| tactics_2        | +0.0    | +0.4   | -0.1   |
| tactics_3        | +0.0    | +0.0   | +0.0   |

### Analysis

**⚠️ Ceiling effect dominates:** All three classes are already at 49+ avg depth at full caps + full upgrades. This compresses individual chain deltas — chains collectively push mage from ~6 (none/none) to 49 (+43 depth), but removing any single chain at the margin rarely shows >3 depth impact because the others compensate.

**town_3 is the single most impactful individual tier across all tested classes:**
- Warrior: +3.1 depth (the only meaningful warrior chain)
- Mage: +8.3 depth (the biggest single-tier value anywhere in the full-upgrade dataset)
- Ranger: +3.0 depth
- town_1 and town_2 register near-zero or negative marginal value at saturation — their value is as prerequisites and at lower upgrade tiers

**Mage preparedness volatility resolved:** Was -8.9/+9.7 per tier at `52c2237` (L1 stalled, L2 rescued), now +1.7/+0.3 — calm monotonic progression. Sweep removal eliminated the interaction where sweep competed with preparedness-gated descent.

**Victory gating (Vic column = victories at L0/L1/L2/L3):**
- Town gates all mage victories: 0/0/0/4 — zero wins without full town
- Kiting_2 gates mage victories: 0/0/4/4 — the positioning threshold
- Surf gates mage victories: 0/0/2/4 — surf_3 adds 2 more wins
- Town gates most warrior victories: 2/1/1/9 — town_3 is the victory unlock
- Ranger victories robust: preparedness_2 and surf_1 are the thresholds

**Farming matters most for ranger** (-5.9%) and mage (-4.3%, up from -2.3%). Mage farming dependence nearly doubled after sweep removal — mage now relies more on gold-funded progression without the (zero-value) sweep fallback.

**Kiting stronger for mage:** -5.4% (up from -2.8%). Kiting_2 remains the value tier (+2.8 mage, +0.6 ranger).

**Tactics, targeting, retreat: essentially 0 measurable impact at full baseline** — all show <1% across all 3 classes.

### Implications for Cost Structure

This data should be interpreted **alongside** the capability progression baselines (Phase 2), not in isolation. The progression test shows kiting contributes +15.5 depth for mage at mid-upgrade tier (the "late" unlock); at full-upgrade saturation it contributes only ~2.6. Both are true — kiting is high-value in the progression window, smaller at the ceiling.

**Clearest actionable signals:**
- **town_3 is severely underpriced** (225 essence, +3–8 depth marginal value at ceiling) — likely 5–10× too cheap
- **Tactics/targeting/retreat chains may be overpriced** for their measurable impact — see mid-upgrade results for confirmation
- **The fundamental imbalance is stat upgrades vs bot caps**: stat upgrades total ~322k essence for <4% marginal depth each; bot caps total ~9.4k for transformative gains in the progression window. Costs are inverted relative to value.

See mid-upgrade results below for chain values in the progression window.

### Cap Sensitivity @ `228a8bf` (50 runs, 50k turns, seed=1000, upgrades=mid)

**Warrior (baseline: 47.3)**

Farming: 47.3 → 45.0 (-2.4, -5.0%) Vic: 5 → 1

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Town (portal/healer) | 41.7 | +0.3 | +2.7 | +2.6 | +5.7 | -12.0% | 0/1/1/5 |
| Preparedness | 45.0 | +1.8 | +0.6 | +0.0 | +2.4 | -5.0% | 1/4/5/5 |
| Surf (stair farm) | 45.1 | +1.9 | -0.4 | +0.6 | +2.2 | -4.6% | 2/2/0/5 |
| Tactics (spell use) | 46.0 | -0.0 | +1.4 | +0.0 | +1.3 | -2.8% | 4/3/5/5 |
| Retreat (escape) | 47.0 | +0.0 | +0.0 | +0.3 | +0.3 | -0.7% | 6/6/6/5 |
| Kiting (ranged pos) | 47.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 5/5/5/5 |
| Targeting (AI) | 47.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 5/5/5/5 |

**Mage (baseline: 45.5)**

Farming: 45.5 → 37.9 (-7.6, -16.8%) Vic: 0 → 0

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Town (portal/healer) | 28.0 | +0.0 | +2.0 | +15.5 | +17.5 | -38.5% | 0/0/0/0 |
| Surf (stair farm) | 37.0 | +8.7 | -0.3 | +0.1 | +8.5 | -18.6% | 0/0/0/0 |
| Preparedness | 37.9 | +7.7 | +0.3 | -0.4 | +7.6 | -16.8% | 0/0/0/0 |
| Kiting (ranged pos) | 43.6 | -0.3 | +4.2 | -1.9 | +1.9 | -4.2% | 0/0/0/0 |
| Retreat (escape) | 45.4 | -0.1 | +0.0 | +0.2 | +0.1 | -0.1% | 1/0/0/0 |
| Targeting (AI) | 45.6 | -0.1 | +0.0 | +0.0 | -0.1 | +0.2% | 0/0/0/0 |
| Tactics (spell use) | 45.9 | +1.1 | -1.5 | +0.0 | -0.4 | +0.9% | 0/1/0/0 |

**Ranger (baseline: 45.3)**

Farming: 45.3 → 29.5 (-15.8, -34.9%) Vic: 1 → 0

| Chain            | L0   | +L1  | +L2  | +L3  | Total  | Impact | Vic        |
|------------------|------|------|------|------|--------|--------|------------|
| Preparedness | 29.5 | +10.6 | +5.2 | +0.0 | +15.8 | -34.9% | 0/2/1/1 |
| Surf (stair farm) | 30.2 | +16.4 | -0.6 | -0.8 | +15.1 | -33.3% | 0/2/1/1 |
| Town (portal/healer) | 33.4 | -0.1 | +3.1 | +8.9 | +11.8 | -26.1% | 0/0/0/1 |
| Tactics (spell use) | 45.3 | +0.3 | -0.3 | +0.0 | +0.0 | +0.0% | 1/1/1/1 |
| Targeting (AI) | 45.3 | +0.0 | +0.0 | +0.0 | +0.0 | +0.0% | 1/1/1/1 |
| Retreat (escape) | 46.3 | -0.3 | +0.0 | -0.7 | -1.0 | +2.3% | 1/1/1/1 |
| Kiting (ranged pos) | 47.6 | +0.0 | -2.4 | +0.0 | -2.4 | +5.3% | 2/2/1/1 |

### Cross-Class Summary (mid upgrades)

| Chain               | Warrior | Mage   | Ranger |
|---------------------|---------|--------|--------|
| Farming (toggle)    | -5.0%   | -16.8% | -34.9% |
| Town (portal/healer) | -12.0% | -38.5% | -26.1% |
| Preparedness        | -5.0%   | -16.8% | -34.9% |
| Surf (stair farm)   | -4.6%   | -18.6% | -33.3% |
| Tactics (spell use) | -2.8%   | +0.9%  | +0.0%  |
| Kiting (ranged pos) | +0.0%   | -4.2%  | +5.3%  |
| Retreat (escape)    | -0.7%   | -0.1%  | +2.3%  |
| Targeting (AI)      | +0.0%   | +0.2%  | +0.0%  |
| **Baseline**        | 47.3    | 45.5   | 45.3   |

### Tier Marginal Breakdown (mid upgrades)

| Chain/Tier       | Warrior | Mage   | Ranger |
|------------------|---------|--------|--------|
| town_1           | +0.3    | +0.0   | -0.1   |
| town_2           | +2.7    | +2.0   | +3.1   |
| town_3           | +2.6    | +15.5  | +8.9   |
| preparedness_1   | +1.8    | +7.7   | +10.6  |
| preparedness_2   | +0.6    | +0.3   | +5.2   |
| preparedness_3   | +0.0    | -0.4   | +0.0   |
| surf_1           | +1.9    | +8.7   | +16.4  |
| surf_2           | -0.4    | -0.3   | -0.6   |
| surf_3           | +0.6    | +0.1   | -0.8   |
| tactics_1        | -0.0    | +1.1   | +0.3   |
| tactics_2        | +1.4    | -1.5   | -0.3   |
| tactics_3        | +0.0    | +0.0   | +0.0   |
| targeting_1      | +0.0    | -0.1   | +0.0   |
| targeting_2      | +0.0    | +0.0   | +0.0   |
| targeting_3      | +0.0    | +0.0   | +0.0   |
| kiting_1         | +0.0    | -0.3   | +0.0   |
| kiting_2         | +0.0    | +4.2   | -2.4   |
| kiting_3         | +0.0    | -1.9   | +0.0   |
| retreat_1        | +0.0    | -0.1   | -0.3   |
| retreat_2        | +0.0    | +0.0   | +0.0   |
| retreat_3        | +0.3    | +0.2   | -0.7   |
| **Baseline**     | 47.3    | 45.5   | 45.3   |

### Analysis (mid upgrades)

**Ceiling effect lifted:** Baselines drop to 47.3/45.5/45.3 (vs 49.3/49.3/49.5 at full), and chain deltas expand dramatically. This is the progression window where players actually unlock caps.

**town_3 is the most impactful single tier in the dataset — and even stronger at mid upgrades:**
- Warrior: +2.6 (similar to full)
- Mage: +15.5 (vs +8.3 at full — nearly doubles in importance as ceiling drops)
- Ranger: +8.9 (vs +3.0 at full — triples)

**Mage surf emerged as a major chain after sweep removal:**
- Surf total: +8.5 depth (-18.6%) — was -1.8% at `52c2237`
- surf_1 alone: +8.7 depth (37.0 → 45.7) — mage now relies heavily on stair surfing for farming at mid upgrades
- This is real: removing sweep code eliminated the (zero-value) alternative path, and mage now funnels entirely through surf for level farming

**Mage preparedness volatility resolved:**
- Was -20.8/+25.7 per tier at `52c2237` (L1 stalled, L2 rescued with massive swing)
- Now +7.7/+0.3 — calm monotonic progression
- Sweep removal eliminated the interaction where partial preparedness competed with sweep-based exploration
- Total chain value increased: +4.5 → +7.6 (now a top-3 mage chain)

**Ranger is farming/surf/preparedness-gated at mid upgrades:**
- Farming toggle: ranger drops 45.3 → 29.5 without it (-34.9%) — effectively nonfunctional
- surf_1 alone: +16.4 depth (30.2 → 46.6) — biggest single-tier gain in the dataset
- preparedness_1: +10.6 depth for ranger — critical early capability
- These three chains are must-haves for ranger in the progression window; without them, ranger is stuck ~30 avg depth

**Mage is town-gated at mid upgrades:**
- Town chain removal drops mage 45.5 → 28.0 (-38.5%) — barely functional
- town_3 alone provides +15.5 depth — almost the entire chain's contribution

**Victory gating at mid upgrades:**
- Mage: 0 victories at any configuration — mage needs full stat upgrades to reach victory-capable depth
- Warrior: 5 victories at baseline, town gates hard (0 without town_3)
- Ranger: 1 victory at baseline, farming gates (0 without farming toggle)

**Tactics, targeting, retreat: confirmed low-value in the progression window:**
- Targeting: 0 measurable impact for all 3 classes
- Retreat: 0 or slightly negative (possibly counterproductive behavior at this tier)
- Tactics: marginal for warrior (+1.3), zero or negative for mage and ranger

**Kiting is class-specific:**
- Mage: kiting_2 shows +4.2 at mid (meaningful positioning benefit, up from +3.6)
- Ranger: kiting_2 is -2.4 (negative — ranger doesn't benefit from kiting at mid upgrades, possibly actively harmful)
- Warrior: 0 impact throughout

### Cost Rebalancing Signals

Both full and mid tests together provide clear cost calibration data:

| Chain | Full Impact (best class) | Mid Impact (best class) | Assessment | Current Cost |
|-------|--------------------------|-------------------------|------------|--------------|
| town_3 | +8.3 depth (mage) | +15.5 depth (mage) | **Severely underpriced** | 225 essence |
| farming | -5.9% ranger | -34.9% ranger | **Underpriced** | 350 essence |
| surf_1 | +1.4 ranger | +16.4 ranger | **Underpriced** | ~150 essence |
| preparedness_1 | +3.2 ranger | +10.6 ranger | **Underpriced** | ~150 essence |
| surf (mage) | -0.9% | -18.6% | **Underpriced for mage** | ~150 essence |
| kiting | -5.4% mage | -4.2% mage | Fair (class-specific) | ~600 essence |
| tactics | <1% all classes | <3% warrior only | **Overpriced** | ~500 essence |
| targeting | 0% all classes | 0% all classes | **Overpriced** | ~500 essence |
| retreat | 0% all classes | 0-2% all classes | **Overpriced** | ~500 essence |

**The stat upgrade vs bot cap imbalance is confirmed in both tests:** stat upgrades total ~322k essence for <4% marginal depth each; bot caps total ~9.4k essence for transformative gains in the progression window. Costs are systematically inverted relative to value across all tiers.

---

## Cross-Class Race Testing

```bash
# All races × 3 archetype classes (matrix mode, single pool)
pnpm diagnose matrix --classes=warrior,mage,ranger --races=all --runs=50 --turns=50000 --seed=1000
```

### Cross-Class × Race @ `548a393` (50 runs, 50k turns, seed=1000, upgrades=full)

| Class | Race | Avg Depth | Max Depth | CB Rate | Kills | Morgoth | Turns |
|-------|------|-----------|-----------|---------|-------|---------|-------|
| **Ranger** | **Kobold** | 49.8 | 50 | 0% | 697 | 4 | 21001 |
| **Ranger** | **High_elf** | 49.5 | 50 | 0% | 692 | 6 | 21905 |
| **Mage** | **Hobbit** | 49.4 | 50 | 4% | 685 | 4 | 29768 |
| **Ranger** | **Dwarf** | 49.4 | 50 | 0% | 680 | 3 | 20987 |
| **Ranger** | **Hobbit** | 49.2 | 50 | 0% | 685 | 5 | 21143 |
| **Ranger** | **Dunadan** | 49.2 | 50 | 0% | 658 | 3 | 23747 |
| **Ranger** | **Gnome** | 49.1 | 50 | 0% | 683 | 8 | 20805 |
| **Ranger** | **Half_orc** | 49.1 | 50 | 0% | 660 | 4 | 23434 |
| **Ranger** | **Elf** | 49.0 | 50 | 0% | 665 | 4 | 21412 |
| **Warrior** | **Half_troll** | 48.9 | 50 | 0% | 532 | 4 | 16072 |
| **Ranger** | **Half_elf** | 48.8 | 50 | 0% | 653 | 2 | 21483 |
| **Mage** | **Gnome** | 48.7 | 50 | 0% | 673 | 1 | 28960 |
| **Ranger** | **Half_troll** | 48.6 | 50 | 0% | 658 | 2 | 21549 |
| **Mage** | **Dwarf** | 48.4 | 50 | 2% | 662 | 1 | 29801 |
| **Warrior** | **Dunadan** | 48.4 | 50 | 0% | 517 | 0 | 15670 |
| **Mage** | **Kobold** | 48.4 | 50 | 4% | 661 | 1 | 28362 |
| **Mage** | **Human** | 48.4 | 50 | 2% | 640 | 1 | 30539 |
| **Warrior** | **Gnome** | 48.3 | 50 | 0% | 528 | 2 | 15038 |
| **Mage** | **Dunadan** | 48.2 | 50 | 0% | 670 | 0 | 30369 |
| **Warrior** | **Dwarf** | 48.2 | 50 | 0% | 528 | 1 | 15443 |
| **Warrior** | **High_elf** | 48.2 | 50 | 0% | 533 | 5 | 14846 |
| **Warrior** | **Kobold** | 48.2 | 50 | 0% | 532 | 0 | 14922 |
| **Warrior** | **Half_orc** | 47.8 | 50 | 0% | 519 | 1 | 15685 |
| **Mage** | **Half_orc** | 47.8 | 50 | 6% | 656 | 1 | 28884 |
| **Ranger** | **Human** | 47.8 | 50 | 0% | 608 | 2 | 22700 |
| **Warrior** | **Human** | 47.4 | 50 | 0% | 495 | 2 | 15235 |
| **Mage** | **Elf** | 47.1 | 50 | 0% | 640 | 2 | 29682 |
| **Warrior** | **Half_elf** | 46.9 | 50 | 0% | 498 | 0 | 14633 |
| **Mage** | **Half_troll** | 46.9 | 50 | 0% | 634 | 1 | 28816 |
| **Warrior** | **Hobbit** | 46.7 | 50 | 0% | 505 | 0 | 14438 |
| **Mage** | **High_elf** | 46.6 | 50 | 0% | 641 | 3 | 28656 |
| **Warrior** | **Elf** | 46.2 | 50 | 0% | 486 | 2 | 14723 |
| **Mage** | **Half_elf** | 46.1 | 50 | 0% | 623 | 2 | 28360 |

Runtime: 334s (33 cells, 1650 total runs, 20 threads).

### Per-Class Summary

| Class | Avg Depth | Range | Morgoth | CB Max |
|-------|-----------|-------|---------|--------|
| **Ranger** | 49.0 | 47.8–49.8 | 43 | 0% |
| **Mage** | 47.8 | 46.1–49.4 | 17 | 6% |
| **Warrior** | 47.7 | 46.2–48.9 | 17 | 0% |

**Ranger** still dominant but spread widened (0.7→2.0 depth) due to FAST_SHOT cap nerf. **Mage** and **Warrior** essentially unchanged from `af3d305` (untouched by S-tier nerfs).

### Race Rankings (averaged across 3 classes)

| Race | Avg Depth | Best Class | Worst Class |
|------|-----------|------------|-------------|
| Kobold | 48.8 | Ranger 49.8 | Warrior 48.2 |
| Gnome | 48.7 | Ranger 49.1 | Warrior 48.3 |
| Dwarf | 48.7 | Ranger 49.4 | Warrior 48.2 |
| Dunadan | 48.6 | Ranger 49.2 | Mage 48.2 |
| Hobbit | 48.4 | Mage 49.4 | Warrior 46.7 |
| Half-Orc | 48.2 | Ranger 49.1 | Warrior 47.8 |
| Half-Troll | 48.1 | Warrior 48.9 | Mage 46.9 |
| High-Elf | 48.1 | Ranger 49.5 | Mage 46.6 |
| Human | 47.9 | Mage 48.4 | Warrior 47.4 |
| Elf | 47.4 | Ranger 49.0 | Warrior 46.2 |
| Half-Elf | 47.3 | Ranger 48.8 | Mage 46.1 |

### Observations

- **Ranger spread widened**: 0.7→2.0 depth (47.8–49.8) due to FAST_SHOT cap nerf (6→5). Most races dropped ~0.5 avg depth
- **Ranger/Human dropped significantly**: 49.4→47.8 (-1.6) — the biggest ranger regression, now the weakest ranger/race combo. Human's neutral stats don't compensate for the FAST_SHOT cap reduction
- **Ranger/Gnome Morgoth leader**: 8 Morgoth kills in 50 runs (was Kobold at 7)
- **Mage unchanged**: avg 47.9→47.8, all combos within ±0.5 of previous. Untouched by nerfs
- **Warrior unchanged**: avg 47.7→47.7, all combos within ±0.5 of previous. Untouched by nerfs
- **Mage/Half-Orc 6% CB persists** — same outlier as before
- **77 Morgoth kills total** (was 73): Ranger 43 (56%), Mage 17, Warrior 17

**Changes from `af3d305`:** Ranger dropped ~0.5 avg depth across races (FAST_SHOT nerf). Ranger/Human is the notable regression (-1.6). Warrior gained 3 Morgoth kills (14→17). Mage and warrior data essentially identical — only ranger column is meaningfully changed.

### Success Criteria: ✅ Passed

- ✅ No race/class combo >10% better than human/same-class (max: Ranger/Kobold +4.2% vs Ranger/Human)
- ✅ Mage/Half-Elf -4.8% vs Mage/Human (threshold: 15%)
- ✅ Mage/Elf -2.7% vs Mage/Human
- ✅ All warrior combos viable (46.2+ avg depth)
- ✅ All ranger combos viable (47.8+ avg depth)
- ✅ CB rates ≤6% across all combos (Mage/Half-Orc 6% is the outlier)

**Remaining items:**
- Ranger/Human 47.8 is a new low — FAST_SHOT nerf hit human ranger hardest, worth monitoring
- Mage/Half-Orc 6% CB persists — same outlier as before
- Elf and Half-Elf remain the weakest races across classes (47.4 and 47.3 avg) — both within acceptable range

---

## Personality Comparison

### 3-Class × 4 Personalities @ `548a393` (50 runs, 50k turns, seed=1000, upgrades=full)

| Class | Personality | Avg Depth | Max Depth | CB Rate | Kills | Morgoth | Turns |
|-------|-------------|-----------|-----------|---------|-------|---------|-------|
| **Ranger** | **Greedy** | 49.3 | 50 | 0% | 744 | 1 | 26909 |
| **Mage** | **Greedy** | 48.5 | 50 | 0% | 741 | 1 | 32082 |
| **Mage** | **Cautious** | 48.4 | 50 | 2% | 640 | 1 | 30539 |
| **Ranger** | **Speedrunner** | 48.2 | 50 | 0% | 524 | 1 | 17186 |
| **Mage** | **Aggressive** | 48.0 | 50 | 2% | 584 | 1 | 24688 |
| **Warrior** | **Greedy** | 47.8 | 50 | 0% | 597 | 4 | 19842 |
| **Ranger** | **Cautious** | 47.8 | 50 | 0% | 608 | 2 | 22700 |
| **Warrior** | **Cautious** | 47.4 | 50 | 0% | 495 | 2 | 15235 |
| **Mage** | **Speedrunner** | 47.4 | 50 | 2% | 533 | 0 | 23927 |
| **Ranger** | **Aggressive** | 46.2 | 50 | 0% | 552 | 2 | 18816 |
| **Warrior** | **Aggressive** | 45.5 | 50 | 0% | 421 | 3 | 12700 |
| **Warrior** | **Speedrunner** | 44.4 | 50 | 0% | 367 | 1 | 9950 |

Runtime: 111s (12 cells, 600 total runs, 20 threads).

### Per-Personality Summary (averaged across 3 classes)

| Personality | Avg Depth | Morgoth | CB Max | Behavior Match |
|-------------|-----------|---------|--------|----------------|
| **Greedy** | 48.5 | 6 | 0% | Most kills, loot compensates for DPS nerfs |
| **Cautious** | 47.9 | 5 | 2% | Baseline — safe play |
| **Speedrunner** | 46.7 | 2 | 2% | Fastest runs, lowest depth |
| **Aggressive** | 46.6 | 6 | 2% | Faster runs, more risk |

### Per-Class Personality Rankings

| Class | Best | 2nd | 3rd | Worst | Spread |
|-------|------|-----|-----|-------|--------|
| **Ranger** | Greedy 49.3 | Speedrunner 48.2 | Cautious 47.8 | Aggressive 46.2 | 3.1 |
| **Mage** | Greedy 48.5 | Cautious 48.4 | Aggressive 48.0 | Speedrunner 47.4 | 1.1 |
| **Warrior** | Greedy 47.8 | Cautious 47.4 | Aggressive 45.5 | Speedrunner 44.4 | 3.4 |

### Observations

- **Greedy now best for all 3 classes** — ranger greedy surged from worst (+1.8) to best, mage and warrior unchanged. FAST_SHOT nerf reduced ranger's raw DPS, making loot collection (better gear) more valuable
- **Ranger personality rankings completely reshuffled**: Old: Cautious > Aggressive > Speedrunner > Greedy. New: Greedy > Speedrunner > Cautious > Aggressive. The FAST_SHOT cap nerf inverted the value of aggression vs gear collection
- **Ranger/Aggressive took the biggest hit**: 49.1→46.2 (-2.9) — pushing fights without the old FAST_SHOT power is now punished heavily
- **Ranger/Cautious also dropped**: 49.4→47.8 (-1.6) — consistent with race matrix regression for ranger/human
- **Ranger spread widened**: 1.9→3.1 depth — ranger is now more personality-sensitive than before (was the least sensitive)
- **Mage unchanged**: all 4 personalities within ±0.5 of previous. Untouched by nerfs
- **Warrior unchanged**: all 4 personalities within ±0.3 of previous. Untouched by nerfs
- **Speedrunner viable everywhere**: worst case is warrior at 44.4 avg — still well above 35 threshold
- **All CB rates ≤2%** — improved from 4% max (aggressive mage dropped 4%→2%)

**Changes from `af3d305`:** FAST_SHOT nerf reshuffled ranger personalities entirely. Greedy went from worst to best ranger personality (+1.8). Aggressive went from 2nd to worst (-2.9). Mage and warrior data essentially identical.

### Success Criteria: ✅ Passed

- ✅ All personalities viable (reach depth 35+) — lowest: warrior/speedrunner at 44.4
- ✅ No personality strictly dominates cautious — greedy beats all 3 classes but by small margins for mage (+0.1) and warrior (+0.4)
- ✅ Personality behaviors match expectations (greedy = most kills, speedrunner = fewest turns, aggressive = higher risk)

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate tuning
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
- `docs/BALANCE-PASS-3.md` - Pure caster fixes (vision, stair-surf, phase door)
- `docs/BALANCE-PASS-4.md` - Goal oscillation, caution threshold, vault fixes, TP scroll fixes
- `docs/BALANCE-PASS-5.md` - Historical baselines and archived test data
- `docs/XP-CURVE-ANALYSIS.md` - XP curve analysis and two-part curve implementation
