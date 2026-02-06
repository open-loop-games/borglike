# Codebase Cleanup Phases

Post-`resolveDefense()` unification audit. Issues grouped into phases by relatedness and complexity.

---

## Phase 1: Quick Wins

Trivial fixes — duplicate functions, dead code, hardcoded strings. Each is independent; can be done in any order.

### 1A. Extract `VICTORY_BOSS_NAME` to shared constant

**6 locations** hardcode `'Morgoth, Lord of Darkness'`:

| File | Line | Form |
|------|------|------|
| `src/game/monster-ai.ts` | 44 | `const VICTORY_BOSS_NAME = '...'` (local) |
| `src/game/actions/combat.ts` | 27 | `const VICTORY_BOSS_NAME = '...'` (local) |
| `src/game/bot/progression.ts` | 214 | raw string in `.some()` |
| `src/game/bot/survival-consumables.ts` | 187, 511 | raw string (2x) |
| `scripts/lib/diagnose/worker.ts` | 219 | raw string in stats lookup |

Also defined as template name in `data/monsters.ts:1626`.

**Fix:** Export `VICTORY_BOSS_NAME` from a shared location (e.g. `data/monsters.ts` or a constants file), import everywhere.

### 1B. Remove duplicate `rollDice()` from spell-resolution.ts

- **Canonical:** `src/game/dice.ts:21-38` — handles modifiers (`2d6+3`), `0d0` special case
- **Duplicate:** `src/game/spell-resolution.ts:233-243` — local, no modifier support, inline regex

**Fix:** Delete local `rollDice()`, import from `@game/dice`.

### 1C. Remove duplicate `parseDiceAverage()` (2 copies)

- **Canonical:** `src/game/dice.ts:50-59` — `getDiceAverage()`, handles modifiers
- **Duplicate 1:** `src/game/bot/items.ts:615-624` — no modifiers
- **Duplicate 2:** `src/game/modifiers/apply.ts:172-179` — no modifiers, uses `Math.floor`

**Fix:** Delete both locals, import `getDiceAverage` from `@game/dice`.

### 1D. Remove duplicate `hasCastableSpells()` / `canCastAnySpell()`

Both in `src/game/bot/spells.ts`, byte-for-byte identical:

```
hasCastableSpells()  — lines 909-912
canCastAnySpell()    — lines 917-920
```

Both do: `getAvailableSpells(character, turn).some(e => e.canCast)`.

**Fix:** Delete one, rename callers to the survivor.

### 1E. Inline speed calc should call existing function

In `src/game/monster-ai.ts`, `processMonsterTurns()` at line 714-718 manually calculates effective speed (slow debuff only), while `getMonsterEffectiveSpeed()` at line 586-602 in the **same file** handles both slow and haste.

```typescript
// Line 714-718 (inline, incomplete — misses haste):
const slowDebuff = monster.debuffs.find((d) => d.type === 'slow')
const effectiveSpeed = slowDebuff
  ? Math.floor((monster.template.speed * (100 - slowDebuff.value)) / 100)
  : monster.template.speed

// Line 586-602 (correct function):
export function getMonsterEffectiveSpeed(monster: Monster): number { ... }
```

**Fix:** Replace inline calc with `getMonsterEffectiveSpeed(monster)`. This also fixes the missing haste check.

### 1F. Remove dead A/B testing toggles

`src/game/bot/exploration.ts:1117-1120`:

```typescript
const USE_EXPLORATION_MODULE = true   // hardcoded
const USE_LABYRINTH_STRATEGY = true   // hardcoded
```

Lines 1146-1160 are a dead `else` branch (naive nearest-tile fallback) that can never execute.

**Fix:** Delete both constants, delete the dead else branch, keep the `if` body inline.

### 1G. Remove `resolveLegacyAttack()` fallback

`src/game/monster-combat.ts:317-330` — returns zero damage with comment "all monsters should now have attacks defined". Called at line 65 when `!attacks || attacks.length === 0`.

**Fix:** Replace with a warning log or assertion. All monster templates should have attacks.

---

## Phase 2: Resistance & Defense Unification

Continues the pattern from commit `531275c`. The core problem: `monster-spells.ts` has its own inline resistance logic that bypasses the unified `resolveDefense()`.

### 2A. Route monster spell damage through `resolveDefense()`

**Current:** `applyElementResistance()` at `src/game/monster-spells.ts:469-492` handles breath weapons (line 170) and bolt spells (line 223). It only checks permanent + temp resistance, capped at 90%.

**Missing vs `resolveDefense()` (`src/game/combat.ts:587-632`):**

| Defense Layer | resolveDefense() | applyElementResistance() |
|--------------|-----------------|------------------------|
| Armor reduction | Yes | No |
| Elemental resistance | Yes (perm + temp) | Yes (perm + temp) |
| Immunity (100+ resist = 0 dmg) | Yes | **No** |
| Protection from Evil | Yes (50% vs EVIL) | **No** |
| Knowledge bonuses | Yes | **No** |
| Min damage (1 unless immune) | Yes | **No** |

**Fix:** Delete `applyElementResistance()`, call `resolveDefense()` from `executeBreathWeapon()` and `executeBoltSpell()` instead. May need to decide whether armor applies to spells (possibly skip armor for spell damage via a flag, but keep all other layers).

### 2B. Consolidate element-to-resistance mapping

**4 mapping instances** across 2 files:

| Location | Maps | Notes |
|----------|------|-------|
| `combat.ts:572-575` | `elementToResistanceType()` | Canonical, only ELEC->LIGHTNING differs |
| `monster-spells.ts:470-477` | `resistMap` in `applyElementResistance` | Object literal, same mapping |
| `monster-spells.ts:143-150` | `elementMap` in `executeBreathWeapon` | Spell prefix -> Element (BR_FIRE -> FIRE) |
| `monster-spells.ts:207-212` | `elementMap` in `executeBoltSpell` | Spell prefix -> Element (BO_FIRE -> FIRE) |

The first two are pure duplicates. The last two are spell-prefix-to-element maps (different concern but could share a pattern).

**Fix:** Once 2A routes through `resolveDefense()`, the `resistMap` duplicate dies automatically. For spell prefix maps, consider a single `SPELL_ELEMENT_MAP` or leave as-is (they're small and local to their functions).

---

## Phase 3: Utility Consolidation

Repeated micro-patterns that should be shared utilities.

### 3A. Consolidate position comparison to one name

Three variants exist:

| Name | Location | Notes |
|------|----------|-------|
| `isSamePoint(a, b)` | `src/game/types.ts:83-85` | Canonical |
| `isSamePos(a, b)` | `src/game/bot/stuck.ts:477-479` | Local duplicate (same file imports `isSamePoint`!) |
| `isSamePosition` | `src/game/bot/movement.ts:13` | Re-export alias of `isSamePoint` |

Downstream consumers split between `isSamePoint` and `isSamePosition`:
- `bot/items.ts`, `bot/tier-actions.ts`, `bot/tick.ts` import `isSamePosition` from movement.ts

**Fix:** Delete `isSamePos` from stuck.ts (use the import it already has). Pick one name — `isSamePoint` is canonical — kill the re-export alias, update 3-4 imports.

### 3B. Extract `isMonsterAt()` utility

**10 occurrences** of `game.monsters.some(m => m.position.x === x && m.position.y === y && m.hp > 0)`:

| File | Occurrences |
|------|-------------|
| `bot/combat.ts` | 3 (lines 431, 597, 723) |
| `bot/survival-retreat.ts` | 4 (lines 317, 387, 697, 895) |
| `bot/stuck.ts` | 1 (line 227) |
| `bot/exploration.ts` | 1 (line 917) |
| `bot/spells.ts` | 1 (line 1307) |

**Fix:** Add `isMonsterAt(game: GameState, pos: Point): boolean` and `getMonsterAt(game: GameState, pos: Point): Monster | undefined` utilities. Replace inline checks.

### 3C. Extract explored tile counting utility

Full-level explored-tile counting appears in at least 2 places with identical double-nested loops:

- `src/game/bot/exploration.ts:144` — exploration rate calc
- `src/game/bot/survival-consumables.ts:659` — mapping scroll decision

Additional `tile?.explored` point-checks scattered in context.ts, tick.ts, etc. (those are fine as-is — they check single tiles, not count).

**Fix:** Extract `countExploredTiles(level: DungeonLevel): { explored: number, total: number }` to a shared location. Replace the two full-iteration sites.

### 3D. Add `damage_bonus` and `ac_bonus` to `StatusEffectType`

These are real runtime status effects but missing from the union in `src/game/types.ts:200-219`. This forces workarounds:

| File | Workaround |
|------|-----------|
| `combat.ts:657` | `e.type === ('damage_bonus' as never)` |
| `combat.ts:1084` | `e.type === ('damage_bonus' as never)` |
| `bot/spells.ts:348` | `statusEffects.map(e => e.type) as string[]` |
| `data/spells.ts:16` | Local type widening: `StatusEffectType \| 'ac_bonus' \| 'damage_bonus'` |

**Fix:** Add `'damage_bonus' | 'ac_bonus'` to the `StatusEffectType` union. Delete all `as never` casts and string workarounds.

---

## Phase 4: Structural Refactors

Larger changes — function decomposition, module splits, guard hoisting. Lower priority but improve long-term maintainability.

### 4A. Hoist golem `canCastSpells()` guard

`src/game/bot/spells.ts` checks `if (!canCastSpells(character)) return null` in all **14** public spell functions (lines 59, 205, 335, 475, 533, 565, 603, 692, 785, 875, 964, 1067, 1147, 1213).

**Fix:** Check once at the tier-action dispatch level (in `tier-actions.ts` before calling any spell function). Remove 14 redundant guards.

### 4B. Decompose `handleDangerTier()` and `handleCautionTier()`

`src/game/bot/tier-actions.ts`:
- `handleDangerTier()` — ~175 lines (lines 221-498), 8 priority steps with heavy class branching
- `handleCautionTier()` — ~200 lines (lines 506-714), significant overlap with DANGER tier's ranged logic

Steps 1 and 5-6 are nearly identical between both functions. The ranged-class block in DANGER (lines 234-354) is 120 lines alone.

**Fix:** Extract shared ranged-class logic into helpers (e.g. `tryRangedClassActions()`). Factor common steps into shared sub-functions.

### 4C. Remove `evaluateDanger()` deprecated wrapper

`src/game/bot/context.ts:334-360` — "Phase 1" stub that counts visible monsters with simple multipliers. Real system is `computeDangerGrid` in `danger.ts`. Still exported through `bot/index.ts:21` and called via `game-runner.ts:219` wrapper.

**Fix:** Check if `game-runner.ts` caller can switch to the real danger system, then delete `evaluateDanger()` and its exports.

### 4D. Consider splitting `monster-ai.ts` (971 lines)

Three distinct responsibilities in one file:
1. **Spawning** — monster placement, respawn, spawn caps
2. **AI decisions** — spell/attack/movement selection, detection/awareness
3. **Turn processing** — energy system, turn loop, speed calculations

Lower priority — the file is under the 1200-line threshold and well-organized within itself.

### 4E. Consider splitting `spell-resolution.ts` (1456 lines)

Above the 1200-line guideline. Contains all spell casting, target selection, beam mechanics, healing, buffing, debuffing, teleportation (3 variants), summoning, and lifedrain.

Teleportation logic (phase door, full teleport, shadow step, dimension door) could be its own module. Beam/AOE targeting could be separated.

Lower priority — only split if actively working in this file.
