# Balance Test Plan

## Current State (2026-01-29)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `c00b685` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Codex Modal

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Warrior** | 48.5 | 50 | 1% | 14383 | 505 | 6 | ✅ Endgame |
| **Ranger** | 48.5 | 50 | 0% | 19627 | 596 | 1 | ✅ Endgame |
| **Berserker** | 48.4 | 50 | 0% | 13846 | 505 | 5 | ✅ Endgame |
| **Paladin** | 47.0 | 50 | 0% | 18788 | 596 | 0 | ✅ Endgame |
| **Blackguard** | 46.6 | 50 | 0% | 13694 | 499 | 1 | ✅ Endgame |
| **Priest** | 44.8 | 50 | 1% | 20822 | 626 | 0 | ✅ Endgame |
| **Rogue** | 44.8 | 50 | 2% | 19047 | 535 | 0 | ✅ Endgame |
| **Necromancer** | 43.5 | 48 | 14% | 28777 | 708 | 0 | ⚠️ CB Regression |
| **Druid** | 43.3 | 50 | 0% | 18143 | 522 | 0 | ✅ Endgame |
| **Mage** | 42.5 | 50 | 9% | 29590 | 656 | 0 | ⚠️ CB Regression |
| **Archmage** | 40.9 | 48 | 9% | 28846 | 628 | 0 | ⚠️ CB Regression |

**Summary:** All classes endgame-viable. Caster CB rates persist (Necro 14%, Mage 9%, Archmage 9%). **13 Morgoth kills** (6 warrior, 5 berserker, 1 ranger, 1 blackguard). Rogue CB increased to 2%. UI-only changes (Codex modal, Wins tab) - no gameplay impact expected.

### Previous Baseline @ `9bba82b` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Artifact Abilities

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 48.3 | 50 | 0% | 19404 | 594 | 3 | ✅ Endgame |
| **Warrior** | 48.1 | 50 | 1% | 14311 | 498 | 5 | ✅ Endgame |
| **Berserker** | 47.8 | 50 | 1% | 13610 | 496 | 2 | ✅ Endgame |
| **Blackguard** | 46.8 | 50 | 0% | 13719 | 500 | 2 | ✅ Endgame |
| **Paladin** | 46.4 | 50 | 0% | 18576 | 592 | 0 | ✅ Endgame |
| **Necromancer** | 43.9 | 49 | 14% | 29585 | 701 | 0 | ⚠️ CB Regression |
| **Priest** | 43.9 | 50 | 0% | 20406 | 598 | 0 | ✅ Endgame |
| **Druid** | 43.7 | 50 | 0% | 18210 | 522 | 0 | ✅ Endgame |
| **Rogue** | 43.5 | 50 | 0% | 18602 | 517 | 1 | ✅ Endgame |
| **Mage** | 42.2 | 50 | 11% | 30713 | 642 | 0 | ⚠️ CB Regression |
| **Archmage** | 41.1 | 48 | 17% | 30078 | 629 | 0 | ⚠️ CB Regression |

**Summary:** All classes endgame-viable but caster CB rates regressed (Mage 11%, Necro 14%, Archmage 17%). **13 Morgoth kills** (5 warrior, 3 ranger, 2 berserker, 2 blackguard, 1 rogue). Implemented: slays, status protections, Free Action, equipment Regeneration. Removed unimplemented Telepathy.

### Previous Baseline @ `b6ccc40` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Gold Economy Rebalance

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.0 | 50 | 0% | 22017 | 652 | 2 | ✅ Endgame |
| **Blackguard** | 48.5 | 50 | 0% | 15771 | 556 | 1 | ✅ Endgame |
| **Berserker** | 48.5 | 50 | 0% | 14651 | 526 | 9 | ✅ Endgame |
| **Paladin** | 48.1 | 50 | 1% | 22120 | 663 | 0 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 0% | 16170 | 535 | 6 | ✅ Endgame |
| **Rogue** | 47.1 | 50 | 0% | 22391 | 627 | 0 | ✅ Endgame |
| **Mage** | 46.8 | 50 | 1% | 36863 | 780 | 2 | ✅ Endgame |
| **Necromancer** | 46.5 | 50 | 3% | 32986 | 797 | 0 | ✅ Endgame |
| **Archmage** | 45.8 | 50 | 2% | 35744 | 764 | 0 | ✅ Endgame |
| **Druid** | 45.6 | 50 | 0% | 21477 | 604 | 0 | ✅ Endgame |
| **Priest** | 44.9 | 50 | 0% | 24132 | 689 | 1 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (44.9-49.0 avg depth). **21 Morgoth kills** (9 berserker, 6 warrior, 2 ranger, 2 mage, 1 blackguard, 1 priest). CB rates 0-3%. Gold economy rebalanced: quadratic equipment pricing, reduced late-game gold drops, depth-aware bot shopping logic.

### Previous Baseline @ `54a9e7a` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Upgrade Rebalance

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.3 | 50 | 1% | 22588 | 658 | 4 | ✅ Endgame |
| **Berserker** | 48.7 | 50 | 0% | 14700 | 531 | 16 | ✅ Endgame |
| **Warrior** | 48.2 | 50 | 0% | 16505 | 536 | 11 | ✅ Endgame |
| **Paladin** | 48.0 | 50 | 0% | 22478 | 660 | 2 | ✅ Endgame |
| **Blackguard** | 47.5 | 50 | 0% | 15480 | 544 | 2 | ✅ Endgame |
| **Rogue** | 47.1 | 50 | 0% | 22919 | 621 | 0 | ✅ Endgame |
| **Mage** | 46.6 | 50 | 1% | 36755 | 778 | 1 | ✅ Endgame |
| **Necromancer** | 46.6 | 50 | 1% | 33407 | 800 | 0 | ✅ Endgame |
| **Archmage** | 45.8 | 50 | 1% | 35933 | 764 | 0 | ✅ Endgame |
| **Druid** | 45.5 | 50 | 0% | 21567 | 607 | 0 | ✅ Endgame |
| **Priest** | 45.5 | 50 | 0% | 24259 | 709 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (45+ avg depth). **36 Morgoth kills** (16 berserker, 11 warrior, 4 ranger, 2 paladin, 2 blackguard, 1 mage). CB rates excellent (0-1%). Nerfed Swiftness (25%→10% dodge) and buffed Resilience (5→10 armor) with no measurable impact.

### Baseline @ `9b151af` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.4 | 50 | 1% | 22369 | 652 | 3 | ✅ Endgame |
| **Blackguard** | 48.3 | 50 | 0% | 16802 | 557 | 5 | ✅ Endgame |
| **Warrior** | 48.3 | 50 | 0% | 16259 | 538 | 11 | ✅ Endgame |
| **Berserker** | 48.3 | 50 | 0% | 14854 | 516 | 14 | ✅ Endgame |
| **Paladin** | 48.0 | 50 | 0% | 22131 | 657 | 3 | ✅ Endgame |
| **Necromancer** | 46.8 | 50 | 4% | 33386 | 806 | 0 | ✅ Endgame |
| **Mage** | 46.8 | 50 | 1% | 36757 | 783 | 0 | ✅ Endgame |
| **Rogue** | 46.6 | 50 | 1% | 22774 | 614 | 1 | ✅ Endgame |
| **Druid** | 45.7 | 50 | 0% | 21626 | 607 | 0 | ✅ Endgame |
| **Archmage** | 45.4 | 50 | 0% | 35478 | 758 | 0 | ✅ Endgame |
| **Priest** | 45.3 | 50 | 0% | 24291 | 695 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (45+ avg depth). **37 Morgoth kills** (14 berserker, 11 warrior, 5 blackguard, 3 ranger, 3 paladin, 1 rogue). CB rates excellent across all classes (0-4%).

---

## Known Issues

### Caster CB Rate Regression @ `9bba82b`

Pure casters show elevated circuit breaker rates after artifact ability implementation:
- Archmage: 2% → 17% CB
- Necromancer: 3% → 14% CB
- Mage: 1% → 11% CB

**Likely unrelated to artifact changes** (slays/protections/regen should help, not hurt). May be coincidental with other unstaged changes or seed interaction. Needs investigation.

---

## Race Baseline

> **Run:** `pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades`

### Race Baseline @ `<commit>` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

| Race | Avg Depth | Max Depth | CB Rate | Turns | Kills | Status |
|------|-----------|-----------|---------|-------|-------|--------|
| *Run baseline-races to populate* | | | | | | |

**Expected Tiers:**
- **Starter** (human, dwarf, elf): Average performance, baseline reference
- **Unlockable** (half-elf, hobbit, gnome, half-orc, half-troll, dunadan, high-elf, kobold): Spread expected
- **Prestige** (vampire, golem, draconian): Not yet included in baseline

---

## Capability Progression Testing

Tests bot performance at different unlock stages.

### Capability Presets

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town | 15-20 |
| `mid` | town, farming, sweep_1, surf_1 | 25-35 |
| `late` | town, farming, preparedness, sweep_2, surf_2, kiting_1 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

### Progression Test Commands

```bash
# Test each progression stage
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=none --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=early --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=mid --turns=30000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=late --turns=40000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=full --turns=50000
```

---

## Upgrade Sensitivity Testing

Measures per-upgrade impact on bot performance.

> **Run:** `pnpm diagnose sensitivity --seed=1000 --class=warrior`

### Upgrade Impact @ `<commit>` (50 runs, 30k turns, seed=1000, class=warrior)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| *Run sensitivity to populate* | | | | |

**Interpretation:**
- 🔴 High impact (>10% loss): Critical upgrade, prioritize early
- 🟡 Medium impact (5-10%): Important but not blocking
- 🟢 Low impact (<5%): Nice-to-have, can defer

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
| `--turns=N` | 5000 | Max turns per run |
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
