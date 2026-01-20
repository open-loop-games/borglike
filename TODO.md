# TODO

## Current Phase: UI Components (Phase 4)

### Next Steps
- [ ] Vue components for game display
- [ ] Essence/upgrade purchase interface
- [ ] Unlock tree visualization
- [ ] Live ASCII grid rendering (rot.js Display)

### Multi-Instance Support
- [ ] Run manager (spawn/destroy game instances)
- [ ] 1/2/4 grid layouts
- [ ] Cross-run features (shared stash, monster knowledge)
- [ ] Performance optimization

---

## Future Phases

### Phase 5: Polish
- [ ] Achievements system
- [ ] Balance pass
- [ ] Auto-restart toggle (uses auto_restart upgrade)
- [ ] Statistics dashboard

---

## Done

### Phase 3: Meta-Progression (2025-01-19)
- [x] Essence system using proper formulas (essenceFromDeath, essenceFromVictory)
- [x] Prestige multipliers applied to essence rewards
- [x] 16 upgrades defined with purchase logic (stats, borg, meta, qol)
- [x] Upgrade effects applied to gameplay (HP, armor, damage, XP multiplier)
- [x] Unlock tree (races, classes via milestones; run slots via upgrades)
- [x] Run completion service (bridges game-runner → stores)
- [x] Persistence layer (IndexedDB with auto-save, export/import)
- [x] Prestige system (reset upgrades, keep unlocks, gain multiplier)

### Phase 2: Auto-Player (2025-01-19)
- [x] Bot decision loop (buildBotContext, priority-based actions)
- [x] Survival logic (HP threshold healing, retreat, teleport escape)
- [x] Exploration (pathfind to unexplored, stair priority)
- [x] Combat decisions (engage when advantageous, target selection)
- [x] Item management (auto-equip, use potions, pickup)
- [x] Bot personalities (Cautious, Aggressive, Greedy, Speedrunner)
- [x] Game runner for batch testing

### Phase 1: Core Game (2025-01-19)
- [x] Dungeon generation with rot.js
- [x] Character creation (14 races, 11 classes)
- [x] Movement and FOV
- [x] Combat system (damage, armor, criticals)
- [x] Monster spawning and AI (52 monsters)
- [x] Item system (equipment, potions, scrolls, 12 artifacts)
