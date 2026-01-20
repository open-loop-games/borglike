# CLAUDE.md

**Project Phase:** Meta-Progression Complete (v0.2.0)

**Documentation Level:** Minimal. Code is truth. Document decisions and architecture only.

---

## What This Is

Borglike is an idle/incremental game featuring an auto-playing roguelike. Watch multiple dungeon runs simultaneously, earn essence from deaths, unlock classes/races, and upgrade your bot's capabilities.

**Core Concept:** "Angband-lite as idle engine" - A TypeScript roguelike inspired by Angband, designed from the ground up for auto-play and meta-progression.

**Inspiration:** A lost Java-era browser game (~2015-2018) that ran ASCII roguelikes automatically with meta-progression.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vite + Pinia
- **Game Engine:** Custom TypeScript roguelike using rot.js
- **AI:** Custom auto-player bot with configurable personalities
- **Rendering:** rot.js ASCII display (planned)

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Meta Progression (Pinia)                   │
│         (essence, unlocks, upgrades, achievements)           │
└─────────────────────────┬───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │  Run 1  │       │  Run 2  │       │  Run 3  │  (up to 4)
   │ Game +  │       │ Game +  │       │ Game +  │
   │  Bot    │       │  Bot    │       │  Bot    │
   └────┬────┘       └────┬────┘       └────┬────┘
        │ events          │                 │
        └─────────────────┴─────────────────┘
                          ▼
                    Vue UI (split view)
```

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Dev server
npm run build        # Production build
npm run preview      # Preview production build

# Run bot test
npx tsx scripts/test-bot.ts
```

## Path Aliases

- `@/*` → `src/*`
- `@stores/*` → `src/stores/*`
- `@types/*` → `src/types/*`
- `@game/*` → `src/game/*`
- `@core/*` → `src/core/*`
- `@ui/*` → `src/ui/*`

## Code Rules

### Naming
- Functions: `verbNoun` - `createRun`, `handleEvent`
- Types: PascalCase - `ActiveRun`, `GameEvent`
- Files: kebab-case.ts for modules, PascalCase.vue for components
- Stores: `use{Name}Store` pattern

### Must
- Type all game state explicitly
- Keep game instances isolated (no shared mutable state)
- Emit events for UI updates (don't poll)

### Must Not
- Block main thread with game logic (use requestAnimationFrame or workers for heavy computation)
- Store full game state in Pinia (only extracted stats for display)
- Over-engineer - keep the roguelike simple

## Key Directories

```
src/
├── game/               # Core roguelike logic (IMPLEMENTED)
│   ├── index.ts               # Barrel exports
│   ├── types.ts               # All game types + UpgradeBonuses
│   ├── data/                  # Static data
│   │   ├── races.ts           # 14 races
│   │   ├── classes.ts         # 11 classes
│   │   ├── monsters.ts        # 52 monsters
│   │   ├── items.ts           # Equipment & consumables
│   │   ├── artifacts.ts       # 12 artifacts
│   │   └── upgrades.ts        # 16 meta-progression upgrades
│   ├── character.ts           # Character creation (accepts upgradeBonuses)
│   ├── dungeon.ts             # Level generation (rot.js), FOV, pathfinding
│   ├── combat.ts              # Attack resolution, damage
│   ├── monster-ai.ts          # Monster spawning and AI
│   ├── items.ts               # Item spawning, equipment
│   ├── game-loop.ts           # Turn processing, applies XP multipliers
│   ├── bot-ai.ts              # Auto-player decision making
│   ├── game-runner.ts         # High-level game execution
│   └── upgrade-effects.ts     # Compute bonuses from upgrade levels
├── core/               # Meta-progression logic (IMPLEMENTED)
│   ├── formulas.ts            # XP curves, essence formulas, prestige
│   └── run-completion-service.ts  # Bridge game-runner → stores
├── stores/             # Pinia stores (IMPLEMENTED)
│   ├── progression.ts         # Essence, upgrades, unlocks, prestige
│   ├── runs.ts                # Active run tracking
│   └── persistence.ts         # IndexedDB save/load, auto-save
├── types/              # Shared TypeScript types
│   └── progression.ts         # Currency, UnlockState, RunStats, etc.
└── ui/components/      # Vue components (planned)

scripts/
├── test-bot.ts         # Bot AI test script
└── test-upgrades.ts    # Upgrade effects verification
```

## Documentation

- `docs/PLAN.md` - Development phases and roadmap
- `docs/ARCHITECTURE.md` - System diagrams and data flow
- `docs/ANGBAND-LITE-DESIGN.md` - Game design document (races, classes, items, balance)
- `docs/notes/` - Session handoffs and decision logs

## Development Phases

See `docs/PLAN.md` for detailed roadmap.

1. **Core Game** - Basic roguelike with rot.js ✅ COMPLETE
2. **Auto-Player** - Bot AI that plays the game ✅ COMPLETE
3. **Meta-Progression** - Essence, upgrades, unlocks, prestige ✅ COMPLETE
4. **UI Components** - Vue interface, rot.js display (next)
5. **Multi-Instance** - Support 1-4 simultaneous runs
6. **Polish** - Achievements, balance pass

## Current Status

**Phases 1-3 Complete.** The full backend is functional:

### Game Engine
- Dungeon generation with rot.js
- Character creation with races/classes
- Combat system with damage/armor/criticals
- Monster spawning and AI
- Item spawning and equipment
- Bot AI with 4 personalities

### Meta-Progression System
- **Essence**: Earned from deaths/victories using formula-based calculations
- **16 Upgrades**: Stats (vitality, might, resilience, swiftness), Borg AI, Meta (XP/gold/essence multipliers), QoL (turbo, auto-restart, run slots)
- **Upgrade Effects**: Applied to character creation and XP gains
- **Unlocks**: Races/classes via milestones, run slots via purchases
- **Prestige**: Reset upgrades for permanent essence multiplier (1.5x → 6x+)
- **Persistence**: IndexedDB with auto-save, export/import JSON

**Next:** Vue UI components and rot.js ASCII rendering.
