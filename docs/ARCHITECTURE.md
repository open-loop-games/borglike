# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vue UI Layer                             │
│   RunPanel, DungeonGrid, UpgradeList, Sidebar, Feed, Modals     │
└────────────────────────────┬────────────────────────────────────┘
                             │ reactive bindings
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Pinia Stores                                │
│  ┌─────────────┐ ┌──────────┐ ┌────────────┐ ┌────────┐        │
│  │ progression │ │   runs   │ │ persistence│ │settings│        │
│  │ essence     │ │ grid[][] │ │ IndexedDB  │ │ prefs  │        │
│  │ upgrades    │ │ stats    │ │ auto-save  │ │        │        │
│  │ unlocks     │ │ state    │ │ backup     │ │        │        │
│  └─────────────┘ └──────────┘ └────────────┘ └────────┘        │
└────────────────────────────┬────────────────────────────────────┘
                             │ extracted metrics only
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Instance Manager                              │
│         (src/engine/instance-manager.ts)                        │
│  • Manages 1-4 game instances                                   │
│  • Tick loop (100ms base, 20ms turbo)                          │
│  • Syncs game state → stores                                    │
│  • Renders viewport (80x24)                                     │
│  • Auto-restart handling                                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ step()
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Game Runner                                 │
│              (src/game/game-runner.ts)                          │
│  • Orchestrates bot + turn processing                           │
│  • Tracks run state and stats                                   │
│  • Calculates essence on completion                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
┌──────────────────────┐        ┌──────────────────────┐
│      Bot AI          │        │     Game Loop        │
│  (src/game/bot/)     │        │ (src/game/game-loop) │
│                      │        │                      │
│  • Flow pathfinding  │        │  • Turn processing   │
│  • Danger grid       │        │  • Action handlers   │
│  • Goal selection    │        │  • Monster AI        │
│  • Class profiles    │        │  • Level management  │
│  • Survival logic    │        │  • Status effects    │
└──────────────────────┘        └──────────────────────┘
              │                              │
              └──────────────┬───────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Core Systems                                │
│  character.ts │ combat.ts │ dungeon/ │ items.ts │ monster-ai.ts │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Game Data                                   │
│        (src/game/data/)                                         │
│  races │ classes │ monsters │ items │ spells │ upgrades        │
│  boosters │ features │ merchants │ traps │ gold │ vaults       │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Turn Flow
```
Instance Manager tick()
    │
    ├─► runner.step()
    │       │
    │       ├─► Bot AI decides action (runBotTick)
    │       │       └─► buildContext → selectGoal → computeFlow → selectStep
    │       │
    │       └─► Game Loop processes turn (processTurn)
    │               ├─► Execute player action
    │               ├─► Process monster turns (energy-based)
    │               ├─► Tick status effects, poison, regen
    │               └─► Update FOV
    │
    ├─► updateRunFromGame()  →  runs store (stats, equipment)
    ├─► renderGameToGrid()   →  runs store (grid cells)
    └─► processMessages()    →  feed store (filtered messages)
```

### Run Completion Flow
```
Game ends (death/victory)
    │
    ├─► runner.getResult() calculates essence
    │
    ├─► handleRunCompletion()
    │       ├─► Convert to RunStats
    │       ├─► Apply prestige multiplier
    │       ├─► Check milestone unlocks
    │       └─► Record to stores
    │
    └─► Auto-restart check (if enabled)
```

## Key Patterns

### Two-Layer State
Full GameState stays in engine. Pinia stores hold extracted display data only. One-way flow prevents state sync issues.

### Energy-Based Speed
Monsters accumulate energy each player turn: `energy += (speed/110) * 100`. Act when `energy >= 100`. Fast monsters get multiple actions.

### Flow-Based Pathfinding
Reverse BFS from goal. Each tile stores distance. Bot follows decreasing costs. Cached for ~10 turns.

### Danger Grid
Per-tile threat score from nearby monsters. Distance falloff: 2x at monster → 0.2x at distance 4+. High danger tiles excluded from pathing.

### LRU Level Cache
Max 12 levels cached. Protects current depth ±1 from eviction. Prevents memory bloat.

### Persistence Strategy
- **Primary:** IndexedDB via `idb` library
- **Backup:** localStorage on `beforeunload`
- **Critical saves:** Immediate (essence, purchases)
- **Auto-save:** 500ms debounce
- **Recovery:** Compares `lifetimeEssence` to detect newer backup

## Module Structure

```
src/
├── engine/
│   └── instance-manager.ts    # Multi-run orchestration (685 lines)
│
├── game/
│   ├── bot/                   # Auto-player (17 files)
│   │   ├── index.ts           # Main decision loop
│   │   ├── types.ts           # Bot types
│   │   ├── goals.ts           # Goal selection
│   │   ├── danger.ts          # Threat calculation
│   │   ├── survival.ts        # Health/escape logic
│   │   ├── combat.ts          # Fight decisions
│   │   ├── exploration.ts     # Frontier detection
│   │   ├── flow.ts            # Reverse BFS
│   │   ├── movement.ts        # Step selection
│   │   ├── personality.ts     # 4 personalities
│   │   ├── class-profiles.ts  # 11 class behaviors
│   │   └── stuck.ts           # Anti-stuck recovery
│   │
│   ├── dungeon/               # Level generation (7 files)
│   │   ├── index.ts           # Main generator
│   │   ├── classic.ts         # rot.js Digger
│   │   ├── cavern.ts          # Cellular automata
│   │   ├── labyrinth.ts       # IceyMaze
│   │   ├── vaults.ts          # 21 templates
│   │   ├── doors.ts           # Door placement
│   │   └── profiles.ts        # Depth scaling
│   │
│   ├── data/                  # Static data (14 files)
│   │
│   ├── game-loop.ts           # Turn processing (688 lines)
│   ├── game-runner.ts         # Run orchestration
│   ├── character.ts           # Character creation
│   ├── combat.ts              # Attack resolution
│   ├── spell-resolution.ts    # Spell effects
│   ├── features.ts            # Fountains, altars, etc.
│   └── types.ts               # Game types
│
├── stores/
│   ├── progression.ts         # Meta-progression (612 lines)
│   ├── runs.ts                # Active run display
│   ├── persistence.ts         # IndexedDB layer (700 lines)
│   ├── settings.ts            # User preferences
│   └── feed.ts                # Event filtering
│
├── core/
│   ├── formulas.ts            # Progression math
│   └── run-completion-service.ts
│
└── ui/components/             # 24 Vue components
    ├── DungeonGrid.vue
    ├── RunPanel.vue
    ├── Sidebar.vue
    ├── game/
    ├── meta/
    ├── bestiary/
    ├── history/
    └── settings/
```

## External Dependencies

| Package | Purpose |
|---------|---------|
| rot-js | Dungeon generation (Digger, Cellular, IceyMaze), FOV, pathfinding |
| vue | UI framework |
| pinia | State management |
| idb | IndexedDB wrapper |
