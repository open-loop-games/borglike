# Migration Plan: Borglike 1.0 Release

Fresh repo under `Namahanna/borglike` on GitHub with clean history, updated identity, file cleanup, and GitHub Pages deployment.

**Target repo:** `https://github.com/Namahanna/borglike.git`
**Old repo:** `http://192.168.50.192:3000/admin/borglike.git` (Gitea, archive)

---

## 1. Archive Old Repo

- Tag current HEAD on Gitea: `git tag archive/pre-1.0`
- Push tag to old remote so it's findable later
- Old repo becomes read-only archive (don't delete — it has full blame history)

## 2. Fresh Git Init

```bash
# From working copy with all current files
rm -rf .git
git init
git remote add origin https://github.com/Namahanna/borglike.git
```

### Git Identity

```bash
git config user.name "Namahanna"
git config user.email "namahanna@gmail.com"
```

> **Note:** All old commits attributed to `aceofaces <aceofaces@gmail.com>` stay in the archived Gitea repo only. Fresh repo starts clean.

### Initial Commit Strategy

Single squash commit with everything, or logical initial commits:

- **Option A:** One commit: `Initial commit: Borglike 1.0`
- **Option B:** A few logical commits (engine, bot, UI, docs) for some navigable history

> Recommend **Option A** — it's a fresh start and the code is already mature.

---

## 3. .gitignore Updates

Current `.gitignore` plus new entries for the public repo:

```gitignore
# Existing (keep)
node_modules
dist
dist-ssr
*.local
*.log
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
.archive/

# New additions
.claude/*
!.claude/skills/          # Skills are useful, ship them
```

### What this means
- `.claude/settings.local.json` — gitignored (local permissions, not public)
- `.claude/skills/diagnose/` — tracked (useful dev tooling, ships with repo)
- `.archive/` — stays gitignored (old bot docs, caster tests)

---

## 4. File Cleanup

### 4a. Remove local path references

| File | Line | Change |
|------|------|--------|
| `CLAUDE.md:121` | `/work/temp/angband/` reference | Remove line (reference material doesn't ship) |
| `src/game/data/monsters.ts:4` | `Extracted from Angband 4.2.6 source: /work/temp/angband/...` | Change to `Extracted from Angband 4.2.6 source (monster.txt)` |

### 4b. Remove dead doc references

| File | Line | Issue |
|------|------|-------|
| `README.md:37-38` | Links to `docs/BOT-AI-PLAN.md` and `docs/UI-PLAN.md` | These are in `.archive/`, not `docs/` — remove or point to archive |
| `CLAUDE.md:107` | `See docs/BOT-AI-PLAN.md` | Same — remove or update |
| `docs/PLAN.md:56` | `See docs/BOT-AI-PLAN.md` | Same |
| `docs/PLAN.md:87` | `See docs/UI-PLAN.md` | Same |

### 4c. TODO.md cleanup

Current TODO has a lot of "Implemented (2026-01)" checklist history. For 1.0:
- Strip completed items (they're in git history / archived repo)
- Keep only open items and future features
- Rename sections to reflect 1.0 scope

### 4d. docs/ cleanup

| File | Action |
|------|--------|
| `docs/PLAN.md` | Update — phases 1-5 are complete, trim to current + future |
| `docs/ARCHITECTURE.md` | Marked "needs update" in CLAUDE.md — refresh or remove |
| `docs/ANGBAND-LITE-DESIGN.md` | Keep — core design reference |
| `docs/BALANCE-PASS-{1,2,3,4}.md` | Archive or remove — these are historical test results |
| `docs/BALANCE-TEST-PLAN.md` | Keep if still relevant, otherwise archive |
| `docs/BALANCE-TESTING-GUIDE.md` | Keep — methodology doc |
| `docs/PERFORMANCE.md` | Keep |
| `docs/TP-SCROLL-ISSUE.md` | Archive — bug investigation, historical |
| `docs/XP-CURVE-ANALYSIS.md` | Archive — historical analysis |
| `docs/MIGRATION-1.0.md` | This file — remove after migration complete |

> "Archive" means move to `.archive/` (gitignored, stays local).

---

## 5. package.json Updates

```jsonc
{
  "name": "borglike",
  "private": false,        // public repo now
  "version": "1.0.0",      // or 0.9.0 if not quite ready
  "description": "Idle/incremental game featuring an auto-playing roguelike",
  "author": "Namahanna",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Namahanna/borglike.git"
  },
  "homepage": "https://namahanna.github.io/borglike"
  // scripts, dependencies unchanged
}
```

---

## 6. Add LICENSE File

Create `LICENSE` in repo root — standard MIT license text with `Namahanna` as copyright holder.

Currently README says MIT but no LICENSE file exists.

---

## 7. README.md Rewrite

Current README is thin. For a public 1.0:

```markdown
# Borglike

Idle/incremental game featuring an auto-playing roguelike.

[screenshot or gif placeholder]

**Play now:** https://namahanna.github.io/borglike

## What is this?

Watch AI-controlled adventurers explore a 50-level dungeon inspired by Angband.
Earn essence from deaths, unlock races and classes, upgrade bot capabilities,
and run up to 4 simultaneous dungeon crawls.

## Features
- Auto-playing roguelike with class-specific AI (11 classes, 14 races)
- Multi-instance: 4 concurrent dungeon runs
- Meta-progression: essence → upgrades → better runs
- Prestige system with multipliers and prestige races
- 50-level dungeon with vaults, merchants, altars, traps
- 21 spells across 4 schools
- Sophisticated bot AI: pathfinding, danger assessment, kiting, farming

## Development
  pnpm install
  pnpm run dev      # http://localhost:5173

## Tech Stack
Vue 3 + TypeScript + Vite + Pinia + rot.js

## License
MIT
```

> Details like architecture docs, code rules, etc. stay in CLAUDE.md (dev-facing) and docs/ — README is player/visitor-facing.

---

## 8. CLAUDE.md Cleanup

Changes for 1.0:

| Section | Change |
|---------|--------|
| Documentation list | Remove `/work/temp/angband/` line |
| Documentation list | Remove or fix `BOT-AI-PLAN.md` reference |
| Module Map | Update file counts if they've drifted (bot is 27 files now, not 17; components ~35, not 24) |
| Bot AI reference | `See docs/BOT-AI-PLAN.md` → `See src/game/bot/CLAUDE.md` |
| Development Notes | Review for accuracy |

Everything else (code rules, constraints, path aliases, naming conventions) is solid — keep as-is.

---

## 9. GitHub Pages Deployment

Deploy the Vite build to `namahanna.github.io/borglike`.

### Option A: GitHub Actions (recommended)

`.github/workflows/deploy.yml`:
- Trigger on push to `main`
- Install pnpm, build with `pnpm run build`
- Deploy `dist/` to GitHub Pages

### Vite Config

Need `base` path for GitHub Pages subdirectory:

```typescript
// vite.config.ts
export default defineConfig({
  base: '/borglike/',
  // ... existing config
})
```

> **Important:** This changes asset paths. Local dev still works (Vite dev server handles it), but need to verify no hardcoded `/` asset paths exist.

### CNAME / Custom Domain

If you want a custom domain later, that's a separate step. Start with `namahanna.github.io/borglike`.

---

## 10. Execution Order

When ready to execute:

1. **Prep (in current repo, before git init)**
   - [ ] Tag and push archive tag to Gitea
   - [ ] Clean up files per sections 4a-4d
   - [ ] Update package.json (section 5)
   - [ ] Add LICENSE file (section 6)
   - [ ] Rewrite README.md (section 7)
   - [ ] Clean CLAUDE.md (section 8)
   - [ ] Update .gitignore (section 3)
   - [ ] Add vite `base: '/borglike/'` for GH Pages
   - [ ] Run `pnpm run check` to verify everything still builds

2. **Git init**
   - [ ] `rm -rf .git`
   - [ ] `git init`
   - [ ] Set git identity (Namahanna)
   - [ ] Initial commit
   - [ ] Add remote, push to GitHub

3. **GitHub setup**
   - [ ] Create repo on GitHub (public)
   - [ ] Push main branch
   - [ ] Add GitHub Actions workflow for Pages deploy
   - [ ] Enable Pages in repo settings (source: GitHub Actions)
   - [ ] Verify deployment at `namahanna.github.io/borglike`

4. **Post-migration**
   - [ ] Delete `docs/MIGRATION-1.0.md` (this file)
   - [ ] Verify old Gitea repo is intact as archive
   - [ ] Update any bookmarks/references

---

## Open Questions

- **Version:** Start at `1.0.0` or `0.1.0` (pre-release)? 0.1.0
- **Screenshot/GIF** for README — capture one before or after migration? After
- **Balance pass docs** — archive all 4, or keep the latest (BALANCE-TEST-PLAN.md)? merge historical
- **Custom domain** — plans for one, or `github.io` is fine for now? github.io is fine
