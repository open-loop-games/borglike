---
name: diagnose
description: Investigate bot behavior issues. Use when user mentions "stuck", "oscillating", "jittering", performance problems, or wants to analyze/debug bot runs.
---

# Bot Diagnostic Toolkit

Unified CLI for investigating bot behavior issues in Borglike. Replaces 35+ individual diagnostic scripts with a single entry point.

## Seeds and Determinism

**The game engine is fully deterministic.** Given identical inputs (seed, race, class, personality, upgrades, balance), a run produces identical output every time. This enables:

- **Reproducibility**: Re-run the exact scenario that caused a bug, turn by turn
- **A/B testing**: Compare code changes on identical seed sets
- **Regression detection**: Known-good seeds that break indicate regressions

### Seed Generation in Batch Modes

Batch modes (`batch`, `find`, `compare`) generate sequential seeds from a starting point:

```
--seed=1000 --runs=5  →  seeds: 1000, 1001, 1002, 1003, 1004
```

Without `--seed`, the start is `Date.now()` — different each run. For reproducible A/B testing, always specify `--seed`:

```bash
# Before code change
npx tsx scripts/diagnose.ts batch --seed=1000 --runs=100 > before.txt

# After code change
npx tsx scripts/diagnose.ts batch --seed=1000 --runs=100 > after.txt

# Compare results on identical seeds
diff before.txt after.txt
```

### Workflow

1. **`find`** discovers problematic seeds from batch runs
2. **`deep`** analyzes a specific seed turn-by-turn
3. Fix code, then re-run **`deep`** on same seed to verify

## Quick Reference

```bash
npx tsx scripts/diagnose.ts [mode] [options]
```

### Modes

| Mode | Purpose | Example |
|------|---------|---------|
| `deep` | Full turn-by-turn analysis | `deep --seed=1768965560201 --map` |
| `quick` | Summary metrics only | `quick --seed=1768965560201` |
| `batch` | Aggregate statistics across runs | `batch --runs=100 --seed=1000` |
| `find` | Search for problematic seeds | `find --runs=500 --seed=1000` |
| `compare` | Compare across personalities | `compare --runs=20 --seed=1000` |
| `baseline` | Full baseline across all 11 classes | `baseline` (100 runs, 30k turns per class) |

### Seed Syntax

**Always use `--seed=N` flag syntax** (not positional arguments):

```bash
# Correct
npx tsx scripts/diagnose.ts deep --seed=1768965560201 --map
npx tsx scripts/diagnose.ts batch --seed=1000 --runs=100

# Wrong - don't use positional seeds
npx tsx scripts/diagnose.ts deep 1768965560201 --map
```

### Common Options

```
--seed=N          Specific seed to test
--turns=N         Max turns per run (default: 5000)
--runs=N          Runs for batch/find/compare (default: 50)
--threads=N       Worker threads (default: 8)
--personality=P   cautious|aggressive|greedy|speedrunner
--class=ID        warrior|mage|priest|rogue|ranger|necromancer|druid|paladin|monk|bard|warlock
--race=ID         human|elf|dwarf|halfling|gnome|half_orc|half_elf|kobold
--map             Include ASCII map (explored tiles)
--full-map        Include full map (all tiles revealed)
--from=N          Start turn for output (deep mode)
--to=N            End turn for output (deep mode)
--log-only        Only turn log, skip analyzers (deep mode)
--max-upgrades    Apply all upgrades at max level
--randomize       Randomize race/class/personality per run
```

## Diagnostic Workflow

**💡 For detailed navigation tips, grep patterns, and filtering strategies, see `references/navigation.md`**

### Investigating a Reported Issue

1. **Reproduce with deep mode**: Get full turn log for the problematic seed
   ```bash
   npx tsx scripts/diagnose.ts deep <seed> --map
   ```

2. **Narrow the turn range**: Focus on specific turns where issue occurs
   ```bash
   npx tsx scripts/diagnose.ts deep <seed> --from=500 --to=600
   ```

3. **Check specific analyzers**: Isolate the detection mechanism
   ```bash
   npx tsx scripts/diagnose.ts deep <seed> --analyzers=stuck,movement
   ```

### Finding New Issues

1. **Run batch search**: Find problematic seeds automatically
   ```bash
   npx tsx scripts/diagnose.ts find --runs=500
   ```

2. **Deep dive on flagged seeds**: Investigate each problem
   ```bash
   npx tsx scripts/diagnose.ts deep <flagged-seed> --map
   ```

### Comparing Bot Behavior

Compare performance across all personalities:
```bash
npx tsx scripts/diagnose.ts compare --runs=50
```

### Running a Full Baseline

Generate baseline metrics for all 11 classes (100 runs, 30k turns each):
```bash
npx tsx scripts/diagnose.ts baseline
```

Output includes a markdown table ready to paste into `docs/BALANCE-TEST-PLAN.md`. Classes tested: archmage, berserker, blackguard, druid, mage, necromancer, paladin, priest, ranger, rogue, warrior.

## Analyzers

| Name | Detects |
|------|---------|
| `stuck` | Repeated actions, waits, twitch counter, no-move streaks |
| `movement` | Oscillation (A-B-A-B), loops, move rate |
| `pathing` | Path efficiency, unreachable targets, goal completion |
| `exploration` | Stairs discovery, exploration %, frontier stagnation |
| `combat` | Damage, kills, retreats, death causes |
| `goal` | Goal lifecycle, persistence, type distribution |
| `goal-distance` | Short-distance goal thrashing |
| `oscillation` | Direction reversals, position revisits |
| `jitter` | Bot confined to small area (bounding box) |
| `frontier` | Frontier reachability, door blocking, goal generation failures |
| `stats` | Worker metrics aggregation (internal use) |
| `map` | Dungeon map snapshots |

## Turn Log Format

Actions include contextual details:
- `move:n`, `move:sw` - direction
- `attack:Floating Eye`, `ranged_attack:Kobold` - target
- `use:Potion of Cure Light Wounds` - item name
- `cast:fireball` - spell ID

Flags: `[MOVED]`, `[DAMAGE]`, `[DESCENDED]`, `[STUCK:N]`

## Issue Severity

- **error**: Critical (circuit breaker, death, unreachable stairs)
- **warning**: Potential issue (high stuck rate, oscillation, jitter)

Results include `hasErrors` and `hasWarnings` for quick checks.

## Balance Testing

Override balance parameters for testing:
```bash
npx tsx scripts/diagnose.ts batch --runs=100 \
  --monster-hp=80 --monster-damage=90 \
  --potion-rate=120 --max-upgrades
```

Tier 1: `--monster-hp`, `--monster-damage`, `--start-potions`, `--potion-rate`, `--regen`, `--armor-pen`
Tier 2: `--enchant-rate`, `--item-rate`, `--levelup-hp`
Tier 3: `--xp-rate`, `--upgrade-power`, `--bestiary`

## Extending the Toolkit

**Want to add a new analyzer or mode?** See `references/extending.md` for the complete guide on:
- Adding new analyzers with full lifecycle hooks
- Code structure and best practices
- Programmatic usage patterns
- Integrating new functionality into the CLI

The diagnostic toolkit is designed to be extended. All new functionality should be added to `scripts/lib/diagnose/` rather than the entrypoint.

## Additional Resources

### Reference Files

For detailed documentation:
- **`references/extending.md`** - Adding analyzers, modes, code structure, lifecycle hooks (read this first when extending!)
- **`references/navigation.md`** - Grep patterns, turn ranges, and workflow examples for navigating diagnostic output
