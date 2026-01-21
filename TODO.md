# TODO

## Current Focus: Polish & Balance

### Active Work
- [ ] Balance pass on essence curves and upgrade costs
- [ ] Tune bot personalities for distinct playstyles
- [ ] Status effect implementation (debuffs currently cosmetic)

### Technical Debt
- [ ] Exploration short-distance goal thrashing (~2% circuit breaker rate)
  - Bot gets trapped in local exploration loops, picking nearby tiles instead of distant frontiers
  - Seed 1768974377494 reproduces: 1000 turns on depth 1, 51% explored, stairs not found
  - Potential fixes: frontier bias, longer goal persistence, better corridor-following
- [ ] Remove debug console.log statements
  - `src/game/bot/exploration.ts:330`, `src/game/bot/goals.ts:112`
  - `src/stores/progression.ts:516`, `src/App.vue:71`

### Prestige System (Not Implemented)

Prestige races/classes show as purchasable but unlock conditions are never validated.
The `unlockCondition` field is just a display string with no checking logic.

**Unlock Condition Validation** (`src/stores/progression.ts:216-242`)
- [x] Add `meetsCondition` check to `raceUnlocks` and `classUnlocks` computed properties
- [x] UI should disable purchase button when condition not met (`src/ui/components/meta/UnlockItem.vue`)

**Missing Stats Tracking** (for prestige conditions)
- [x] Track victories per race: `victoriesPerRace: Record<string, number>` in GlobalStats
- [x] Track victories per class: `victoriesPerClass: Record<string, number>` in GlobalStats
- [x] Add dragon kill aggregation query (bestiary has per-monster kills, need total dragons)
- [x] Update `run-completion-service.ts` to record race/class wins on victory

**Prestige Race Abilities** (defined in data but not implemented)
- [ ] Vampire `life_steal`: Melee attacks heal 20% of damage (`src/game/combat.ts`)
- [ ] Vampire `no_potions`: Block healing potion use (`src/game/actions/consumables.ts`)
- [ ] Golem `no_magic`: Block spell casting and scroll use (`src/game/spell-resolution.ts`, `consumables.ts`)
- [ ] Golem `slow_heal`: 50% healing rate modifier (`src/game/game-loop.ts`)
- [ ] Draconian `breath_weapon`: Cone AOE fire/cold/acid ability (new spell or action)
- [ ] Draconian `wings`: Fly over pits and water (`src/game/actions/movement.ts`)
- Vampire `light_vuln`: Works via resistance system (-100 LIGHT)
- Golem `construct` poison immunity: Works via resistance system (+100 POISON)
- Draconian `elem_resist`: Works via resistance system (+50 fire/cold/acid)

**Prestige Class Mechanics**
- [ ] Necromancer: Summoner behavior - raise slain monsters as allies (requires summoning system)
- [ ] Archmage: Glass cannon - prefer AOE spells in bot spell selection (`src/game/bot/spells.ts`)
- Berserker `neverRetreats`: Already implemented in `src/game/bot/goals.ts:139`

### Other Missing Systems
- [ ] Curse system (`src/game/features.ts:246` has TODO, altars show message but curses don't exist)
- [ ] Monster status effects (only debuffs exist, no status effect ticking for monsters)
- [ ] Trap status effects (traps apply poison but not other debuffs)

### Future Features
- [ ] Statistics dashboard

---

## Completed

### Phase 5: UI Polish (2025-01-20)
- [x] Bestiary modal with monster details
- [x] Run history modal with past runs
- [x] Loadout editor for boosters
- [x] Settings panel
- [x] Collapsible sections
- [x] Feed message filtering
- [x] Achievements system
- [x] Monster knowledge (cross-run bestiary bonuses)

### Phase 4: UI Components (2025-01-20)
- [x] Vue components for game display (24 components)
- [x] DungeonGrid ASCII renderer
- [x] RunPanel compact and expanded views
- [x] Essence/upgrade purchase interface
- [x] Unlock list for races/classes
- [x] Progress bars, panel frames

### Phase 3: Meta-Progression (2025-01-19)
- [x] Essence system with prestige multipliers
- [x] 16 upgrades (stats, borg, meta, qol)
- [x] Upgrade effects applied to gameplay
- [x] Unlock tree (races, classes, run slots)
- [x] Run completion service
- [x] IndexedDB persistence with auto-save
- [x] Prestige system (reset upgrades, keep unlocks)

### Phase 2: Auto-Player (2025-01-19)
- [x] Bot decision loop with priority layers
- [x] Flow-based pathfinding (reverse BFS)
- [x] Danger grid with threat assessment
- [x] Goal system (FLEE, KILL, TAKE, DESCEND, EXPLORE)
- [x] Survival logic (retreat, healing, escape)
- [x] Combat decisions with class profiles
- [x] 4 personalities + 11 class behavior profiles
- [x] Anti-stuck detection and recovery

### Phase 1: Core Game (2025-01-19)
- [x] Dungeon generation (classic, cavern, labyrinth)
- [x] 21 vault templates
- [x] Character creation (14 races, 11 classes)
- [x] Combat system with spells
- [x] 52 monsters + Morgoth boss
- [x] Items, equipment, artifacts
- [x] Fountains, altars, merchants, traps
- [x] 21 spells across 4 schools
