# Architecture

## System Overview

Borglike is a TypeScript roguelike with auto-play bot, designed for idle gameplay with meta-progression.

```
┌──────────────────────────────────────────────────────────────────────┐
│                           Browser (Main Thread)                       │
│                                                                       │
│  ┌─────────────┐    ┌─────────────────────────────────────────────┐ │
│  │   Sidebar   │    │              Run Area                        │ │
│  │             │    │  ┌─────────┐ ┌─────────┐ ┌─────────┐        │ │
│  │ - Essence   │    │  │  Run 1  │ │  Run 2  │ │  Run 3  │ ...    │ │
│  │ - Stats     │    │  │ ASCII   │ │ ASCII   │ │ ASCII   │        │ │
│  │ - Upgrades  │    │  │ Grid    │ │ Grid    │ │ Grid    │        │ │
│  │ - Unlocks   │    │  └─────────┘ └─────────┘ └─────────┘        │ │
│  └─────────────┘    └─────────────────────────────────────────────┘ │
│         │                              │                             │
│         └──────────────┬───────────────┘                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                     Pinia Stores                                 ││
│  │  ┌──────────────────┐  ┌──────────────────┐                     ││
│  │  │ useProgressionStore │  │ useRunsStore       │                     ││
│  │  │ - essence        │  │ - activeRuns     │                     ││
│  │  │ - unlocks        │  │ - game states    │                     ││
│  │  │ - upgrades       │  │ - bot configs    │                     ││
│  │  └──────────────────┘  └──────────────────┘                     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                        │                                             │
│                        ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                   Game Layer (src/game/)                        ││
│  │                                                                  ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             ││
│  │  │ GameRunner  │  │ Bot AI      │  │ Game Loop   │             ││
│  │  │ - step()    │  │ - decide()  │  │ - process() │             ││
│  │  │ - run()     │  │ - evaluate()│  │ - actions   │             ││
│  │  └─────────────┘  └─────────────┘  └─────────────┘             ││
│  │         │                │                │                      ││
│  │         └────────────────┼────────────────┘                      ││
│  │                          ▼                                       ││
│  │  ┌─────────────────────────────────────────────────────────┐    ││
│  │  │                  Core Systems                            │    ││
│  │  │  Character │ Dungeon │ Combat │ Monster AI │ Items      │    ││
│  │  └─────────────────────────────────────────────────────────┘    ││
│  │                          │                                       ││
│  │                          ▼                                       ││
│  │  ┌─────────────────────────────────────────────────────────┐    ││
│  │  │                  Game Data (src/game/data/)              │    ││
│  │  │  Races │ Classes │ Monsters │ Items │ Artifacts         │    ││
│  │  └─────────────────────────────────────────────────────────┘    ││
│  └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Game Turn Flow

```
User clicks "Start Run"
    │
    ▼
createGameRunner(config)
    │
    │ Creates GameState with:
    │ - Character (race/class)
    │ - Dungeon level
    │ - Monsters
    │ - Items
    │
    ▼
runner.step() called (per tick)
    │
    ├─► Bot AI decides action
    │   │
    │   └─► buildBotContext()
    │       decideAction()
    │       Returns: GameAction
    │
    ├─► processTurn(game, action)
    │   │
    │   ├─► Execute player action
    │   ├─► Process monster turns
    │   ├─► Check death/victory
    │   └─► Update FOV
    │
    └─► Returns: GameEvent[]
            │
            ▼
        UI updates via events
```

### Bot Decision Flow

```
buildBotContext()
    │
    │ Gathers:
    │ - Visible monsters
    │ - Visible items
    │ - Known stairs
    │ - Unexplored tiles
    │
    ▼
decideAction(context)
    │
    ├─► checkSurvival()     → Heal/retreat if needed
    │
    ├─► checkCombat()       → Attack adjacent, pursue (aggressive)
    │
    ├─► checkItems()        → Pickup valuables, equip upgrades
    │
    └─► checkExploration()  → Move to unexplored or stairs
            │
            ▼
        GameAction
```

### Event Flow (Game → UI)

```
Game action executed
    │
    ▼
GameEvent emitted
    │
    │ Types:
    │ - turn, move, attack
    │ - levelUp, itemPickup
    │ - depthChange, death, victory
    │
    ▼
onEvent callback (optional)
    │
    ▼
Pinia store update
    │
    ▼
Vue component re-render
```

## Module Structure

### Game Layer (`src/game/`)

```
src/game/
├── index.ts              # Barrel exports
├── types.ts              # All game types (Point, Tile, Character, etc.)
│
├── data/                 # Static game data
│   ├── index.ts          # Data exports
│   ├── races.ts          # 14 races (3 starting, 8 unlock, 3 prestige)
│   ├── classes.ts        # 11 classes
│   ├── monsters.ts       # 52 monster templates
│   ├── items.ts          # Equipment and consumables
│   └── artifacts.ts      # 12 artifacts
│
├── character.ts          # Character creation, stats, leveling
├── dungeon.ts            # Level generation (rot.js), FOV, pathfinding
├── combat.ts             # Attack resolution, damage calculation
├── monster-ai.ts         # Monster spawning, AI decisions, energy system
├── items.ts              # Item spawning, ground items, equipment
├── game-loop.ts          # Turn processing, action handlers
├── bot-ai.ts             # Auto-player decision making
└── game-runner.ts        # High-level game execution, batch runs
```

### Core Layer (`src/core/`)

```
src/core/
└── formulas.ts           # XP curves, cost scaling, essence calculation
```

### Future Layers (not yet implemented)

```
src/stores/               # Pinia stores
├── progression.ts        # Essence, upgrades, unlocks
├── runs.ts               # Active run states
└── settings.ts           # User preferences

src/ui/components/        # Vue components
├── AsciiGrid.vue         # rot.js display
├── RunPanel.vue          # Single run view
├── StatsPanel.vue        # Character stats
└── UpgradePanel.vue      # Upgrade UI
```

## Key Types

### GameState

```typescript
interface GameState {
  runId: string
  seed: number
  character: Character
  currentLevel: DungeonLevel
  levelCache: Map<number, DungeonLevel>
  monsters: Monster[]
  items: Item[]
  turn: number
  isRunning: boolean
  isPaused: boolean
  isVictory: boolean
  stats: RunStats
  messages: GameMessage[]
}
```

### GameAction

```typescript
type GameAction =
  | { type: 'move'; direction: Direction }
  | { type: 'attack'; targetId: string }
  | { type: 'pickup'; itemId: string }
  | { type: 'drop'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'unequip'; slot: EquipSlot }
  | { type: 'use'; itemId: string }
  | { type: 'descend' }
  | { type: 'ascend' }
  | { type: 'wait' }
```

### GameEvent

```typescript
type GameEvent =
  | { type: 'turn'; turn: number }
  | { type: 'move'; entityId: string; from: Point; to: Point }
  | { type: 'attack'; attackerId: string; defenderId: string; damage: number; killed: boolean }
  | { type: 'levelUp'; level: number }
  | { type: 'itemPickup'; item: Item }
  | { type: 'depthChange'; depth: number }
  | { type: 'death'; character: Character }
  | { type: 'victory' }
```

### BotPersonality

```typescript
type BotPersonality =
  | 'cautious'    // Retreats early, uses items freely
  | 'aggressive'  // Fights to low HP, hoards items
  | 'greedy'      // Prioritizes gold/items over safety
  | 'speedrunner' // Beelines for stairs
```

## External Dependencies

| Package | Purpose |
|---------|---------|
| **rot-js** | Dungeon generation, FOV, pathfinding |
| **vue** | UI framework (planned) |
| **pinia** | State management (planned) |

## Performance Considerations

### Current (Single Thread)

- Game logic runs on main thread
- `requestAnimationFrame` for tick timing
- Suitable for 1-2 runs at normal speed

### Future (Multi-Instance)

Options for 4 simultaneous runs:

1. **Time-sliced main thread** - Round-robin game ticks
2. **Web Workers** - One worker per game instance
3. **Headless turbo** - Skip rendering for background runs

### Memory

Each game instance holds:
- DungeonLevel (~80x40 tiles) per cached level
- ~20-50 monsters per level
- ~10-20 items per level
- Message history (capped at 100)

Estimated: ~1-2 MB per active run, manageable for 4 instances.
