# Balance Test Plan

## Current State (2026-01-23)

### Class Performance (100 runs, 30k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Warrior** | 40.9 | 50 | 48% | 397 | Endgame |
| **Blackguard** | 40.3 | 50 | 40% | 408 | Endgame |
| **Berserker** | 40.3 | 50 | 45% | 403 | Endgame |
| **Paladin** | 39.9 | 50 | 39% | 510 | Endgame |
| **Priest** | 38.4 | 48 | 39% | 474 | Endgame |
| **Rogue** | 38.3 | 50 | 45% | 478 | Endgame |
| **Ranger** | 38.2 | 50 | 36% | 485 | Endgame |
| **Druid** | 34.5 | 45 | 30% | 424 | Endgame |
| **Necromancer** | 30.9 | 43 | 23% | 563 | Endgame |
| **Archmage** | 29.7 | 45 | 34% | 539 | Mid |
| **Mage** | 28.7 | 42 | 39% | 535 | Mid |

**Summary:** 9 classes endgame-viable (30+ avg), 2 classes mid-tier (28-30 avg). Ranger achieved first Morgoth kill.

---

## Known Issues

### Pure Casters (Mage, Archmage, Necromancer)

At 29-31 avg depth, casters are approaching endgame viability. Necromancer now endgame-viable at 30.9. Remaining issues:

1. **Mage/Archmage still mid-tier** - 28.7/29.7 avg depth, close but not quite 30+
2. **Higher CB rates than expected** - Mage 39%, Archmage 34% (vs Necro 23%)

Previous fixes (see BALANCE-PASS-3.md):
- Vision buff spells (Light Orb, Shadow Sight) - +6-10 avg depth
- Earlier stair-surfing (level 10 vs 15) - +3-4 avg depth
- Conditional Phase Door at DANGER tier - +4 avg depth for Archmage
- Sweep flow optimization - reduced context spikes

#### Investigated: Post-Teleport Goal Reset

Attempted to reset EXPLORE goals after phase door/teleport to prevent bot from backtracking to distant pre-teleport targets. Implementation in `state.ts:resetAfterTeleport()` with hooks in `tick.ts` (currently disabled).

**Finding:** Caused -0.8 avg depth regression and +6% CB rate increase for Archmage. Even minimal reset (EXPLORE goals only, keep caches) showed -0.2 depth / +3% CB. The persistence bonus (+150) for current exploration targets may be helping more than hurting overall. Code remains for future investigation when other issues are resolved.

### Endgame Circuit Breakers

36-48% CB rate at depths 32-50 for melee/hybrid classes (improved from 30-63%). Possible causes:
- Goal oscillation at high depths
- Pathfinding issues in complex late-game dungeons
- Decision paralysis with many available options

---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 30,000 | Enough for endgame, catches long caster runs |
| `--runs` | 100 | Statistical significance, ~1.5-2 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

**Standard command:**
```bash
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000
```

**Full baseline (all 11 classes):**
```bash
npx tsx scripts/diagnose.ts baseline --seed=1000  # ~15 min
```

**Parallel execution:** Run only 2 batch commands simultaneously (8 threads each = 16 total).

---

## Diagnostic Tooling

```bash
# Quick single run
npx tsx scripts/diagnose.ts quick --seed=12345 --class=warrior

# Deep dive with turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior --map

# Standard batch test
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=500 --seed=1000 --class=mage --turns=30000

# Full baseline across all 11 classes (100 runs, 30k turns, max-upgrades)
# ~15 min runtime
npx tsx scripts/diagnose.ts baseline --seed=1000
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
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000

# With change (same seed for A/B comparison)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 [flags]

# Verify no regression on warrior
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 [flags]
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
