# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Borglike is an idle/incremental game featuring an auto-playing roguelike. Watch up to 4 dungeon runs simultaneously, earn essence from deaths, unlock classes/races, and upgrade bot capabilities.

**Core Concept:** "Angband-lite as idle engine" - TypeScript roguelike designed for auto-play with meta-progression.
**Stack:** Vue 3 + TypeScript + Vite + Pinia + rot.js
**Documentation Level:** Minimal. Code is truth. Document decisions and gotchas only.
**Functional Core:** Separating your code into functional cores and imperative shells makes it more testable, maintainable, and adaptable. The core logic can be tested in isolation, and the imperative shell can be swapped out or modified as needed.

## Commands

```bash
npm run dev          # Dev server with HMR
npm run build        # Production build
```

## Skills

- **`/diagnose`** - Bot diagnostic toolkit for investigating behavior issues. Modes: `deep`, `quick`, `batch`, `find`, `compare`. See `.claude/skills/diagnose/`.

## Path Aliases

- `@/*` → `src/*`
- `@game/*` → `src/game/*`
- `@stores/*` → `src/stores/*`
- `@ui/*` → `src/ui/*`

## Module Map

```
src/
├── engine/          # Instance manager (multi-run orchestration)
├── game/            # Core roguelike engine
│   ├── bot/         # Angband-inspired auto-player (17 files)
│   ├── dungeon/     # Multiple generators (classic, cavern, labyrinth, vaults)
│   └── data/        # Static data (races, classes, monsters, spells, items)
├── stores/          # Pinia (progression, runs, persistence, settings, feed)
├── core/            # Formulas, run-completion bridge
└── ui/components/   # Vue components (24 total)
```

## Code Rules

**Naming:**
- Functions: `verbNoun` (`createRun`, `handleEvent`)
- Types: PascalCase (`ActiveRun`, `GameEvent`)
- Files: kebab-case.ts, PascalCase.vue
- Stores: `use{Name}Store`

**Must:**
- Type all game state explicitly
- Keep game instances isolated (no shared mutable state)
- Emit events for UI updates (don't poll)

**Must Not:**
- Block main thread (use requestAnimationFrame for heavy work)
- Store full game state in Pinia (only extracted stats)
- Over-engineer the roguelike

## File Size Guidelines
**Based on this philosophy:**
- ✅ 300-600 lines - Sweet spot for domain module
- ⚠️ 600-900 lines - Getting large, but OK if well-organized
- ❌ 900+ lines - Time to split by subdomain
- Organization matters more than size
- For AI codebases, fewer, larger files makes it easier to grasp the codebase and style quickly

## TSDoc Standards
**"Document the why and complex how, not the obvious what"**
- Focus on intent, design decisions, and non-obvious behavior. Keep documentation close to the code it describes.
- Make the tokens worth it, much code documents itself with context.

## Key Constraints

**Two-Layer State:** Full GameState lives in engine, Pinia stores hold extracted display metrics only. One-way flow: engine → stores → Vue.

**Bot AI:** Angband-inspired with flow-based pathfinding, danger grids, goal persistence, and 11 class-specific behavior profiles. See `docs/BOT-AI-PLAN.md`.

**Persistence:** IndexedDB primary, localStorage backup on beforeunload. Critical saves immediate, others debounced 500ms.

**No Backwards Compat:** Solo dev project. Break saves, iterate fast, delete dead code.

**Dependency Direction:** `bot/` imports from `game/`, never reverse. AI decisions live in bot; mechanics live in game.

## Documentation

- `docs/PLAN.md` - Roadmap and phase tracking
- `docs/ARCHITECTURE.md` - System diagrams (needs update)
- `docs/BOT-AI-PLAN.md` - Bot AI design
- `docs/UI-PLAN.md` - UI design system
- `docs/ANGBAND-LITE-DESIGN.md` - Game design (races, classes, balance)
- `TODO.md` - Current tasks and technical debt

## Development Notes

- User runs dev server, HMR applies changes immediately
- Circuit breaker kills stuck bots after 1000 turns on same level
- Depth 0 = Town (safe zone, fixed layout)
- Victory = Kill "Morgoth, Lord of Darkness" at depth 50
