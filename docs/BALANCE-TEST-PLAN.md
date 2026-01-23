# Balance Test Plan

## Current State (2026-01-22, Post-Refactor Baseline)

### Class Performance (30 runs each, 25k turns, --max-upgrades, seed=1000)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 42.4 | 50 | 37% | 436 | ✅ Endgame |
| **Paladin** | 39.1 | 50 | 33% | 496 | ✅ Endgame |
| **Priest** | 38.0 | 49 | 30% | 471 | ✅ Endgame |
| **Warrior** | 36.5 | 50 | 50% | 350 | ✅ Endgame |
| **Blackguard** | 36.0 | 50 | 50% | 357 | ✅ Endgame |
| **Rogue** | 35.9 | 48 | 57% | 451 | ✅ Endgame |
| **Druid** | 32.0 | 45 | 37% | 402 | ✅ Endgame |
| **Archmage** | 4.7 | 9 | 3% | 176 | ⚠️ Early |
| **Ranger** | 4.2 | 14 | 0% | 39 | ⚠️ Weak |
| **Mage** | 3.5 | 8 | 3% | 119 | ⚠️ Early |
| **Necromancer** | 2.6 | 5 | 17% | 85 | ⚠️ Early |

### Key Findings

1. **Melee/hybrid classes still strong** - 7 classes averaging depth 32-42, reaching endgame
2. **Casters regressed significantly** - Necro 12.3→2.6, Mage 8.8→3.5 (needs investigation)
3. **Circuit breaker rates elevated** - 30-57% for melee classes at endgame depths
4. **Ranger still weak** - Max depth 14 shows some potential but avg 4.2
5. **Morgoth kills observed** - Berserker (5), Warrior (3), Blackguard (2), Paladin (1)

### Top Killers by Class Tier

**Endgame classes (depth 32-42):**
- 7-Headed Hydra, Undead Beholder, Beholder, Mature Green Dragon, Cyclops, Marilith

**Casters (depth 2-5):**
- White Jelly, Small Kobold, Centipede, unknown (starvation/attrition)

### Comparison to Previous Baseline (2026-01-22 Post-Caster Fix)

| Class | Old Avg | New Avg | Old CB | New CB | Change |
|-------|---------|---------|--------|--------|--------|
| Berserker | 40.1 | 42.4 | 43% | 37% | ✅ +2.3 |
| Paladin | 39.7 | 39.1 | 43% | 33% | ≈ -0.6 |
| Priest | 38.8 | 38.0 | 33% | 30% | ≈ -0.8 |
| Warrior | 39.5 | 36.5 | 40% | 50% | ⚠️ -3.0 |
| Blackguard | 40.0 | 36.0 | 47% | 50% | ⚠️ -4.0 |
| Rogue | 39.5 | 35.9 | 44% | 57% | ⚠️ -3.6 |
| Druid | 36.2 | 32.0 | 24% | 37% | ⚠️ -4.2 |
| Archmage | 6.6 | 4.7 | 8% | 3% | ⚠️ -1.9 |
| Ranger | 5.5 | 4.2 | 1% | 0% | ⚠️ -1.3 |
| Mage | 8.8 | 3.5 | 4% | 3% | ❌ -5.3 |
| Necromancer | 12.3 | 2.6 | 6% | 17% | ❌ -9.7 |

---

## Standard Test Parameters

Current standard for balance testing (while CB rates remain elevated):

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 25,000 | Enough for endgame (melee avg ~15k), catches stuck bots |
| `--runs` | 30 | Statistical significance without excessive wait |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

**Execution notes:**
- Diagnose script uses 8 threads by default
- Run only 2 batch commands in parallel for best throughput (16 total threads)
- Expected time per batch: 6-15 min depending on class

**Standard command:**
```bash
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=CLASS --max-upgrades --turns=25000
```

**Future threshold:** Once CB rates drop below 10%, bump to `--turns=50000 --runs=50` for finer-grained endgame analysis.

---

## Diagnostic Tooling

```bash
# Quick single run
npx tsx scripts/diagnose.ts quick --seed=12345 --class=warrior

# Deep dive with turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior --map

# Standard batch test
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=warrior --max-upgrades --turns=25000

# With balance overrides
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --max-upgrades --monster-hp=50 --turns=25000

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=500 --seed=1000 --class=mage --turns=25000
```

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--max-upgrades` | off | Apply all upgrades at max (includes 25% bestiary) |
| `--turns=N` | 5000 | Max turns per run (use 25000 standard, 50000 post-CB-fix) |
| `--monster-hp=N` | 100 | Monster HP % |
| `--monster-damage=N` | 100 | Monster damage % |
| `--bestiary=N` | 0 | Fixed bestiary bonus % (0=use kills, 1-25=fixed) |
| `--start-potions=N` | 3 | Starting healing potions |
| `--potion-rate=N` | 100 | Potion spawn rate % |
| `--regen=N` | 0 | HP regen per 10 turns (OOC) |
| `--armor-pen=N` | 0 | Flat armor penetration |
| `--enchant-rate=N` | 100 | Enchantment chance % |
| `--item-rate=N` | 100 | Items per level % |
| `--xp-rate=N` | 100 | XP gain % |

---

## Resolved Issues

---

## Known Issues

### Caster Regression (2026-01-22 Post-Refactor)

After recent refactors, casters have regressed significantly:
- Necromancer: 12.3 → 2.6 avg depth (-9.7)
- Mage: 8.8 → 3.5 avg depth (-5.3)
- Archmage: 6.6 → 4.7 avg depth (-1.9)

Top killers are now early-game mobs (White Jelly, Small Kobold, Centipede) suggesting they're dying very early. Needs investigation - likely a change broke the stair surfing fix or early game survival logic.

### Ranger Still Weak (2026-01-22)

Ranger at avg 4.2 depth, max 14:
- 0% CB rate means dying, not stuck
- Top killers are early-game mobs (White Jelly, Centipede, Cave Spider)

### Endgame Circuit Breakers (2026-01-22)

30-57% CB rate at depth 32-42 for melee/hybrid classes:
- Bot may be oscillating between goals at high depths
- Pathfinding issues in complex late-game dungeons
- Decision paralysis with many options available

---

## Test Matrix Template

When testing a change:

```bash
# Baseline (seeded for reproducibility)
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=CLASS --max-upgrades --turns=25000

# With change (same seed for A/B comparison)
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=CLASS --max-upgrades --turns=25000 [flags]

# Verify no regression on warrior
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=warrior --max-upgrades --turns=25000 [flags]
```

**Parallel execution** (only run 2 classes simultaneously):
```bash
# Terminal 1
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=warrior --max-upgrades --turns=25000

# Terminal 2 (simultaneously)
npx tsx scripts/diagnose.ts batch --runs=30 --seed=1000 --class=mage --max-upgrades --turns=25000
```

**Success criteria:**
- Target class improves by 1+ avg depth
- No regression on other classes
- Circuit breaker rate doesn't increase significantly

---

## Historical Baselines

### 2026-01-22 Post-Caster Fix (Previous Baseline)

| Class | Avg Depth | Max Depth | CB Rate | Kills |
|-------|-----------|-----------|---------|-------|
| Berserker | 40.1 | 50 | 43% | 519 |
| Blackguard | 40.0 | 50 | 47% | 498 |
| Paladin | 39.7 | 50 | 43% | 525 |
| Warrior | 39.5 | 50 | 40% | 514 |
| Rogue | 39.5 | 50 | 44% | 537 |
| Priest | 38.8 | 50 | 33% | 503 |
| Druid | 36.2 | 49 | 24% | 490 |
| Necromancer | 12.3 | 19 | 6% | 49 |
| Mage | 8.8 | 14 | 4% | 27 |
| Archmage | 6.6 | 13 | 8% | 19 |
| Ranger | 5.5 | 35 | 1% | 62 |

### 2026-01-22 Pre-Combat Rework

| Class | Avg Depth | Max Depth | CB Rate |
|-------|-----------|-----------|---------|
| Berserker | 12.5 | 14 | 4% |
| Warrior | 9.7 | 11 | 3% |
| Blackguard | 9.3 | 11 | 3% |
| Paladin | 4.3 | 9 | 97% |
| Priest | 4.0 | 6 | 99% |
| Druid | 4.3 | 8 | 92% |
| Rogue | 4.3 | 8 | 96% |
| Archmage | 4.3 | 9 | 5% |
| Necromancer | 4.0 | 7 | 4% |
| Mage | 4.2 | 8 | 7% |
| Ranger | 4.2 | 9 | 18% |

### 2026-01-21 Original Baseline

| Class | Avg Depth | Max Depth | CB Rate |
|-------|-----------|-----------|---------|
| Berserker | 12.0 | - | 10% |
| Warrior | 12.0 | - | 7% |
| Blackguard | 11.4 | - | 8% |
| Paladin | 10.8 | - | 8% |
| Priest | 10.7 | - | 12% |
| Druid | 9.8 | - | 9% |
| Rogue | 9.6 | - | 12% |
| Archmage | 8.4 | - | 32% |
| Necromancer | 8.4 | - | 12% |
| Mage | 8.1 | - | 26% |
| Ranger | 8.1 | - | 11% |

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate changes
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
