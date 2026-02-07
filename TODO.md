# TODO

## Future Features
- [ ] Challenge Modifiers (run-based risk/reward)
  - Voluntary handicaps applied per-slot before a run starts, multiplicative essence bonus
  - Examples: "Glass Cannon" (+50% dmg, -50% HP, 1.5x essence), "Famine" (no healing potion spawns, 1.8x),
    "Haste" (monsters +25% speed, 1.3x), "Poverty" (no gold drops, 2x), "Nemesis" (extra unique every 5 floors, 1.4x)
  - Stackable — multiple modifiers multiply rewards but compound difficulty
  - Core decision: evaluate bot capabilities + race/class vs modifier difficulty
  - Makes different race/class/booster combos situationally optimal instead of one-best
  - Data: `ChallengeModifier[]` on SlotConfig, applied as stat/spawn adjustments in engine
  - Essence multiplier calculated at run completion from active modifiers
  - UI: modifier picker in slot config panel, show combined multiplier preview
  - Unlock modifiers progressively (first few free, harder ones gated behind depth/victory milestones)

- [ ] Booster Synergies
  - Certain booster pairs grant bonus effects when equipped together
  - Examples: Weapon+2 + STR Superior = "Crushing Blow" (5% double damage),
    Adrenaline Rush + Second Wind = "Phoenix" (heal triggers at 30% instead of critical)
  - Transforms booster selection from "pick two best" into composition puzzle
  - Data: `SynergyDefinition[]` checked when assembling effective booster effects
  - Later feature — needs enough boosters to make combos interesting

- [ ] Dungeon Variants (expedition choice)
  - Multiple dungeon "biomes" with different risk/reward profiles, player chooses per slot
  - Already have generators (classic, cavern, labyrinth, vaults) — surface as player-facing choice
  - Add thematic variants: "Orc Stronghold" (melee-heavy), "Dragon's Lair" (elemental resist matters),
    "Undead Crypt" (priest/paladin shine), "Moria" (deep 100-floor variant, different item/monster set)
  - Different monster/item tables per variant create real build diversity
  - Pairs well with prestige — unlock new dungeon variants as late-game content
  - Each slot can run a different dungeon, encouraging diverse team compositions

- [ ] Optional tile graphics (RLTiles)
  - Public domain tileset, attribution required: http://rltiles.sf.net
  - Toggle in settings (ASCII vs tiles)
  - Scope: player, monsters, terrain, items
  - 32x32 tiles - decide viewport scaling approach
  - Tile mapping strategy for 52+ monsters
