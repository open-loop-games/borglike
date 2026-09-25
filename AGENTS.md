# AGENTS.md

Repo conventions, harness-neutral — read this whether you are Claude Code, Codex, opencode
or anything else. `.claude/CLAUDE.md` imports this file rather than restating it, so this is
the one home for the content; edit here.

## Project Overview

Borglike is an idle/incremental game featuring an auto-playing roguelike. Watch up to 4 dungeon runs simultaneously, earn essence from deaths, unlock classes/races, and upgrade bot capabilities.

**Core Concept:** "Angband-lite as idle engine" - TypeScript roguelike designed for auto-play with meta-progression.
**Stack:** Vue 3 + TypeScript + Vite + Pinia + rot.js
**Documentation Level:** Minimal. Code is truth. Document decisions and gotchas only.
**Functional Core:** Separating your code into functional cores and imperative shells makes it more testable, maintainable, and adaptable. The core logic can be tested in isolation, and the imperative shell can be swapped out or modified as needed.

## Commands

```bash
pnpm run dev          # Dev server with HMR
pnpm run build        # Production build (typecheck + vite)
pnpm run preview      # Preview production build

pnpm run check        # Full check: typecheck + lint + format
pnpm run typecheck    # TypeScript check only
pnpm run lint         # ESLint check
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
├── game/            # Core roguelike engine (24 root files)
│   ├── bot/         # Angband-inspired auto-player (27 files)
│   ├── dungeon/     # Multiple generators (classic, cavern, labyrinth, vaults) (9 files)
│   └── data/        # Static data (races, classes, monsters, spells, items) (19 files)
├── stores/          # Pinia (progression, runs, persistence, settings, feed) (7 files)
├── core/            # Formulas, run-completion bridge
└── ui/components/   # Vue components (37 total)
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

**MUST NEVER NOT**
- Git revert or checkout without checking last commit time and diff for other work

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
- `docs/ANGBAND-LITE-DESIGN.md` - Game design (races, classes, balance)
- `docs/BALANCE.md` - Balance methodology, tooling, and baselines
- `docs/PERFORMANCE.md` - Performance profiling and optimization
- `TODO.md` - Current tasks and technical debt

## Git & Release Workflow

**Remotes:**
- `gitea` (primary) - Local Gitea, daily development target, configured as `remote.pushDefault`, full commit history
- `codeberg` (public) - https://codeberg.org/namahanna/borglike.git, clean snapshot releases only (always 1 orphan commit)

**Architecture:**
```
gitea/main:    [full commits of dev history] → [continuous development]
codeberg/main: [Single orphan commit: "Release v0.1.x"] ← always force-pushed
```

**Daily workflow:**
```bash
git push              # → gitea (default), full history preserved
```

**Release workflow (orphan snapshot):**
```bash
# 1. Bump version on main
pnpm version patch                    # → creates v0.1.x tag on main (gitea history)
git push gitea main --follow-tags     # → push to gitea with tag

# 2. Create clean orphan for codeberg
git checkout --orphan codeberg-release
git add -A
git commit -m "Release v0.1.x"
git push codeberg codeberg-release:main --force

# 3. Push tag and cleanup
git push codeberg v0.1.x
git checkout main
git branch -D codeberg-release
```

**Result:** Codeberg always shows single clean snapshot commit, no development history. Tags tell the version story.

**Pages:** Codeberg Pages serves the published snapshot at `https://namahanna.codeberg.page/borglike`. CI/deploy automation for Codeberg (Woodpecker) is TBD — the legacy `.github/workflows/deploy.yml` is obsolete and slated for replacement.

**Agent guidance:**
- Default `git push` always goes to gitea
- NEVER push main branch or development history to codeberg
- When asked to "release" or "publish version", follow the 3-step orphan workflow above
- Codeberg is public-facing snapshot only, gitea preserves full lineage

## Versioning

**Single source of truth:** `package.json` version, injected as `__APP_VERSION__` via Vite `define`. Used for save format version, UI display, and exports. Declared in `src/env.d.ts`.

**Save format:** Currently coupled to app version (`SAVE_VERSION = __APP_VERSION__`). Old saves warn on mismatch but still load. No migration system — break saves freely pre-1.0.

## Development Notes

- User runs dev server, HMR applies changes immediately
- Circuit breaker kills stuck bots after 1000 turns on same level
- Depth 0 = Town (safe zone, fixed layout)
- Victory = Kill "Morgoth, Lord of Darkness" at depth 50
