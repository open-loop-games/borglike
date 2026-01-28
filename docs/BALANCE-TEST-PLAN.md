# Balance Test Plan

## Current State (2026-01-28)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `54a9e7a` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Upgrade Rebalance

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

### Previous Baseline @ `9b151af` (100 runs, 50k turns, seed=1000, max-upgrades)

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

_(None currently identified)_

---

## Future



---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 50,000 | Catches caster CB issues that emerge at higher turn counts |
| `--runs` | 100 | Statistical significance, ~2-3 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

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
