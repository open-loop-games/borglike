# TODO

## Current Focus: Polish & Balance

### Active Work
- [ ] Balance pass on essence curves and upgrade costs
- [ ] Tune bot personalities for distinct playstyles
- [ ] Status effect implementation (debuffs currently cosmetic)

### Bot Feature Unlock System (Per-Slot Progression)

Bots start simple (face-rush), unlock features through upgrades per run slot.

**Implemented** (2026-01)

Types & Data:
- [x] `BotCapabilities`, `BotToggles` interfaces (`types/progression.ts`)
- [x] Upgrade definitions with costs/prereqs (`game/data/bot-upgrades.ts`)
- [x] Per-slot state in `SlotConfig` with migration for existing saves

Gates (ON/OFF capabilities):
- [x] Town: Without unlock, return through portal immediately, skip services (`bot/goals.ts`)
- [x] Farming: Without unlock, skip farming loops (`bot/farming.ts`)
- [x] Preparedness: Without unlock, skip depth readiness checks (`bot/progression.ts`)
- [x] TP scroll blocked when town disabled (`bot/survival-consumables.ts`)

Gates (Graded levels 0-3):
- [x] Sweep: L0=disabled, L1-L3 increase exploration threshold (`bot/farming.ts`)
- [x] Surf: L0=15% HP flee, L1=30%, L2=40%, L3=personality-based (`bot/survival-retreat.ts`)
- [x] Kiting: L0=disabled, L1-L3 increase engage distance (`bot/combat.ts`)

Context Flow:
- [x] `RunConfig` → `GameRunner` → `runBotTick` → `buildBotContext` → `BotContext`
- [x] `getEffectiveCapabilities()` combines unlocked + toggled state

UI:
- [x] `BotTrainingPanel.vue` - upgrade purchase, toggles, level bars
- [x] `LoadoutEditor.vue` - two-column layout with bot training

**Remaining**
- [ ] Personality presets set default lever values

### Town & Economy

- [ ] Town tier unlocks (T2, T3 items in merchants through essence upgrade)

### Balance Fixes

### Technical Debt

### Prestige System

**Remaining Work**
- [ ] Draconian `wings`: Fly over pits and water (`src/game/actions/movement.ts`)
- [ ] Archmage: Glass cannon - prefer AOE spells in bot spell selection (`src/game/bot/spells.ts`)

**Implemented** (2026-01)

Unlock Condition Validation:
- [x] `checkCondition` predicates on prestige races/classes (`races.ts`, `classes.ts`)
- [x] Victory tracking per race/class (`progression.ts:517-526`)
- [x] Dragon kill aggregation for Draconian unlock (`races.ts:407-410`)
- [x] UI disables purchase when condition not met (`UnlockItem.vue`)

Vampire Abilities:
- [x] `life_steal`: 20% lifesteal on melee (`combat.ts:1284`)
- [x] `no_potions`: Blocks healing potions (`consumables.ts:370`, `bot/items.ts:609`)
- [x] `light_vuln`: -100 LIGHT resistance (`character.ts:292`)

Golem Abilities:
- [x] `no_magic`: Blocks spells (`interaction.ts:70`) and scrolls (`consumables.ts:382`)
- [x] `slow_heal`: 50% healing rate (`game-loop.ts:365`)
- [x] `construct`: +100 POISON resistance (`character.ts:296`)
- [x] Bot knows golem can't cast (`bot/spells.ts:27`)

Draconian Abilities:
- [x] `breath_weapon`: Cone AOE via activation system (`activation.ts`, `activations.ts:163`)
- [x] `elem_resist`: +50 fire/cold/acid resistance (`character.ts:286-289`)
- [x] Bot uses breath weapon (`bot/activations.ts:130`)

Prestige Class Mechanics:
- [x] Necromancer: Summon skeleton spell + minion AI (`minion-ai.ts`, `spells.ts:493`)
- [x] Berserker `neverRetreats` (`class-profiles.ts:127`)

### Other Missing Systems
- [ ] Monster status effects (only debuffs exist, no status effect ticking for monsters)
- [ ] Trap status effects (traps apply poison but not other debuffs)

### Future Features
- [ ] Statistics dashboard
- [ ] Optional tile graphics (RLTiles)
  - Public domain tileset, attribution required: http://rltiles.sf.net
  - Toggle in settings (ASCII vs tiles)
  - Scope: player, monsters, terrain, items
  - 32x32 tiles - decide viewport scaling approach
  - Tile mapping strategy for 52+ monsters
