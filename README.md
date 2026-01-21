# Borglike

An idle/incremental game featuring an auto-playing roguelike. Watch up to 4 dungeon runs simultaneously, earn essence from deaths, unlock classes/races, and upgrade your bot's capabilities.

**Core Concept:** "Angband-lite as idle engine" - A TypeScript roguelike inspired by Angband, designed from the ground up for auto-play and meta-progression.

## Features

- **Auto-Playing Roguelike** - Sophisticated bot AI with flow-based pathfinding, danger assessment, and class-specific tactics
- **Multi-Instance** - Run up to 4 simultaneous dungeon crawls
- **Meta-Progression** - Earn essence from deaths to unlock races, classes, and permanent upgrades
- **Prestige System** - Reset for multipliers (1.5x → 6x+)
- **21 Spells** across 4 schools (Arcane, Divine, Nature, Shadow)
- **50-Level Dungeon** with multiple generation styles (classic, cavern, labyrinth)
- **Vaults** - 21 special room templates with fountains, altars, merchants, traps

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Tech Stack

- Vue 3 + TypeScript + Vite + Pinia
- rot.js for dungeon generation and FOV
- IndexedDB for persistence

## Documentation

- [Development Plan](docs/PLAN.md) - Roadmap and phases
- [Architecture](docs/ARCHITECTURE.md) - System design
- [Game Design](docs/ANGBAND-LITE-DESIGN.md) - Races, classes, balance
- [Bot AI Design](docs/BOT-AI-PLAN.md) - Auto-player architecture
- [UI Design](docs/UI-PLAN.md) - Interface specifications

## License

MIT
