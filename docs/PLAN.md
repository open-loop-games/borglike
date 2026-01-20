# Borglike Development Plan

## Vision

An idle game featuring an auto-playing roguelike. Watch a bot explore dungeons, collect loot, and inevitably die. Earn essence from each run to unlock new classes, races, and upgrades. Eventually run 4 simultaneous adventures.

## Architecture Decisions

### What We Keep From Angband

- Races with meaningful stat differences
- Classes with different playstyles
- Deep dungeon (50 levels)
- Item tiers and equipment slots
- Monster variety scaling with depth
- Permadeath with meta-progression

### What We Simplify

- No complex spell system (just abilities)
- No ego items / randarts (tiered loot + fixed artifacts)
- No shops / town (or minimal)
- Fewer resistance types
- ~40-50 monsters instead of 100+
- 50 levels instead of 100

### Tech Stack

- **rot.js** - Dungeon generation, FOV, pathfinding, display
- **Vue 3 + Pinia** - UI and state management
- **TypeScript** - Type safety for game logic
- **Vite** - Build tooling

---

## Phase 1: Core Game ✅ COMPLETE

**Goal:** Playable roguelike with manual controls (bot comes later).

### Tasks

1. **Project Setup** ✅
   - Install rot.js
   - Set up game module structure
   - Basic ASCII rendering

2. **Dungeon Generation** ✅
   - rot.js Digger for rooms + corridors
   - Stairs up/down placement
   - 50 depth levels

3. **Character System** ✅
   - Race selection (14 races total)
   - Class selection (11 classes total)
   - Stats: STR, INT, WIS, DEX, CON
   - HP, MP, XP, Level

4. **Movement & FOV** ✅
   - 8-directional movement
   - rot.js FOV calculation
   - Explored vs visible tiles

5. **Combat** ✅
   - Melee attack resolution
   - Damage calculation (weapon + stats + armor)
   - Critical hits, death handling

6. **Monsters** ✅
   - Spawn by depth (52 monster types)
   - AI with detection, pathfinding, energy system
   - Uniques and boss (Morgoth)

7. **Items** ✅
   - Equipment slots (11 slots)
   - All 4 tiers of equipment
   - Potions, scrolls, artifacts (12)

### Deliverable
Playable roguelike: move, fight, equip, die. ✅

---

## Phase 2: Auto-Player ✅ COMPLETE

**Goal:** Bot plays the game automatically.

### Tasks

1. **Bot Decision Loop** ✅
   - Evaluate current state (buildBotContext)
   - Choose action (move, attack, use item, descend)
   - Priority-based decisions

2. **Survival Logic** ✅
   - HP threshold for healing (personality-based)
   - Retreat when overwhelmed
   - Teleport scroll escape

3. **Exploration** ✅
   - Pathfind to unexplored areas
   - Prioritize stairs (speedrunner personality)

4. **Combat Decisions** ✅
   - Engage when advantageous
   - Target selection (weakest first)
   - Aggressive personality seeks fights

5. **Item Management** ✅
   - Equip upgrades automatically
   - Use healing potions when hurt
   - Pickup valuable items

6. **Bot Personalities** ✅
   - Cautious, Aggressive, Greedy, Speedrunner
   - Configurable thresholds per personality

### Deliverable
Watch the bot play from level 1 until death. ✅

**Test results:** Bot successfully explores, fights, picks up items, and descends.
Speedrunner reaches deeper (avg 1.8), aggressive gets more kills (avg 4.6).

---

## Phase 3: Meta-Progression ✅ COMPLETE

**Goal:** Death → Essence → Upgrades → Better Runs.

### Tasks

1. **Essence System** ✅
   - `essenceFromDeath()` and `essenceFromVictory()` formulas
   - Scales with depth, kills, gold collected
   - Prestige multiplier applied to all essence

2. **Upgrades** ✅
   - 16 upgrades in 4 categories (stats, borg, meta, qol)
   - `upgrade-effects.ts` computes bonuses from levels
   - Applied to character creation (HP, armor, damage, evasion)
   - XP multiplier applied in game-loop

3. **Unlocks** ✅
   - Races/classes via milestone achievements
   - Run slots via QoL upgrades (1→4)
   - `run-completion-service.ts` checks milestones

4. **Persistence** ✅
   - IndexedDB via `idb` library
   - Auto-save with 2s debounce
   - Export/import JSON for backup
   - Set→Array serialization for unlocks

5. **Prestige System** ✅
   - Reset upgrades, keep unlocks
   - Multiplier: 1x → 1.5x → 2x → 3x → 4.5x → 6x+
   - Cube root formula for prestige currency

### Deliverable
Complete idle loop: play → die → earn → upgrade → play better. ✅

### Files Created
- `src/game/upgrade-effects.ts` - Compute bonuses from upgrades
- `src/game/data/upgrades.ts` - 16 upgrade definitions
- `src/core/run-completion-service.ts` - Bridge game→stores
- `src/stores/progression.ts` - Essence, upgrades, prestige
- `src/stores/persistence.ts` - IndexedDB layer

---

## Phase 4: UI Components ← NEXT

**Goal:** Vue interface for the game.

### Tasks

1. **Game Display**
   - rot.js Display integration
   - ASCII grid rendering (80x24)
   - Color mapping for tiles/entities

2. **HUD Components**
   - Character stats (HP, MP, Level)
   - Depth indicator
   - Message log

3. **Meta-Progression UI**
   - Essence display
   - Upgrade purchase interface
   - Unlock tree visualization
   - Prestige button with preview

4. **Run Controls**
   - Start/stop buttons
   - Turbo mode toggle
   - Race/class selection

### Deliverable
Playable game in browser with full UI.

---

## Phase 5: Multi-Instance

**Goal:** Run 1-4 games simultaneously.

### Tasks

1. **Run Manager**
   - Spawn/destroy game instances
   - Independent game states
   - Shared progression store

2. **UI Layout**
   - 1/2/4 grid layouts
   - Per-run controls
   - Aggregated stats view

3. **Cross-Run Features**
   - Shared stash (items from dead runs)
   - Monster knowledge
   - Morale bonus (more runs = more essence)

4. **Performance**
   - Optimize rendering for multiple grids
   - Consider Web Workers for game logic
   - Headless mode for turbo

### Deliverable
4 simultaneous runs with shared progression.

---

## Phase 6: Polish

**Goal:** Complete idle game experience.

### Tasks

1. **Achievements**
   - Progress milestones
   - Challenge achievements
   - Cumulative achievements

2. **Balance Pass**
   - Essence curves
   - Upgrade costs
   - Difficulty progression
   - Time-to-first-win tuning

3. **Quality of Life**
   - Auto-restart with configurable delay
   - Race/class rotation
   - Statistics dashboard
   - Run history view

### Deliverable
Polished, balanced idle roguelike.

---

## Data Reference

### Races (see ANGBAND-LITE-DESIGN.md)

Starting: Human, Dwarf, Elf
Unlockable: Halfling, Half-Orc, Kobold, Gnome, Half-Troll
Prestige: Vampire, Golem, Draconian

### Classes (see ANGBAND-LITE-DESIGN.md)

Starting: Warrior, Mage, Rogue
Unlockable: Priest, Ranger, Paladin
Prestige: Necromancer, Berserker, Archmage

### Dungeon Structure

```
Depth 1-10:   Shallow  (rats, kobolds, orcs)
Depth 11-25:  Mid      (trolls, ogres, undead)
Depth 26-40:  Deep     (giants, dragons, demons)
Depth 41-49:  Abyss    (uniques, ancient wyrms)
Depth 50:     Throne   (final boss)
```

### Essence Formula (Implemented in `src/core/formulas.ts`)

```
Death:
  - Depth < 10:  depth * 2
  - Depth 10-24: 50 base
  - Depth 25-39: 200 base
  - Depth 40+:   500 base
  - + sqrt(kills) * 2
  - + log10(gold) * 5

Victory:
  - 2000 base
  - + kills * 0.5
  - + speedrun bonus (fewer turns = more essence)

Prestige Multiplier:
  - Level 0: 1.0x
  - Level 1: 1.5x
  - Level 2: 2.0x
  - Level 3: 3.0x
  - Level 4: 4.5x
  - Level 5+: 4.5 + (level-4) * 1.5
```
