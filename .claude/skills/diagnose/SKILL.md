---
name: diagnose
description: This skill should be used when the user asks to "diagnose bot behavior", "debug the bot", "find stuck bots", "analyze bot runs", "run diagnostics", "check bot performance", "find problematic seeds", "compare personalities", or mentions bot issues like "stuck", "oscillating", "jittering", or "not progressing".
---

# Bot Diagnostic Toolkit

Unified CLI for investigating bot behavior issues in Borglike. Replaces 35+ individual diagnostic scripts with a single entry point.

## Quick Reference

Run diagnostics via:
```bash
npx tsx scripts/diagnose.ts [mode] [options]
```

### Modes

| Mode | Purpose | Example |
|------|---------|---------|
| `deep [seed]` | Full turn-by-turn log, all metrics, optional map | `deep 1768965560201 --map` |
| `quick [seed]` | Summary metrics only | `quick --seed=12345` |
| `batch` | Run N seeds, aggregate statistics | `batch --runs=100` |
| `find` | Search for seeds with issues | `find --runs=500` |
| `compare` | Compare behavior across personalities | `compare --runs=20` |

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

## Additional Resources

### Reference Files

For detailed documentation on extending the toolkit:
- **`references/extending.md`** - Adding new analyzers, code structure, lifecycle hooks
