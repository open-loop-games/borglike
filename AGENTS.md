# AGENTS.md

Repo conventions — read this whether you are Claude Code, Codex, opencode
or anything else. `.claude/CLAUDE.md` imports this file rather than restating it, so this is
the one home for the content; edit here.

## Project Overview

Borglike is an idle/incremental game featuring an auto-playing roguelike. Watch up to 4 dungeon runs simultaneously, earn essence from deaths, unlock classes/races, and upgrade bot capabilities.

**Core Concept:** "Angband-lite as idle engine" - TypeScript roguelike designed for auto-play with meta-progression.
**Stack:** Vue 3 + TypeScript + Vite + Pinia + rot.js
**Documentation Level:** Minimal. Code is truth. Document decisions and gotchas only.
**Functional Core:** Functional core, imperative shell — game logic stays pure and testable in isolation; I/O, timers, and UI live in the shell.

## Commands

```bash
pnpm run dev          # Dev server with HMR
pnpm run build        # Production build (typecheck + vite)
pnpm run preview      # Preview production build

pnpm run check        # Full check: typecheck + lint + format
pnpm run typecheck    # TypeScript check only
pnpm run lint         # oxlint check
pnpm run format       # oxfmt write

pnpm run knip         # Find unused exports/dependencies
pnpm diagnose [mode]  # Bot diagnostics (deep, quick, batch, find, baseline)
```

## Tools Available
jq, bun

## Skills

- **`/diagnose`** - Bot diagnostic toolkit for investigating behavior issues. Modes: `deep`, `quick`, `batch`, `find`, `compare`. See `.claude/skills/diagnose/`.

## Path Aliases

```
@/*       → src/*           # General fallback (stores, types, core, engine, ui)
@game/*   → src/game/*      # Core roguelike engine
@bot/*    → src/game/bot/*  # Bot AI module (saves depth: src/game/bot/)
```

**Import rules:**
- `@game/` and `@bot/` for game engine and bot AI: `@game/types`, `@bot/flow`
- `@/` for everything else: `@/stores/progression`, `@/types/progression`, `@/core/formulas`
- Don't use `@/game/types` — use `@game/types` (the specific alias exists for a reason)
- Relative imports fine for same-module siblings: `./types`, `../common/ProgressBar.vue`
- Scripts use aliases too — except worker threads (see `scripts/lib/diagnose/config-parsing.ts`)

**Worker caveat:** Tinypool workers can't resolve path aliases at runtime. Shared code imported by workers must use relative paths for `src/` value imports. Type-only imports are fine (erased at compile time).

## Module Map

```
src/
├── engine/          # Instance manager (multi-run orchestration)
├── game/            # Core roguelike engine
│   ├── bot/         # Angband-inspired auto-player
│   ├── dungeon/     # Multiple generators (classic, cavern, labyrinth, vaults)
│   └── data/        # Static data (races, classes, monsters, spells, items)
├── stores/          # Pinia (progression, runs, persistence, settings, feed)
├── core/            # Formulas, run-completion bridge
└── ui/components/   # Vue components
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

**Conventions:**
- In Formula chains, floor with the DSL-native `.floor()` — keep it in the Formula tree; only `.toNumber()` at the call site when a plain number is needed.
- Name unexported module-level consts plainly; the module boundary is the privacy boundary. Reserve `_` prefix for genuinely unused params.
- Integrate new UI into existing components and patterns (a sub-category in the Upgrades tab, existing card components), not new top-level tabs or panels.
- Gate engine-primitive adoption (Formula, ModifierChain) on a full-path in-vivo benchmark of the realistic chain shape; microbenches inform expectations, not decisions.

**Before a git revert or checkout,** check the last commit time and the diff for other work.

## TSDoc Standards
**"Document the why and complex how, not the obvious what"**
- Focus on intent, design decisions, and non-obvious behavior. Keep documentation close to the code it describes.
- Make the tokens worth it, much code documents itself with context.

## Key Constraints

**Two-Layer State:** Full GameState lives in engine, Pinia stores hold extracted display metrics only. One-way flow: engine → stores → Vue.

**Persistence:** IndexedDB primary, localStorage backup on beforeunload. Critical saves immediate, others debounced 500ms.

**No Backwards Compat:** Solo dev project. Break saves, iterate fast, delete dead code.

**Dependency Direction:** `bot/` imports from `game/`, never reverse. AI decisions live in bot; mechanics live in game.

## Documentation

- `docs/ARCHITECTURE.md` - System design and data flow
- `docs/BALANCE.md` - Balance methodology, tooling, and baselines
- `docs/PERFORMANCE.md` - Performance profiling and optimization
- `TODO.md` - Current tasks and technical debt

## Git & Release Workflow

**Remotes:** `origin` is the development remote and holds the full history. Push only there. GitHub (`open-loop-games/borglike`) is a read-only push mirror of every branch and tag. The next sync overwrites anything committed or merged on GitHub, so changes from GitHub are applied on `origin`.

**Release:**
```bash
pnpm version patch                 # bumps package.json and creates the v0.1.x tag
git push origin main --follow-tags
```

The tag reaches GitHub through the mirror and runs `.github/workflows/deploy.yml`, which deploys to https://open-loop-games.github.io/borglike/. Start that workflow by hand from the Actions tab when one push carried more than three tags, because GitHub then fires no tag event. Separately, `.gitea/workflows/pages.yaml` deploys every push to `main` to a self-hosted Pages site.

Every job in `.github/workflows/` carries `if: github.server_url == 'https://github.com'`. The development remote runs `.github/workflows/` whenever `.gitea/workflows/` is absent, and the guard keeps those jobs off its runner.

## Versioning

**Single source of truth:** `package.json` version, injected as `__APP_VERSION__` via Vite `define`. Used for save format version, UI display, and exports. Declared in `src/env.d.ts`.

**Save format:** Currently coupled to app version (`SAVE_VERSION = __APP_VERSION__`). Old saves warn on mismatch but still load. No migration system — break saves freely pre-1.0.

## Development Notes

- User runs dev server, HMR applies changes immediately
- Circuit breaker kills stuck bots after 1000 turns on same level
- Depth 0 = Town (safe zone, fixed layout)
- Victory = Kill "Morgoth, Lord of Darkness" at depth 50
