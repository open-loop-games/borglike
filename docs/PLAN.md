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
- Abilities instead of complex spell system
- Tiered loot + fixed artifacts (no ego items/randarts)
- Minimal town (depth 0 safe zone)
- Fewer resistance types
- ~50 monsters instead of 100+

---

## Phase 1: Core Game ✅ COMPLETE

Basic roguelike with all game systems.

- Dungeon generation (3 algorithms: classic, cavern, labyrinth)
- 21 vault templates with special features
- Character creation (14 races, 11 classes)
- Movement and FOV (rot.js)
- Combat system with damage/armor/criticals
- 52 monsters + Morgoth boss
- Items, equipment, 12 artifacts
- 21 spells across 4 schools
- Fountains, altars, merchants, traps

---

## Phase 2: Auto-Player ✅ COMPLETE

Angband-inspired bot AI.

- Priority-based decision loop
- Flow-based pathfinding (reverse BFS)
- Danger grid with threat assessment
- Goal system (FLEE, KITE, RECOVER, KILL, TAKE, DESCEND, EXPLORE)
- Survival logic (retreat thresholds, healing, escape)
- Combat decisions with target selection
- 4 personalities (cautious, aggressive, greedy, speedrunner)
- 11 class behavior profiles
- Anti-stuck detection and recovery

See `docs/BOT-AI-PLAN.md` for detailed design.

---

## Phase 3: Meta-Progression ✅ COMPLETE

Death → Essence → Upgrades → Better Runs.

- Essence from deaths/victories (formula-based)
- Prestige multipliers (1.5x → 6x+)
- 16 upgrades in 4 categories
- Upgrade effects applied to character creation
- Race/class unlocks via milestones
- Run slot unlocks (1→4)
- IndexedDB persistence with auto-save
- Export/import JSON backup

---

## Phase 4: UI Components ✅ COMPLETE

Vue interface for the game.

- 24 Vue components
- DungeonGrid ASCII renderer (80x24 viewport)
- RunPanel compact and expanded views
- Upgrade/unlock purchase interfaces
- Progress bars, panel frames
- Settings panel
- Feed with message filtering

See `docs/UI-PLAN.md` for design system.

---

## Phase 5: UI Polish ✅ COMPLETE

Additional UI features.

- Bestiary modal with monster details
- Run history modal
- Loadout editor for boosters
- Collapsible sections
- Per-slot configuration persistence

---

## Phase 6: Polish ← CURRENT

Balance and remaining features.

### In Progress
- [ ] Balance pass (essence curves, upgrade costs)
- [ ] Bot personality tuning
- [ ] Status effect implementation (debuffs cosmetic)

### Technical Debt
- [ ] Monster debuffs not applied
- [ ] Fountain/altar effects incomplete
- [ ] Trap status effects not applied

### Future
- [ ] Achievements system
- [ ] Statistics dashboard
- [ ] Shared stash
- [ ] Monster knowledge bonuses

---

## Data Reference

### Races
- Starting: Human, Dwarf, Elf
- Unlockable: Halfling, Half-Orc, Kobold, Gnome, Half-Troll, High-Elf, Dark-Elf
- Prestige: Vampire, Golem, Draconian

### Classes
- Starting: Warrior, Mage, Rogue
- Unlockable: Priest, Ranger, Paladin, Druid, Necromancer, Blackguard
- Prestige: Berserker, Archmage

### Dungeon Structure
```
Depth 1-10:   Shallow  (rats, kobolds, orcs)
Depth 11-25:  Mid      (trolls, ogres, undead)
Depth 26-40:  Deep     (giants, dragons, demons)
Depth 41-49:  Abyss    (uniques, ancient wyrms)
Depth 50:     Throne   (Morgoth)
```

### Essence Formula
```
Death:
  depth^1.5 + sqrt(kills)*2 + log10(gold)*5

Victory:
  2000 + kills*0.5 + speedrun bonus

Prestige Multiplier:
  [1.0, 1.5, 2.0, 3.0, 4.5, 6.0, 7.5, ...]
```
