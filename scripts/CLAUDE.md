# Bot Diagnostic Toolkit

Unified CLI for diagnosing bot behavior issues. Replaces the previous 35+ individual diagnostic scripts.

## Quick Start

```bash
# Deep dive on a specific seed (full turn log + analysis)
npx tsx scripts/diagnose.ts deep 1768965560201

# Deep dive showing only turns 500-600
npx tsx scripts/diagnose.ts deep 1768965560201 --from=500 --to=600

# Quick check on a seed (summary only)
npx tsx scripts/diagnose.ts quick --seed=12345

# Find problematic seeds
npx tsx scripts/diagnose.ts find --runs=100

# Compare all personalities
npx tsx scripts/diagnose.ts compare --runs=20

# Show help
npx tsx scripts/diagnose.ts help
```

## Modes

| Mode | Purpose |
|------|---------|
| `deep [seed]` | Full turn-by-turn log, all metrics, optional map |
| `quick [seed]` | Summary metrics only |
| `batch` | Run N seeds, aggregate statistics |
| `find` | Search for seeds with issues |
| `compare` | Compare behavior across personalities |

## Turn Log Format (deep mode)

Actions include contextual details:
- `move:n`, `move:sw` - direction
- `attack:Floating Eye`, `ranged_attack:Kobold` - target monster name
- `use:Potion of Cure Light Wounds` - item name
- `cast:fireball` - spell ID

Flags: `[MOVED]`, `[DAMAGE]`, `[DESCENDED]`, `[STUCK:N]`

## Common Options

```
--seed=N          Specific seed
--turns=N         Max turns per run (default: 5000)
--runs=N          Runs for batch/find/compare (default: 50)
--threads=N       Worker threads for batch/find modes (default: 8)
--personality=P   cautious|aggressive|greedy|speedrunner
--class=ID        warrior|mage|priest|rogue|ranger|necromancer|druid|paladin|monk|bard|warlock
--race=ID         human|elf|dwarf|halfling|gnome|half_orc|half_elf|kobold
--map             Include ASCII map showing explored tiles (deep mode only)
--full-map        Include full ASCII map with all tiles revealed (deep mode only)
--from=N          Start of turn range for output (deep mode only)
--to=N            End of turn range for output (deep mode only)
--log-only        Only show turn log, skip analyzer output (deep mode)
--analyzers=A,B   Subset of analyzers (stuck,movement,pathing,exploration,combat,goal,goal-distance,oscillation,jitter,map)
```

## Analyzers

| Name | Detects |
|------|---------|
| `stuck` | Repeated actions, waits, twitch counter, no-move streaks |
| `movement` | Oscillation (A-B-A-B), loops, move rate |
| `pathing` | Path efficiency, unreachable targets, goal completion |
| `exploration` | Stairs discovery, exploration %, level metrics, frontier stagnation |
| `combat` | Damage, kills, retreats, death causes |
| `goal` | Goal lifecycle, persistence, type distribution, switch rate |
| `goal-distance` | Short-distance goal thrashing, avg distance per goal type |
| `oscillation` | Direction reversals, position revisits, ping-pong patterns |
| `jitter` | Bot confined to small area (bounding box analysis) |
| `map` | Dungeon map snapshots (use `--map` flag) |

## Code Structure

```
scripts/
├── diagnose.ts              # CLI entry point
└── lib/diagnose/
    ├── index.ts             # Main exports
    ├── types.ts             # Analyzer interface, config types
    ├── runner.ts            # Game loop with analyzer hooks
    ├── output.ts            # Formatting utilities
    └── analyzers/
        ├── index.ts         # Factory functions
        ├── stuck.ts
        ├── movement.ts
        ├── pathing.ts
        ├── exploration.ts   # Includes frontier tracking
        ├── combat.ts
        ├── goal.ts
        ├── goal-distance.ts # Detects short-distance goal thrashing
        ├── oscillation.ts   # Detects directional oscillation
        ├── jitter.ts
        ├── map.ts
        └── personality.ts   # Cross-personality comparison
```

## Extending the Toolkit

### Adding a New Analyzer

1. Create `scripts/lib/diagnose/analyzers/myanalyzer.ts`:

```typescript
import type { Analyzer, AnalyzerResult, TurnContext, PostTurnContext } from '../types'
import type { GameState } from '../../../../src/game/types'
import type { BotState } from '../../../../src/game/bot/types'

export interface MyAnalyzerConfig {
  threshold: number
}

export class MyAnalyzer implements Analyzer {
  readonly name = 'myanalyzer'
  private config: MyAnalyzerConfig
  private issues: DiagnosticIssue[] = []
  // ... tracking state

  constructor(config: Partial<MyAnalyzerConfig> = {}) {
    this.config = { threshold: 10, ...config }
  }

  onStart(game: GameState, botState: BotState): void {
    // Initialize tracking state
  }

  onTurn(ctx: TurnContext): void {
    // Called before action is processed
    // ctx.game, ctx.botState, ctx.action, ctx.turn
  }

  onPostTurn(ctx: PostTurnContext): void {
    // Called after action is processed
    // ctx.moved, ctx.previousPosition, ctx.previousHP, ctx.previousDepth
  }

  onLevelChange(game: GameState, oldDepth: number, newDepth: number): void {
    // Called when depth changes
  }

  onEnd(game: GameState, reason: EndReason): void {
    // Called when run ends ('death' | 'victory' | 'max_turns' | 'circuit_breaker')
  }

  summarize(): AnalyzerResult {
    return {
      name: this.name,
      metrics: { /* key-value pairs */ },
      issues: this.issues,
      details: [ /* human-readable strings */ ],
    }
  }
}

export function createMyAnalyzer(config?: Partial<MyAnalyzerConfig>): MyAnalyzer {
  return new MyAnalyzer(config)
}
```

2. Export from `analyzers/index.ts`:

```typescript
export { MyAnalyzer, createMyAnalyzer } from './myanalyzer'
export type { MyAnalyzerConfig } from './myanalyzer'

// Add to createAllAnalyzers() if it should run by default
// Add to createAnalyzers() factory map
```

3. Update CLI if needed (`diagnose.ts`):
   - Add to `ALL_ANALYZERS` array
   - Update help text

### Analyzer Lifecycle

```
onStart()           # Once at run start
  ↓
┌─────────────────┐
│ onTurn()        │  # Before action
│ [action runs]   │
│ onPostTurn()    │  # After action
│ onLevelChange() │  # If depth changed
└────────┬────────┘
         │ (repeat until end)
         ↓
onEnd()             # Once at run end
summarize()         # Generate report
```

### Programmatic Usage

```typescript
import {
  runDiagnosis,
  runDeepDiagnosis,
  runBatchDiagnosis,
  createAllAnalyzers,
  createAnalyzers,
  formatResult,
  comparePersonalities,
} from './lib/diagnose'

// Single run
const result = runDiagnosis({
  seed: 12345,
  personality: 'aggressive',
  maxTurns: 1000,
  analyzers: createAllAnalyzers(),
})

console.log(result.hasErrors)  // Quick check
console.log(formatResult(result))  // Full output

// Deep dive with turn log
const deep = runDeepDiagnosis({ seed: 12345, analyzers: createAllAnalyzers() })
console.log(deep.turnLog)  // Array of TurnLogEntry

// Batch
const batch = runBatchDiagnosis({ runs: 100, personality: 'cautious' })
console.log(batch.aggregateMetrics)
console.log(batch.problemRuns)

// Personality comparison
const compare = comparePersonalities({ runsPerPersonality: 20 })
console.log(compare.distinctiveness.score)
```

## Issue Severity

- **error**: Critical problem (circuit breaker, death, unreachable stairs)
- **warning**: Potential issue (high stuck rate, oscillation, jitter)

Issues are collected in `result.allIssues` and `result.hasErrors`/`result.hasWarnings` for quick checks.
