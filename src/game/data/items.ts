/**
 * Item data extracted from Angband 4.2.6 gamedata/object.txt
 * Simplified and organized for Angband-lite roguelike
 */

export interface ItemTemplate {
  name: string
  type:
    | 'weapon'
    | 'bow'
    | 'armor'
    | 'shield'
    | 'helm'
    | 'gloves'
    | 'boots'
    | 'ring'
    | 'amulet'
    | 'light'
    | 'potion'
    | 'scroll'
  slot?: 'weapon' | 'bow' | 'body' | 'shield' | 'helm' | 'gloves' | 'boots' | 'ring' | 'amulet' | 'light'
  /** Ranged weapon range (tiles) - only for bows */
  range?: number
  /** Hit bonus for ranged weapons */
  hitBonus?: number
  tier: number // 1-4 based on power level and alloc-depth
  damage?: string // dice notation e.g. "2d5"
  protection?: number // AC value
  weight: number // in 0.1 lbs
  effect?: string // special effect description
  minDepth?: number // minimum depth to find
  /** Light radius in tiles (only for light sources) */
  lightRadius?: number
}

// ============================================================================
// WEAPONS - Swords, Axes, Maces
// ============================================================================

export const WEAPONS: ItemTemplate[] = [
  // Tier 1 - Early Game (depth 0-10)
  {
    name: 'Dagger',
    type: 'weapon',
    slot: 'weapon',
    tier: 1,
    damage: '1d4',
    weight: 12,
    minDepth: 0,
  },
  {
    name: 'Short Sword',
    type: 'weapon',
    slot: 'weapon',
    tier: 1,
    damage: '1d7',
    weight: 80,
    minDepth: 5,
  },
  {
    name: 'Mace',
    type: 'weapon',
    slot: 'weapon',
    tier: 1,
    damage: '2d4',
    weight: 120,
    minDepth: 5,
  },
  {
    name: 'Spear',
    type: 'weapon',
    slot: 'weapon',
    tier: 1,
    damage: '1d6',
    weight: 50,
    minDepth: 5,
  },

  // Tier 2 - Mid Game (depth 10-25)
  {
    name: 'Long Sword',
    type: 'weapon',
    slot: 'weapon',
    tier: 2,
    damage: '2d5',
    weight: 130,
    minDepth: 10,
  },
  {
    name: 'Broad Axe',
    type: 'weapon',
    slot: 'weapon',
    tier: 2,
    damage: '2d6',
    weight: 160,
    minDepth: 15,
  },
  {
    name: 'Morning Star',
    type: 'weapon',
    slot: 'weapon',
    tier: 2,
    damage: '2d6',
    weight: 150,
    minDepth: 10,
  },
  {
    name: 'War Hammer',
    type: 'weapon',
    slot: 'weapon',
    tier: 2,
    damage: '3d3',
    weight: 120,
    minDepth: 5,
  },
  {
    name: 'Bastard Sword',
    type: 'weapon',
    slot: 'weapon',
    tier: 2,
    damage: '3d4',
    weight: 140,
    minDepth: 15,
  },

  // Tier 3 - Deep Game (depth 25-40)
  {
    name: 'Katana',
    type: 'weapon',
    slot: 'weapon',
    tier: 3,
    damage: '3d5',
    weight: 120,
    minDepth: 20,
  },
  {
    name: 'Battle Axe',
    type: 'weapon',
    slot: 'weapon',
    tier: 3,
    damage: '2d8',
    weight: 170,
    minDepth: 15,
  },
  {
    name: 'Two-Handed Great Flail',
    type: 'weapon',
    slot: 'weapon',
    tier: 3,
    damage: '3d6',
    weight: 280,
    minDepth: 45,
  },
  {
    name: 'Halberd',
    type: 'weapon',
    slot: 'weapon',
    tier: 3,
    damage: '3d5',
    weight: 190,
    minDepth: 25,
  },

  // Tier 4 - Endgame (depth 40+)
  {
    name: "Executioner's Sword",
    type: 'weapon',
    slot: 'weapon',
    tier: 4,
    damage: '4d5',
    weight: 260,
    minDepth: 40,
  },
  {
    name: 'Great Axe',
    type: 'weapon',
    slot: 'weapon',
    tier: 4,
    damage: '4d4',
    weight: 230,
    minDepth: 40,
  },
  {
    name: 'Mace of Disruption',
    type: 'weapon',
    slot: 'weapon',
    tier: 4,
    damage: '5d8',
    weight: 400,
    effect: 'Slay Undead x3',
    minDepth: 80,
  },
  {
    name: 'Blade of Chaos',
    type: 'weapon',
    slot: 'weapon',
    tier: 4,
    damage: '6d5',
    weight: 180,
    effect: 'Resist Chaos',
    minDepth: 70,
  },
  {
    name: 'Scythe of Slicing',
    type: 'weapon',
    slot: 'weapon',
    tier: 4,
    damage: '8d4',
    weight: 250,
    minDepth: 60,
  },
]

// ============================================================================
// BOWS - Ranged Weapons
// ============================================================================

export const BOWS: ItemTemplate[] = [
  // Tier 1 - Early Game (depth 0-10)
  {
    name: 'Short Bow',
    type: 'bow',
    slot: 'bow',
    tier: 1,
    damage: '1d6',
    weight: 30,
    range: 8,
    minDepth: 0,
  },

  // Tier 2 - Mid Game (depth 10-25)
  {
    name: 'Long Bow',
    type: 'bow',
    slot: 'bow',
    tier: 2,
    damage: '2d4',
    weight: 40,
    range: 8,
    minDepth: 10,
  },
  {
    name: 'Composite Bow',
    type: 'bow',
    slot: 'bow',
    tier: 2,
    damage: '2d5',
    weight: 45,
    range: 8,
    minDepth: 15,
  },

  // Tier 3 - Deep Game (depth 25-40)
  {
    name: 'Elven Bow',
    type: 'bow',
    slot: 'bow',
    tier: 3,
    damage: '2d6',
    weight: 35,
    range: 8,
    hitBonus: 2,
    minDepth: 25,
  },

  // Tier 4 - Endgame (depth 40+)
  {
    name: 'Bow of Precision',
    type: 'bow',
    slot: 'bow',
    tier: 4,
    damage: '3d5',
    weight: 40,
    range: 8,
    hitBonus: 5,
    minDepth: 45,
  },
]

// ============================================================================
// ARMOR - Body Armor
// ============================================================================

export const ARMOR: ItemTemplate[] = [
  // Tier 1 - Early Game
  {
    name: 'Robe',
    type: 'armor',
    slot: 'body',
    tier: 1,
    protection: 2,
    weight: 20,
    minDepth: 1,
  },
  {
    name: 'Soft Leather Armour',
    type: 'armor',
    slot: 'body',
    tier: 1,
    protection: 8,
    weight: 80,
    minDepth: 3,
  },
  {
    name: 'Studded Leather Armour',
    type: 'armor',
    slot: 'body',
    tier: 1,
    protection: 12,
    weight: 100,
    minDepth: 5,
  },

  // Tier 2 - Mid Game
  {
    name: 'Hard Leather Armour',
    type: 'armor',
    slot: 'body',
    tier: 2,
    protection: 16,
    weight: 120,
    minDepth: 10,
  },
  {
    name: 'Leather Scale Mail',
    type: 'armor',
    slot: 'body',
    tier: 2,
    protection: 20,
    weight: 140,
    minDepth: 15,
  },
  {
    name: 'Chain Mail',
    type: 'armor',
    slot: 'body',
    tier: 2,
    protection: 32,
    weight: 220,
    minDepth: 20,
  },

  // Tier 3 - Deep Game
  {
    name: 'Metal Scale Mail',
    type: 'armor',
    slot: 'body',
    tier: 3,
    protection: 38,
    weight: 250,
    minDepth: 25,
  },
  {
    name: 'Augmented Chain Mail',
    type: 'armor',
    slot: 'body',
    tier: 3,
    protection: 42,
    weight: 270,
    minDepth: 35,
  },
  {
    name: 'Metal Brigandine Armour',
    type: 'armor',
    slot: 'body',
    tier: 3,
    protection: 48,
    weight: 290,
    minDepth: 45,
  },

  // Tier 4 - Endgame
  {
    name: 'Full Plate Armour',
    type: 'armor',
    slot: 'body',
    tier: 4,
    protection: 62,
    weight: 360,
    minDepth: 55,
  },
  {
    name: 'Mithril Chain Mail',
    type: 'armor',
    slot: 'body',
    tier: 4,
    protection: 28,
    weight: 150,
    effect: 'Ignore Acid',
    minDepth: 55,
  },
  {
    name: 'Mithril Plate Mail',
    type: 'armor',
    slot: 'body',
    tier: 4,
    protection: 60,
    weight: 300,
    effect: 'Ignore Acid',
    minDepth: 65,
  },
  {
    name: 'Adamantite Plate Mail',
    type: 'armor',
    slot: 'body',
    tier: 4,
    protection: 80,
    weight: 420,
    effect: 'Ignore Acid',
    minDepth: 75,
  },
]

// ============================================================================
// SHIELDS
// ============================================================================

export const SHIELDS: ItemTemplate[] = [
  {
    name: 'Wicker Shield',
    type: 'shield',
    slot: 'shield',
    tier: 1,
    protection: 2,
    weight: 30,
    minDepth: 1,
  },
  {
    name: 'Small Metal Shield',
    type: 'shield',
    slot: 'shield',
    tier: 2,
    protection: 5,
    weight: 60,
    minDepth: 15,
  },
  {
    name: 'Leather Shield',
    type: 'shield',
    slot: 'shield',
    tier: 2,
    protection: 8,
    weight: 90,
    minDepth: 10,
  },
  {
    name: 'Large Metal Shield',
    type: 'shield',
    slot: 'shield',
    tier: 3,
    protection: 12,
    weight: 120,
    minDepth: 30,
  },
  {
    name: "Knight's Shield",
    type: 'shield',
    slot: 'shield',
    tier: 3,
    protection: 15,
    weight: 160,
    minDepth: 50,
  },
  {
    name: 'Mithril Shield',
    type: 'shield',
    slot: 'shield',
    tier: 4,
    protection: 16,
    weight: 100,
    effect: 'Ignore Acid',
    minDepth: 70,
  },
]

// ============================================================================
// HELMS
// ============================================================================

export const HELMS: ItemTemplate[] = [
  {
    name: 'Hard Leather Cap',
    type: 'helm',
    slot: 'helm',
    tier: 1,
    protection: 2,
    weight: 20,
    minDepth: 3,
  },
  {
    name: 'Metal Cap',
    type: 'helm',
    slot: 'helm',
    tier: 2,
    protection: 3,
    weight: 25,
    minDepth: 10,
  },
  {
    name: 'Iron Helm',
    type: 'helm',
    slot: 'helm',
    tier: 2,
    protection: 7,
    weight: 50,
    minDepth: 20,
  },
  {
    name: 'Steel Helm',
    type: 'helm',
    slot: 'helm',
    tier: 3,
    protection: 9,
    weight: 60,
    minDepth: 40,
  },
  {
    name: 'Iron Crown',
    type: 'helm',
    slot: 'helm',
    tier: 3,
    protection: 0,
    weight: 20,
    minDepth: 45,
  },
  {
    name: 'Jewel Encrusted Crown',
    type: 'helm',
    slot: 'helm',
    tier: 4,
    protection: 0,
    weight: 40,
    effect: 'Ignore Acid',
    minDepth: 50,
  },
]

// ============================================================================
// GLOVES
// ============================================================================

export const GLOVES: ItemTemplate[] = [
  {
    name: 'Leather Gloves',
    type: 'gloves',
    slot: 'gloves',
    tier: 1,
    protection: 1,
    weight: 10,
    minDepth: 1,
  },
  {
    name: 'Gauntlets',
    type: 'gloves',
    slot: 'gloves',
    tier: 2,
    protection: 3,
    weight: 25,
    minDepth: 10,
  },
  {
    name: 'Caestus',
    type: 'gloves',
    slot: 'gloves',
    tier: 2,
    protection: 5,
    weight: 40,
    damage: '1d1',
    effect: '+3 to damage',
    minDepth: 20,
  },
  {
    name: 'Mithril Gauntlets',
    type: 'gloves',
    slot: 'gloves',
    tier: 3,
    protection: 6,
    weight: 15,
    effect: 'Ignore Acid, Fire',
    minDepth: 40,
  },
  {
    name: "Alchemist's Gloves",
    type: 'gloves',
    slot: 'gloves',
    tier: 4,
    protection: 0,
    weight: 5,
    effect: 'Ignore Elements',
    minDepth: 50,
  },
]

// ============================================================================
// BOOTS
// ============================================================================

export const BOOTS: ItemTemplate[] = [
  {
    name: 'Leather Sandals',
    type: 'boots',
    slot: 'boots',
    tier: 1,
    protection: 1,
    weight: 15,
    minDepth: 1,
  },
  {
    name: 'Leather Boots',
    type: 'boots',
    slot: 'boots',
    tier: 1,
    protection: 2,
    weight: 20,
    minDepth: 3,
  },
  {
    name: 'Iron Shod Boots',
    type: 'boots',
    slot: 'boots',
    tier: 2,
    protection: 4,
    weight: 35,
    effect: 'Ignore Fire',
    minDepth: 5,
  },
  {
    name: 'Steel Shod Boots',
    type: 'boots',
    slot: 'boots',
    tier: 3,
    protection: 7,
    weight: 60,
    effect: 'Ignore Fire',
    minDepth: 20,
  },
  {
    name: 'Mithril Shod Boots',
    type: 'boots',
    slot: 'boots',
    tier: 4,
    protection: 8,
    weight: 40,
    effect: 'Ignore Acid, Fire',
    minDepth: 60,
  },
  {
    name: 'Ethereal Slippers',
    type: 'boots',
    slot: 'boots',
    tier: 4,
    protection: 0,
    weight: 0,
    effect: 'Ignore All Elements',
    minDepth: 30,
  },
]

// ============================================================================
// RINGS
// ============================================================================

export const RINGS: ItemTemplate[] = [
  // Stat Rings
  {
    name: 'Ring of Strength',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: '+1-5 STR, Sustain STR',
    minDepth: 30,
  },
  {
    name: 'Ring of Dexterity',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: '+1-5 DEX, Sustain DEX',
    minDepth: 30,
  },
  {
    name: 'Ring of Constitution',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: '+1-5 CON, Sustain CON',
    minDepth: 30,
  },

  // Utility Rings
  {
    name: 'Ring of Protection',
    type: 'ring',
    slot: 'ring',
    tier: 1,
    weight: 2,
    protection: 10,
    effect: '+5-15 AC',
    minDepth: 10,
  },
  {
    name: 'Ring of Free Action',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: 'Free Action',
    minDepth: 20,
  },
  {
    name: 'Ring of See Invisible',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: 'See Invisible',
    minDepth: 30,
  },
  {
    name: 'Ring of Resist Fire and Cold',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: 'Resist Fire, Resist Cold',
    minDepth: 10,
  },
  {
    name: 'Ring of Resist Poison',
    type: 'ring',
    slot: 'ring',
    tier: 3,
    weight: 2,
    effect: 'Resist Poison',
    minDepth: 40,
  },

  // Combat Rings
  {
    name: 'Ring of Damage',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: '+5-15 to damage',
    minDepth: 20,
  },
  {
    name: 'Ring of Accuracy',
    type: 'ring',
    slot: 'ring',
    tier: 2,
    weight: 2,
    effect: '+10-20 to hit',
    minDepth: 20,
  },
  {
    name: 'Ring of Slaying',
    type: 'ring',
    slot: 'ring',
    tier: 3,
    weight: 2,
    effect: '+1-10 to hit, +1-5 to damage',
    minDepth: 40,
  },

  // Top Tier
  {
    name: 'Ring of Speed',
    type: 'ring',
    slot: 'ring',
    tier: 4,
    weight: 2,
    effect: '+4-10 Speed',
    minDepth: 75,
  },
]

// ============================================================================
// AMULETS
// ============================================================================

export const AMULETS: ItemTemplate[] = [
  {
    name: 'Amulet of Wisdom',
    type: 'amulet',
    slot: 'amulet',
    tier: 2,
    weight: 3,
    effect: '+1-5 WIS, Sustain WIS',
    minDepth: 20,
  },
  {
    name: 'Amulet of Resist Lightning',
    type: 'amulet',
    slot: 'amulet',
    tier: 1,
    weight: 3,
    effect: 'Resist Lightning',
    minDepth: 10,
  },
  {
    name: 'Amulet of Resist Acid',
    type: 'amulet',
    slot: 'amulet',
    tier: 1,
    weight: 3,
    effect: 'Resist Acid',
    minDepth: 10,
  },
  {
    name: 'Amulet of Regeneration',
    type: 'amulet',
    slot: 'amulet',
    tier: 2,
    weight: 3,
    effect: 'Regeneration',
    minDepth: 30,
  },
  {
    name: 'Amulet of Infravision',
    type: 'amulet',
    slot: 'amulet',
    tier: 1,
    weight: 3,
    effect: '+1-5 Infravision',
    minDepth: 10,
  },
  {
    name: 'Amulet of Resistance',
    type: 'amulet',
    slot: 'amulet',
    tier: 4,
    weight: 3,
    effect: 'Resist Fire, Cold, Lightning, Acid',
    minDepth: 60,
  },
  {
    name: 'Amulet of ESP',
    type: 'amulet',
    slot: 'amulet',
    tier: 4,
    weight: 3,
    effect: 'Telepathy',
    minDepth: 60,
  },
  {
    name: 'Amulet of the Magi',
    type: 'amulet',
    slot: 'amulet',
    tier: 4,
    weight: 3,
    effect: '+1-3 INT, Free Action, See Invisible, Protect Blind',
    minDepth: 70,
  },
  {
    name: 'Amulet of Trickery',
    type: 'amulet',
    slot: 'amulet',
    tier: 4,
    weight: 3,
    effect: '+DEX, +Speed, +Stealth, Resist Nexus, Resist Poison',
    minDepth: 70,
  },
]

// ============================================================================
// LIGHT SOURCES
// ============================================================================

export const LIGHTS: ItemTemplate[] = [
  {
    name: 'Wooden Torch',
    type: 'light',
    slot: 'light',
    tier: 1,
    weight: 22,
    effect: 'Light radius 2, Burns out',
    minDepth: 1,
    lightRadius: 2,
  },
  {
    name: 'Lantern',
    type: 'light',
    slot: 'light',
    tier: 2,
    weight: 50,
    effect: 'Light radius 3, Takes fuel',
    minDepth: 5,
    lightRadius: 3,
  },
]

// ============================================================================
// POTIONS - Healing, Mana, Buffs
// ============================================================================

export const POTIONS: ItemTemplate[] = [
  // Healing Potions (4 tiers)
  {
    name: 'Potion of Cure Light Wounds',
    type: 'potion',
    tier: 1,
    weight: 4,
    effect: 'Heal 20 HP, cure blind',
    minDepth: 1,
  },
  {
    name: 'Potion of Cure Serious Wounds',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Heal 40 HP, cure blind/cuts/confusion',
    minDepth: 5,
  },
  {
    name: 'Potion of Cure Critical Wounds',
    type: 'potion',
    tier: 3,
    weight: 4,
    effect: 'Heal 60 HP, cure all status',
    minDepth: 12,
  },
  {
    name: 'Potion of Healing',
    type: 'potion',
    tier: 4,
    weight: 4,
    effect: 'Heal 300 HP, cure all status',
    minDepth: 30,
  },

  // Mana Potions
  {
    name: 'Potion of Restore Mana',
    type: 'potion',
    tier: 3,
    weight: 4,
    effect: 'Restore all mana',
    minDepth: 15,
  },

  // Buff Potions
  {
    name: 'Potion of Speed',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Haste (+10 speed) for 20-40 turns',
    minDepth: 1,
  },
  {
    name: 'Potion of Heroism',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Heal 10 HP, cure fear, +12 to hit for 25-50 turns',
    minDepth: 1,
  },
  {
    name: 'Potion of Berserk Strength',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Heal 30 HP, cure fear, berserk for 25-50 turns',
    minDepth: 3,
  },

  // Resistance Potions
  {
    name: 'Potion of Resist Heat',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Temporary fire resistance',
    minDepth: 30,
  },
  {
    name: 'Potion of Resist Cold',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Temporary cold resistance',
    minDepth: 30,
  },
  {
    name: 'Potion of Resist Poison',
    type: 'potion',
    tier: 2,
    weight: 4,
    effect: 'Temporary poison resistance, cure poison',
    minDepth: 20,
  },

  // Utility
  {
    name: 'Potion of Neutralize Poison',
    type: 'potion',
    tier: 1,
    weight: 4,
    effect: 'Cure poison',
    minDepth: 1,
  },
  // Phase 4-5: Needs invisible system
  // {
  //   name: 'Potion of True Seeing',
  //   type: 'potion',
  //   tier: 2,
  //   weight: 4,
  //   effect: 'Cure blind, see invisible for 50-60 turns',
  //   minDepth: 3,
  // },
]

// ============================================================================
// SCROLLS - Teleport, Identify, Mapping, etc.
// ============================================================================

export const SCROLLS: ItemTemplate[] = [
  // Teleportation
  {
    name: 'Scroll of Phase Door',
    type: 'scroll',
    tier: 1,
    weight: 5,
    effect: 'Teleport up to 10 squares',
    minDepth: 1,
  },
  {
    name: 'Scroll of Teleportation',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: 'Teleport to random location on level',
    minDepth: 10,
  },
  {
    name: 'Scroll of Teleport Level',
    type: 'scroll',
    tier: 3,
    weight: 5,
    effect: 'Teleport to adjacent dungeon level',
    minDepth: 20,
  },

  // Detection & Mapping
  {
    name: 'Scroll of Magic Mapping',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: 'Magic Mapping - reveal level',
    minDepth: 5,
  },
  // Phase 4-5: Needs invisible system
  // {
  //   name: 'Scroll of Detect Invisible',
  //   type: 'scroll',
  //   tier: 1,
  //   weight: 5,
  //   effect: 'Detect invisible monsters',
  //   minDepth: 1,
  // },
  {
    name: 'Scroll of Treasure Detection',
    type: 'scroll',
    tier: 1,
    weight: 5,
    effect: 'Detect gold and items',
    minDepth: 0,
  },

  // Phase 4-5: Needs unidentified items system
  // {
  //   name: 'Scroll of Identify Rune',
  //   type: 'scroll',
  //   tier: 1,
  //   weight: 5,
  //   effect: 'Identify one item',
  //   minDepth: 5,
  // },

  // Utility - Removed: Word of Recall (needs town), Remove Hunger (needs hunger)
  {
    name: 'Scroll of Light',
    type: 'scroll',
    tier: 1,
    weight: 5,
    effect: 'Light nearby area',
    minDepth: 0,
  },

  // Enchantment
  {
    name: 'Scroll of Enchant Weapon',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: '+1 to weapon to-hit or to-dam',
    minDepth: 15,
  },
  {
    name: 'Scroll of Enchant Armour',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: '+1 to armor AC',
    minDepth: 15,
  },
  // Phase 4-5: Needs curse system
  // {
  //   name: 'Scroll of Remove Curse',
  //   type: 'scroll',
  //   tier: 2,
  //   weight: 5,
  //   effect: 'Remove weak curses',
  //   minDepth: 10,
  // },

  // Town Portal
  {
    name: 'Scroll of Town Portal',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: 'Opens portal to town for 1000 turns',
    minDepth: 1,
  },

  // Combat
  {
    name: 'Scroll of Blessing',
    type: 'scroll',
    tier: 1,
    weight: 5,
    effect: '+5 to hit, +5 AC for 6-18 turns',
    minDepth: 1,
  },
  {
    name: 'Scroll of Protection from Evil',
    type: 'scroll',
    tier: 2,
    weight: 5,
    effect: 'Protection from evil monsters',
    minDepth: 30,
  },
  // Phase 4-5: Needs confusion status
  // {
  //   name: 'Scroll of Monster Confusion',
  //   type: 'scroll',
  //   tier: 1,
  //   weight: 5,
  //   effect: 'Next melee hit confuses monster',
  //   minDepth: 5,
  // },

  // Phase 4-5: Complex targeting/AOE - needs more work
  // {
  //   name: 'Scroll of Banishment',
  //   type: 'scroll',
  //   tier: 4,
  //   weight: 5,
  //   effect: 'Banish one type of monster',
  //   minDepth: 40,
  // },
  // {
  //   name: 'Scroll of *Destruction*',
  //   type: 'scroll',
  //   tier: 4,
  //   weight: 5,
  //   effect: 'Destroy nearby area',
  //   minDepth: 40,
  // },
  // {
  //   name: 'Scroll of Rune of Protection',
  //   type: 'scroll',
  //   tier: 4,
  //   weight: 5,
  //   effect: 'Create protective glyph',
  //   minDepth: 70,
  // },
]

// ============================================================================
// COMBINED EXPORTS
// ============================================================================

export const ALL_EQUIPMENT: ItemTemplate[] = [
  ...WEAPONS,
  ...BOWS,
  ...ARMOR,
  ...SHIELDS,
  ...HELMS,
  ...GLOVES,
  ...BOOTS,
  ...RINGS,
  ...AMULETS,
  ...LIGHTS,
]

export const ALL_CONSUMABLES: ItemTemplate[] = [...POTIONS, ...SCROLLS]

export const ALL_ITEMS: ItemTemplate[] = [...ALL_EQUIPMENT, ...ALL_CONSUMABLES]

/**
 * Get items by tier
 */
export function getItemsByTier(tier: number): ItemTemplate[] {
  return ALL_ITEMS.filter((item) => item.tier === tier)
}

/**
 * Get items by type
 */
export function getItemsByType(type: ItemTemplate['type']): ItemTemplate[] {
  return ALL_ITEMS.filter((item) => item.type === type)
}

/**
 * Get items appropriate for a given depth
 * Returns items whose minDepth is <= the given depth
 */
export function getItemsForDepth(depth: number): ItemTemplate[] {
  return ALL_ITEMS.filter((item) => (item.minDepth ?? 0) <= depth)
}
