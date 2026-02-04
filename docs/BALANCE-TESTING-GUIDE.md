# Balance Testing Guide

Progressive testing plan for validating game balance across all dimensions.

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
| `--runs` | 50 | Statistical significance, fast iteration |
| `--turns` | 50000 | Catches late-game issues |
| `--race` | human | Neutral baseline |
| `--class` | warrior | Simplest mechanics |
| `--personality` | cautious | Default, most tested |
| `--upgrades` | full | Meta-progression maxed |
| `--boosters` | class | Class-optimal loadout |
| `--capabilities` | full | Bot fully unlocked |

---

## Phase 1: Race Baseline

**Status:** Not started
**Goal:** Establish race balance with human as reference.

### Why First
Races are character-defining choices made at game start. Players need to understand relative power levels before investing in unlocks.

### Configuration
- Class: warrior (simplest, least interference)
- Personality: cautious
- All upgrades/capabilities maxed

### Commands

```bash
# Full race baseline (~16 min)
pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades

# Individual race test
pnpm diagnose batch --runs=50 --seed=1000 --race=RACE --class=warrior \
  --max-upgrades --turns=50000
```

### Expected Tiers

| Tier | Races | Expected Depth |
|------|-------|----------------|
| Starter | human, dwarf, elf | 45-48 (baseline) |
| Unlockable | half-elf, hobbit, gnome, half-orc, half-troll, dunadan, high-elf, kobold | 42-50 (spread) |
| Prestige | vampire, golem, draconian | TBD |

### Success Criteria
- All races reach depth 40+ average
- No race exceeds human by >5 avg depth (power creep)
- No race falls below human by >8 avg depth (trap option)
- CB rates <5% across all races

### Output Location
Results go in `docs/BALANCE-TEST-PLAN.md` → Race Baseline section.

---

## Phase 2: Capability Progression

**Status:** Not started
**Goal:** Validate bot performs progressively better with unlocks.

### Why Second
Bot capabilities are the primary unlock loop. Players need to feel progression as they purchase upgrades.

### Configuration
- Human warrior, cautious
- Max upgrades (isolate capability impact)
- Test each capability tier

### Commands

```bash
# Test each tier
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --max-upgrades --capabilities=none --turns=20000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --max-upgrades --capabilities=early --turns=25000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --max-upgrades --capabilities=mid --turns=35000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --max-upgrades --capabilities=late --turns=45000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --max-upgrades --capabilities=full --turns=50000
```

### Capability Presets

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town, farming, preparedness | 15-20 |
| `mid` | town, farming, preparedness, sweep_1, surf_1 | 25-35 |
| `late` | town, farming, preparedness, sweep_2, surf_2, kiting_1 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

### Success Criteria
- Clear progression: each tier > previous by 5+ avg depth
- No tier feels "wasted" (< 3 depth gain)
- No single capability dominates (test via exclusion)

### Output Location
Results go in `docs/BALANCE-TEST-PLAN.md` → Capability Progression section.

---

## Phase 3: Upgrade Progression

**Status:** Not started
**Goal:** Validate meta-upgrades provide meaningful progression.

### Why Third
Upgrades are the permanent progression layer. Need to validate they compound well with capabilities.

### Configuration
- Human warrior, cautious
- Full capabilities (isolate upgrade impact)
- Test each upgrade tier

### Commands

```bash
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --upgrades=none --capabilities=full --turns=30000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --upgrades=early --capabilities=full --turns=35000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --upgrades=mid --capabilities=full --turns=40000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --upgrades=late --capabilities=full --turns=45000

pnpm diagnose batch --runs=50 --seed=1000 --class=warrior \
  --upgrades=full --capabilities=full --turns=50000
```

### Upgrade Presets

| Preset | Upgrades |
|--------|----------|
| `none` | No upgrades |
| `early` | vitality 2, might 2, resilience 1 |
| `mid` | vitality 5, might 5, resilience 3, swiftness 2, precision 2, celerity 2 |
| `late` | vitality 8, might 8, resilience 4, swiftness 4, precision 4, celerity 4 |
| `full` | All upgrades at max level |

### Success Criteria
- Clear progression curve
- Upgrades + capabilities compound (full/full > full/none + none/full)
- No upgrade tier feels mandatory (can progress without)

---

## Phase 4: Upgrade Sensitivity

**Status:** Not started
**Goal:** Identify which individual upgrades matter most.

### Why Fourth
Helps prioritize unlock order UX and identify overpowered/underpowered upgrades.

### Commands

```bash
# Test warrior (melee baseline)
pnpm diagnose sensitivity --seed=1000 --class=warrior

# Test mage (caster comparison)
pnpm diagnose sensitivity --seed=1000 --class=mage
```

### Interpretation

| Impact | Delta | Meaning |
|--------|-------|---------|
| 🔴 High | >10% depth loss | Critical, prioritize early |
| 🟡 Medium | 5-10% | Important but not blocking |
| 🟢 Low | <5% | Nice-to-have, can defer |

### Success Criteria
- No single upgrade > 15% impact (too dominant)
- Stat upgrades roughly equal impact across classes
- QoL upgrades < 5% impact (convenience, not power)

---

## Phase 5: Cross-Class Race Testing

**Status:** Not started
**Goal:** Validate races work across class archetypes.

### Why Fifth
Race/class synergies may create outliers not visible in warrior-only testing.

### Configuration
Test top/bottom/middle races from Phase 1 against class archetypes.

### Commands

```bash
# Representative subset (adjust races based on Phase 1 results)
for race in high_elf dwarf kobold human; do
  for class in warrior mage ranger; do
    pnpm diagnose batch --runs=50 --seed=1000 --race=$race --class=$class \
      --max-upgrades --turns=50000
  done
done
```

### Class Archetypes

| Archetype | Classes | Primary Stat |
|-----------|---------|--------------|
| Melee | warrior, berserker, blackguard | STR |
| Caster | mage, archmage, necromancer | INT |
| Hybrid | ranger, paladin, druid | Mixed |
| Specialist | rogue, priest | DEX/WIS |

### Success Criteria
- No race/class combo > 10% better than human/same-class
- No race/class combo > 15% worse than human/same-class
- Synergies feel intentional, not broken

---

## Phase 6: Personality Comparison (Low Priority)

**Status:** Not started
**Goal:** Validate personality behaviors don't break baseline classes.

### Commands

```bash
pnpm diagnose compare --runs=50 --seed=1000 --class=warrior --turns=50000
pnpm diagnose compare --runs=50 --seed=1000 --class=mage --turns=50000
pnpm diagnose compare --runs=50 --seed=1000 --class=ranger --turns=50000
```

### Personality Expectations

| Personality | Behavior | Expected Impact |
|-------------|----------|-----------------|
| cautious | Safe play, retreat early | Baseline |
| aggressive | Push deeper, risk more | Higher variance, similar avg |
| greedy | Prioritize loot | More gold, slightly lower depth |
| speedrunner | Rush stairs | Faster runs, lower depth |

### Success Criteria
- All personalities viable (reach depth 35+)
- No personality strictly dominates cautious
- Personality choice feels meaningful, not optimal

---

## Regression Testing

### When to Re-run Baseline

Re-run full class baseline after:
- Combat formula changes
- Monster stat/spawn changes
- Bot AI behavior changes
- New class/race additions

### Quick Regression Check

```bash
# Test the 3 most sensitive classes
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --turns=50000
pnpm diagnose batch --runs=50 --seed=1000 --class=mage --max-upgrades --turns=50000
pnpm diagnose batch --runs=50 --seed=1000 --class=necromancer --max-upgrades --turns=50000
```

### Known Sensitive Seeds

Document seeds that expose specific behaviors:
- CB-triggering seeds per class
- Seeds with difficult vault spawns
- Seeds where specific classes excel/struggle

---

## Interpreting Results

### Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Avg Depth | 45+ | 35-44 | <35 |
| Max Depth | 50 | 48-49 | <48 |
| CB Rate | 0-2% | 3-10% | >10% |
| Morgoth Kills | >0 | 0 | N/A |

### Common Issues

**High CB Rate:** Bot getting stuck, investigate with `deep` mode
**Low Avg Depth:** Class/race underpowered or bot can't handle playstyle
**High Variance:** Inconsistent performance, may indicate RNG sensitivity

---

## File Locations

| File | Purpose |
|------|---------|
| `docs/BALANCE-TEST-PLAN.md` | Test results and baselines |
| `docs/BALANCE-TESTING-GUIDE.md` | This file - methodology |
| `docs/BALANCE-PASS-*.md` | Historical balance change logs |
