# Balance Test Plan

## Current State (2026-01-22)

### Class Performance (100 runs each, --max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Status |
|-------|-----------|-----------|---------|--------|
| **Berserker** | 12.5 | 14 | 4% | ✅ OK |
| **Warrior** | 9.7 | 11 | 3% | ✅ OK |
| **Blackguard** | 9.3 | 11 | 3% | ✅ OK |
| **Paladin** | 4.3 | 9 | 97% | ❌ BROKEN |
| **Priest** | 4.0 | 6 | 99% | ❌ BROKEN |
| **Druid** | 4.3 | 8 | 92% | ❌ BROKEN |
| **Rogue** | 4.3 | 8 | 96% | ❌ BROKEN |
| **Archmage** | 4.3 | 9 | 5% | ⚠️ Low depth |
| **Necromancer** | 4.0 | 7 | 4% | ⚠️ Low depth |
| **Mage** | 4.2 | 8 | 7% | ⚠️ Low depth |
| **Ranger** | 4.2 | 9 | 18% | ⚠️ Low depth |

### Key Findings

1. **Farming system blocking descent** - Paladin/Priest/Druid/Rogue stuck at depth 4 with 92-99% CB rates
2. **Berserker only improver** - 12.0 → 12.5 avg, only class that benefited from changes
3. **Casters dying early** - Low CB rates but very low depths; dying instead of getting stuck
4. **Melee still leads** - Berserker/Warrior/Blackguard are the only functional classes

### Comparison to Previous Baseline (2026-01-21)

| Class | Old Avg | New Avg | Old CB | New CB | Change |
|-------|---------|---------|--------|--------|--------|
| Berserker | 12.0 | 12.5 | 10% | 4% | ✅ +0.5 |
| Warrior | 12.0 | 9.7 | 7% | 3% | ⚠️ -2.3 |
| Blackguard | 11.4 | 9.3 | 8% | 3% | ⚠️ -2.1 |
| Paladin | 10.8 | 4.3 | 8% | 97% | ❌ -6.5 |
| Priest | 10.7 | 4.0 | 12% | 99% | ❌ -6.7 |
| Druid | 9.8 | 4.3 | 9% | 92% | ❌ -5.5 |
| Rogue | 9.6 | 4.3 | 12% | 96% | ❌ -5.3 |
| Archmage | 8.4 | 4.3 | 32% | 5% | ❌ -4.1 |
| Necromancer | 8.4 | 4.0 | 12% | 4% | ❌ -4.4 |
| Mage | 8.1 | 4.2 | 26% | 7% | ❌ -3.9 |
| Ranger | 8.1 | 4.2 | 11% | 18% | ❌ -3.9 |

---

## Diagnostic Tooling

```bash
# Quick single run
npx tsx scripts/diagnose.ts quick --seed=12345 --class=warrior

# Deep dive with turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior --map

# Batch testing (seeded for reproducibility)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000000 --class=warrior

# With balance overrides
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000000 --max-upgrades --monster-hp=50

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=500 --seed=1000000 --class=mage
```

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--max-upgrades` | off | Apply all upgrades at max (includes 25% bestiary) |
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

### Class Fixes

**Archmage (6.0 → 10.4 avg, later regressed to 8.4):**
- Phase Door at L1 (was L8)
- Teleport in CAUTION tier, not just DANGER

**Ranger (7.1 → 8.7 → 8.1 avg):**
- Wolf HP: 30 + level*2, with OOC regen
- Root shot and wolf resummon in CAUTION tier
- Speed potion for pre-combat kiting

---

## Known Issues

### Farming System Causing Mass Stuckness (2026-01-22)

After depth safety limits and farming overhaul, most classes are stuck at depth 4:

**Completely Broken (90%+ CB at depth 4):**
- Paladin (97% CB) - stuck farming, never descends
- Priest (99% CB) - stuck farming, never descends
- Druid (92% CB) - stuck farming, never descends
- Rogue (96% CB) - stuck farming, never descends

**Low Depth but Functional (dying early, not stuck):**
- Archmage (5% CB, 4.3 avg depth) - dies before progressing
- Necromancer (4% CB, 4.0 avg depth) - dies before progressing
- Mage (7% CB, 4.2 avg depth) - dies before progressing
- Ranger (18% CB, 4.2 avg depth) - mix of stuck and dying

**Root Cause:** The farming/depth safety system appears to be preventing non-Berserker classes from meeting descent criteria. Need to investigate:
1. What conditions trigger farming mode
2. Why Berserker escapes but others don't
3. Whether gold/level targets are unreachable for weaker classes

---

## Test Matrix Template

When testing a change:

```bash
# Baseline (seeded for reproducibility)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000000 --class=CLASS --max-upgrades

# With change (same seed for A/B comparison)
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000000 --class=CLASS --max-upgrades [flags]

# Verify no regression on warrior
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000000 --class=warrior --max-upgrades [flags]
```

**Success criteria:**
- Target class improves by 1+ avg depth
- No regression on other classes
- Circuit breaker rate doesn't increase

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate changes
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
