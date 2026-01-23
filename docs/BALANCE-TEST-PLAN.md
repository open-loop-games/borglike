# Balance Test Plan

## Current State (2026-01-22, Post-Caster Fix)

### Class Performance (50-100 runs each, 50k turns, --max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Kills | Status |
|-------|-----------|-----------|---------|-------|--------|
| **Berserker** | 40.1 | 50 | 43% | 519 | ✅ Endgame |
| **Blackguard** | 40.0 | 50 | 47% | 498 | ✅ Endgame |
| **Paladin** | 39.7 | 50 | 43% | 525 | ✅ Endgame |
| **Warrior** | 39.5 | 50 | 40% | 514 | ✅ Endgame |
| **Rogue** | 39.5 | 50 | 44% | 537 | ✅ Endgame |
| **Priest** | 38.8 | 50 | 33% | 503 | ✅ Endgame |
| **Druid** | 36.2 | 49 | 24% | 490 | ✅ Endgame |
| **Necromancer** | 12.3 | 19 | 6% | 49 | ⚠️ Mid-game |
| **Mage** | 8.8 | 14 | 4% | 27 | ⚠️ Early-mid |
| **Archmage** | 6.6 | 13 | 8% | 19 | ⚠️ Early-mid |
| **Ranger** | 5.5 | 35 | 1% | 62 | ⚠️ Weak |

### Key Findings

1. **Melee/hybrid classes reach endgame** - 7 classes averaging depth 36-40, regularly killing Morgoth
2. **Casters now functional** - Mage/Archmage/Necromancer progress to depth 6-12 (was 2), natural deaths
3. **Stair surfing fix worked** - Disabling early-game stair surfing for casters prevents farming loop trap
4. **Ranger still weak** - Needs separate investigation
5. **Morgoth kills observed** - Berserker (8), Warrior (6), Blackguard (4), Paladin (3), others sporadic

### Caster Fix Details (2026-01-22)

**Problem:** Stair surfing (ascending to reset level for farming) trapped casters in endless loops:
- Mages need `level >= depth + 5` to descend
- At depths 1-2, XP too slow to level up
- Stair surfing kept them "alive" but prevented progression
- Eventually died to attrition without meaningful progress

**Solution:** Disable `ASCEND_TO_FARM` for SQUISHY classes (mage, archmage, necromancer) below level 15.
Angband borg-inspired: casters don't stair scum in early game - they explore fully and level naturally.

**Results:**

| Class | Before | After | Improvement |
|-------|--------|-------|-------------|
| Mage | 2.0 | 8.8 | +6.8 (4.4x) |
| Archmage | 2.0 | 6.6 | +4.6 (3.3x) |
| Necromancer | 2.0 | 12.3 | +10.3 (6x) |

### Top Killers by Class Tier

**Endgame classes (depth 36-40):**
- 7-Headed Hydra, Undead Beholder, Beholder, Mature Green Dragon, Cyclops, Nalfeshnee

**Casters (depth 6-12):**
- Baby Multi-Hued Dragon, Cave Orc, Orc Warrior, Giant Spider

### Comparison to Pre-Combat Rework Baseline

| Class | Old Avg | New Avg | Old CB | New CB | Change |
|-------|---------|---------|--------|--------|--------|
| Berserker | 12.5 | 40.1 | 4% | 43% | ✅ +27.6 |
| Warrior | 9.7 | 39.5 | 3% | 40% | ✅ +29.8 |
| Blackguard | 9.3 | 40.0 | 3% | 47% | ✅ +30.7 |
| Paladin | 4.3 | 39.7 | 97% | 43% | ✅ +35.4 |
| Priest | 4.0 | 38.8 | 99% | 33% | ✅ +34.8 |
| Druid | 4.3 | 36.2 | 92% | 24% | ✅ +31.9 |
| Rogue | 4.3 | 39.5 | 96% | 44% | ✅ +35.2 |
| Necromancer | 4.0 | 12.3 | 4% | 6% | ✅ +8.3 |
| Mage | 4.2 | 8.8 | 7% | 4% | ✅ +4.6 |
| Archmage | 4.3 | 6.6 | 5% | 8% | ✅ +2.3 |
| Ranger | 4.2 | 5.5 | 18% | 1% | ⚠️ +1.3 |

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
- Run 2 batch commands in parallel for best throughput (16 total threads)
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

### Farming System Blocking Descent (FIXED)

Previously, Paladin/Priest/Druid/Rogue were stuck at depth 4 with 92-99% CB rates due to farming system preventing descent. This is now resolved - all 4 classes reach avg depth 36-40.

### Caster Stair Surfing Trap (FIXED 2026-01-22)

Casters (mage, archmage, necromancer) were trapped in endless stair-flipping loops between depths 1-2:
- Needed `level >= depth + 5` to progress (SQUISHY class tier)
- Stair surfing reset monsters, but XP gains at depth 1-2 too slow to level up
- Result: 10,000+ turns at depth 2 before dying to attrition

**Fix:** Disable `ASCEND_TO_FARM` for SQUISHY classes below level 15 (Angband borg-inspired).
Casters now explore fully and level naturally instead of stair scumming.

**Code:** `src/game/bot/goal-evaluators.ts` - added `SQUISHY_CLASSES` check in `evaluateAscendToFarm()`

### Dungeon Generation Improvements

Circuit breaker rate reduced from 16% to 7-10% through dungeon generation fixes.

**Fix 1: Room-based stair placement**
- Stairs placed at room centers instead of random floor tiles
- Up-stairs in leftmost room, down-stairs in rightmost room
- Creates natural west-to-east flow

**Fix 2: Custom labyrinth generator**
- Replaced rot.js IceyMaze which created tiny clustered rooms
- Anchor rooms in opposite quadrants (top-left, bottom-right guaranteed)
- L-shaped corridors connect rooms before maze fill
- 8% shortcut rate reduces dead ends

**Fix 3: Cavern quadrant detection**
- `findOpenAreas()` finds best floor cluster in each map quadrant
- Ensures stair placement candidates spread across connected caverns

---

## Known Issues

### Casters Still Weaker Than Melee (2026-01-22)

After the stair surfing fix, casters now progress (avg 6-12 depth vs 2 before) but still underperform melee classes (avg 36-40). This is expected - casters are inherently squishier and our bot AI doesn't optimize spell usage yet.

**Future improvements to consider:**
1. Better kiting behavior for ranged casters
2. Mana-based retreat triggers (Angband borg uses 10-20% mana thresholds)
3. Defense-first spell priority (shields before heals)
4. Smarter spell selection based on monster type

### Ranger Still Weak (2026-01-22)

Ranger improved slightly (4.2 → 5.5 avg) but still underperforming:
- Max depth 35 shows potential exists
- 1% CB rate means dying, not stuck
- Top killers are early-game mobs (White Jelly, Centipede, Cave Spider)

### Endgame Circuit Breakers (2026-01-22)

33-47% CB rate at depth 40+ for melee/hybrid classes. This is a "good problem" compared to the old depth-4 stuckness, but worth investigating:
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

**Parallel execution** (run 2 classes simultaneously):
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
