# Balance Test Plan

## Current State (2026-01-23 Post-Ranger-Fix)

### Class Performance (30-50 runs each, 30k turns, seed=1000)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Warrior** | 40.8 | 50 | 38% | 406 | ✅ Endgame |
| **Paladin** | 39.4 | 50 | 35% | 505 | ✅ Endgame |
| **Blackguard** | 39.1 | 50 | 49% | 395 | ✅ Endgame |
| **Priest** | 38.8 | 50 | 37% | 486 | ✅ Endgame |
| **Berserker** | 38.4 | 50 | 56% | 379 | ✅ Endgame |
| **Rogue** | 38.1 | 50 | 46% | 472 | ✅ Endgame |
| **Ranger** | 37.7 | 50 | 27% | 473 | ✅ Endgame |
| **Druid** | 34.1 | 47 | 30% | 425 | ✅ Endgame |
| **Mage** | 14.8 | 25 | 8% | 391 | ⚠️ Midgame |
| **Necromancer** | 14.7 | 25 | 0% | 388 | ⚠️ Midgame |
| **Archmage** | 12.9 | 27 | 10% | 357 | ⚠️ Midgame |

### Key Findings

1. **Pure casters FIXED** - Mage 4.9→14.8, Necromancer 5.5→14.7, Archmage 5.9→12.9
2. **Ranger FIXED** - Was 5.0, now 37.7 avg depth (dist 2 kiting bug)
3. **9 classes endgame-viable** - Warrior, Paladin, Blackguard, Priest, Berserker, Rogue, Ranger, Druid
4. **3 classes midgame** - Mage, Necromancer, Archmage (need more work to reach endgame)

### Caster Fix Details (2026-01-23)

**Root cause:** `hasRangedWeapon()` used `!== null` check, but equipment initializes as `{}` so `equipment.bow` is `undefined`. JavaScript: `undefined !== null` is `true`, so casters were incorrectly treated as bow users.

**Fix:** Changed to `!= null` (handles both null and undefined).

**Result:** Casters now cast damage spells when adjacent instead of futilely kiting. With low early-game visibility (2-3 tiles), casters only get one cast before monsters close to melee range. The fix lets them finish kills with spells instead of running.

### Ranger Fix Details (2026-01-23)

**Root cause:** Dist 2 proactive repositioning (added for casters) was causing rangers to oscillate. Rangers tried to kite from dist 2 to optimal range (3-4), monster closed back to dist 2, repeat → oscillation instead of shooting.

**Fix:** Only apply dist 2 kiting for casters (no bow). Rangers now shoot at dist 2 instead of kiting.

**Result:** Ranger 4.6 → 37.7 avg depth. Mage unchanged (14.6).

Earlier ranger improvements (still active):
1. **Bow multipliers** - Added Angband-style launcher multipliers (×2/×3) to bows
2. **Wolf summon integration** - Rangers now summon wolf proactively in SAFE/DANGER/CAUTION tiers
3. **Root shot before kiting** - When adjacent, rangers stun with root_shot before kiting away
4. **New spells** - Hunter's Mark (+25% damage), Camouflage (+50 AC), Summon Bear
5. **New bows** - War Bow (tier 3), Bow of the Serpent (tier 4 with poison)

---

## Standard Test Parameters

Current standard for balance testing:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 30,000 | Enough for endgame (avg ~13k turns), catches long caster runs |
| `--runs` | 100 | Statistical significance, ~1.5-2 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--max-upgrades` | always | Consistent meta-progression state |

**Execution notes:**
- Diagnose script uses 8 threads by default
- Run only 2 batch commands in parallel for best throughput (16 total threads)
- Expected time per batch: 1.5-2 min per class

**Standard command:**
```bash
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000
```

---

## Diagnostic Tooling

```bash
# Quick single run
npx tsx scripts/diagnose.ts quick --seed=12345 --class=warrior

# Deep dive with turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior --map

# Standard batch test
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000

# With balance overrides
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --max-upgrades --monster-hp=50 --turns=30000

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=500 --seed=1000 --class=mage --turns=30000
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

### Pure Casters Fixed (2026-01-23)

Mage went from 4.9 to 14.8 avg depth, Necromancer from 5.5 to 14.7, Archmage from 5.9 to 12.9. Fixed by:
- Fixed `hasRangedWeapon()` to use `!= null` instead of `!== null`
- Equipment initializes as `{}` so `equipment.bow` is `undefined`, not `null`
- `undefined !== null` was returning `true`, treating casters as bow users
- Casters now correctly cast damage spells when adjacent instead of kiting

### Ranger Fixed (2026-01-23)

Ranger went from 4.6 to 37.7 avg depth. Fixed by:
- **Root cause:** Dist 2 proactive repositioning (for casters) caused rangers to oscillate
- **Fix:** Only apply dist 2 kiting for casters (no bow); rangers shoot at dist 2 instead
- Rangers now use bow effectively at close range instead of futile kiting

Earlier ranger improvements (still active):
- Angband-style bow multipliers (×2/×3)
- Wolf summon integration (proactive summoning)
- Root shot before kiting (stun then retreat)
- New spells: Hunter's Mark, Camouflage, Summon Bear
- New bows: War Bow, Bow of the Serpent

---

## Known Issues

### Pure Casters Midgame (2026-01-23)

Mage, Archmage, Necromancer now at 12-15 avg depth (up from 5-6):
- Fixed the `hasRangedWeapon()` null vs undefined bug
- Casters now cast when adjacent instead of futile kiting
- Still need work to reach endgame (30+ depth)

Possible improvements:
- Better mana management
- Improved kiting at visibility boundaries
- Phase door usage optimization

### Endgame Circuit Breakers (2026-01-22)

30-56% CB rate at depth 32-50 for melee/hybrid classes:
- Bot may be oscillating between goals at high depths
- Pathfinding issues in complex late-game dungeons
- Decision paralysis with many options available

---

## Test Matrix Template

When testing a change:

```bash
# Baseline (seeded for reproducibility)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000

# With change (same seed for A/B comparison)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=30000 [flags]

# Verify no regression on warrior
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000 [flags]
```

**Parallel execution** (only run 2 classes simultaneously):
```bash
# Terminal 1
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=30000

# Terminal 2 (simultaneously)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --class=mage --max-upgrades --turns=30000
```

**Success criteria:**
- Target class improves by 1+ avg depth
- No regression on other classes
- Circuit breaker rate doesn't increase significantly

---

## Historical Baselines

### 2026-01-23 Post-Caster-Fix (50 runs, 30k turns)

| Class | Avg Depth | Max Depth | CB Rate | Kills |
|-------|-----------|-----------|---------|-------|
| Warrior | 40.8 | 50 | 38% | 406 |
| Mage | 14.8 | 25 | 8% | 391 |
| Necromancer | 14.7 | 25 | 0% | 388 |
| Archmage | 12.9 | 27 | 10% | 357 |
| Ranger | 5.0 | 22 | 0% | 55 |

### 2026-01-23 Post-Ranger-Fix (100 runs, 30k turns)

| Class | Avg Depth | Max Depth | CB Rate | Kills |
|-------|-----------|-----------|---------|-------|
| Warrior | 41.4 | 50 | 39% | 408 |
| Ranger | 41.0 | 50 | 30% | 516 |
| Paladin | 39.4 | 50 | 35% | 505 |
| Blackguard | 39.1 | 50 | 49% | 395 |
| Priest | 38.8 | 50 | 37% | 486 |
| Berserker | 38.4 | 50 | 56% | 379 |
| Rogue | 38.1 | 50 | 46% | 472 |
| Druid | 34.1 | 47 | 30% | 425 |
| Archmage | 5.9 | 15 | 2% | 208 |
| Necromancer | 5.5 | 13 | 13% | 197 |
| Mage | 4.9 | 11 | 2% | 168 |

### 2026-01-23 Pre-Ranger-Fix (100 runs, 30k turns)

| Class | Avg Depth | Max Depth | CB Rate | Kills |
|-------|-----------|-----------|---------|-------|
| Warrior | 41.7 | 50 | 43% | 411 |
| Priest | 39.1 | 50 | 31% | 490 |
| Blackguard | 39.0 | 50 | 49% | 395 |
| Paladin | 38.6 | 50 | 38% | 493 |
| Berserker | 38.5 | 50 | 46% | 383 |
| Rogue | 38.2 | 50 | 38% | 474 |
| Druid | 34.3 | 46 | 29% | 427 |
| Archmage | 5.9 | 15 | 2% | 208 |
| Ranger | 5.0 | 34 | 3% | 51 |
| Mage | 4.9 | 11 | 2% | 168 |
| Necromancer | 2.8 | 11 | 18% | 89 |

### 2026-01-22 Post-Refactor (30 runs, 25k turns)

| Class | Avg Depth | Max Depth | CB Rate | Kills |
|-------|-----------|-----------|---------|-------|
| Berserker | 42.4 | 50 | 37% | 436 |
| Paladin | 39.1 | 50 | 33% | 496 |
| Priest | 38.0 | 49 | 30% | 471 |
| Warrior | 36.5 | 50 | 50% | 350 |
| Blackguard | 36.0 | 50 | 50% | 357 |
| Rogue | 35.9 | 48 | 57% | 451 |
| Druid | 32.0 | 45 | 37% | 402 |
| Archmage | 4.7 | 9 | 3% | 176 |
| Ranger | 4.2 | 14 | 0% | 39 |
| Mage | 3.5 | 8 | 3% | 119 |
| Necromancer | 2.6 | 5 | 17% | 85 |

### 2026-01-22 Post-Caster Fix

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
