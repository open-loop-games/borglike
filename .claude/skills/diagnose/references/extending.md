# Extending the Diagnostic Toolkit

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

## Adding a New Analyzer

### Step 1: Create the Analyzer File

Create `scripts/lib/diagnose/analyzers/myanalyzer.ts`:

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

### Step 2: Export from Index

Update `analyzers/index.ts`:

```typescript
export { MyAnalyzer, createMyAnalyzer } from './myanalyzer'
export type { MyAnalyzerConfig } from './myanalyzer'

// Add to createAllAnalyzers() if it should run by default
// Add to createAnalyzers() factory map
```

### Step 3: Update CLI

Update `diagnose.ts`:
- Add to `ALL_ANALYZERS` array
- Update help text

## Analyzer Lifecycle

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

## Programmatic Usage

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

## TurnContext Properties

Available in `onTurn()`:
- `ctx.game` - Current GameState
- `ctx.botState` - Current BotState
- `ctx.action` - Action about to execute
- `ctx.turn` - Turn number

## PostTurnContext Properties

Available in `onPostTurn()`:
- All TurnContext properties plus:
- `ctx.moved` - Whether position changed
- `ctx.previousPosition` - Position before action
- `ctx.previousHP` - HP before action
- `ctx.previousDepth` - Depth before action

## EndReason Values

- `'death'` - Character died
- `'victory'` - Killed Morgoth
- `'max_turns'` - Hit turn limit
- `'circuit_breaker'` - Stuck detection triggered

## DiagnosticIssue Format

```typescript
interface DiagnosticIssue {
  severity: 'error' | 'warning'
  message: string
  turn?: number
  data?: Record<string, unknown>
}
```

## Metrics Best Practices

- Use descriptive metric names: `stuckRate`, `avgGoalDistance`
- Include counts and rates where applicable
- Add turn numbers to issues for debugging
- Keep summary concise but informative
