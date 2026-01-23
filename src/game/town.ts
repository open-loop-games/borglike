/**
 * Town Module
 *
 * Handles town level generation, town portal mechanics, and healer interaction.
 * The town is a safe zone (depth 0) with no monsters.
 */

import type {
  GameState,
  DungeonLevel,
  Tile,
  TileType,
  TownPortalState,
  ActionResult,
  Item,
} from './types'
import { randomInt } from './rng'
import {
  TOWN_LAYOUT,
  TOWN_WIDTH,
  TOWN_HEIGHT,
  HEALER_POSITION,
  DUNGEON_ENTRANCE_POSITION,
  PORTAL_SPAWN_POSITION,
  HEALER_COST_PER_HP,
  PORTAL_DURATION,
  TOWN_SHOP_IDS,
  TOWN_SHOP_POSITIONS,
  type TownShopId,
} from './data/town'
import { getTile, setTile, setAllTilesVisible, computeFOV } from './dungeon'
import { calculateLightRadius } from './lighting'
import { initializeMerchant, initializeFeaturesFromVault } from './features'
import { spawnMonstersForLevel } from './monster-ai'
import { spawnItemsForLevel, generateMerchantInventory } from './items'
import { SCROLLS, POTIONS, ALL_EQUIPMENT, type ItemTemplate } from './data/items'
import { createItem } from './items'

// ============================================================================
// TOWN GENERATION
// ============================================================================

/**
 * Generate the town level from the fixed ASCII layout
 *
 * Town is depth 0 - a safe zone with no monsters.
 */
export function generateTownLevel(): DungeonLevel {
  const tiles: Tile[][] = []
  const lines = TOWN_LAYOUT.split('\n')

  for (let y = 0; y < TOWN_HEIGHT; y++) {
    const row: Tile[] = []
    const line = lines[y] ?? ''

    for (let x = 0; x < TOWN_WIDTH; x++) {
      const char = line[x] ?? '#'
      const tileType = charToTileType(char)

      row.push({
        type: tileType,
        explored: true, // Town is always fully explored
        visible: true,
      })
    }
    tiles.push(row)
  }

  return {
    depth: 0,
    width: TOWN_WIDTH,
    height: TOWN_HEIGHT,
    tiles,
    stairsUp: null, // No stairs up from town
    stairsDown: DUNGEON_ENTRANCE_POSITION, // Dungeon entrance acts as stairs down
  }
}

/**
 * Convert ASCII character to tile type
 *
 * Maps ASCII layout characters to tile types for rendering variety.
 * All non-wall tiles are walkable.
 */
function charToTileType(char: string): TileType {
  switch (char) {
    case '#':
      return 'wall'
    case '<':
      return 'dungeon_entrance'
    case 'H':
      return 'healer'
    // Town decorative tiles (all walkable)
    case ',':
      return 'cobblestone'
    case '+':
      return 'town_door'
    case ':':
      return 'rubble'
    case '~':
      return 'town_fountain'
    // Plain floor tiles
    case '.':
    case ' ': // Interior floor (inside buildings)
    case '1': // Shop 1 (General Store)
    case '2': // Shop 2 (Armory)
    case '3': // Shop 3 (Weapon Smithy)
    case '4': // Shop 4 (Alchemy Shop)
    case '5': // Shop 5 (Magic Shop)
    case '@': // Spawn point
      return 'floor'
    default:
      return 'wall'
  }
}

// ============================================================================
// TOWN PORTAL CREATION AND MANAGEMENT
// ============================================================================

/**
 * Create a town portal at the player's current position
 *
 * Creates the portal state and places a portal tile in the dungeon.
 */
export function createTownPortal(game: GameState): TownPortalState {
  // Get original tile type before overwriting
  const currentTile = getTile(
    game.currentLevel,
    game.character.position.x,
    game.character.position.y
  )
  const originalTileType = currentTile?.type ?? 'floor'

  const portal: TownPortalState = {
    dungeonPosition: { ...game.character.position },
    dungeonDepth: game.character.depth,
    createdTurn: game.turn,
    turnsRemaining: PORTAL_DURATION,
    townPosition: { ...PORTAL_SPAWN_POSITION },
    originalTileType,
  }

  // Place portal tile in dungeon at player's position
  setTile(game.currentLevel, game.character.position.x, game.character.position.y, 'portal')

  return portal
}

/**
 * Enter town through portal
 *
 * Teleports player to town. Entity state is NOT cached - entities
 * regenerate on level entry (Angband-style).
 */
export function enterTown(game: GameState): void {
  if (!game.townPortal) return

  // NOTE: Entity caching removed - entities regenerate on level entry (Angband-style)
  // Only cache the level layout
  game.levelCache.set(game.character.depth, game.currentLevel)

  // Get or generate town level
  let townLevel = game.levelCache.get(0)
  if (!townLevel) {
    townLevel = generateTownLevel()
    game.levelCache.set(0, townLevel)
  }

  // Place portal tile in town
  setTile(townLevel, game.townPortal.townPosition.x, game.townPortal.townPosition.y, 'portal')

  // Move player to town
  game.currentLevel = townLevel
  game.character.depth = 0
  game.character.position = { ...game.townPortal.townPosition }

  // Initialize town features
  initializeTown(game)

  // Town is always fully visible - no FOV restrictions
  setAllTilesVisible(townLevel)

  // Clear monsters and items (town has no monsters)
  game.monsters = []
  game.items = []
}

/**
 * Return from town through portal
 *
 * Restores dungeon state and teleports player back to dungeon.
 */
export function returnFromTown(game: GameState): ActionResult {
  if (!game.townPortal) {
    return { success: false, message: 'No active portal', energyCost: 0 }
  }

  const portal = game.townPortal

  // Get dungeon level from cache
  const dungeonLevel = game.levelCache.get(portal.dungeonDepth)
  if (!dungeonLevel) {
    return { success: false, message: 'Dungeon level not found', energyCost: 0 }
  }

  // Save town state (optional, town resets each visit)
  game.levelCache.set(0, game.currentLevel)

  // Restore dungeon level
  game.currentLevel = dungeonLevel
  game.character.depth = portal.dungeonDepth
  game.character.position = { ...portal.dungeonPosition }

  // Restore original tile type at portal position (e.g., stairs_up)
  setTile(dungeonLevel, portal.dungeonPosition.x, portal.dungeonPosition.y, portal.originalTileType)

  // ENTITY REGENERATION: Always spawn fresh entities on level entry
  // Layout is cached, but monsters/items regenerate (Angband-style)
  // UniqueState ensures unique monsters don't respawn
  game.monsters = spawnMonstersForLevel(
    dungeonLevel,
    portal.dungeonDepth,
    game.balance.monsterHpPercent,
    game.uniqueState
  )
  game.items = spawnItemsForLevel(
    dungeonLevel,
    portal.dungeonDepth,
    game.balance.potionRatePercent,
    game.balance.enchantRatePercent,
    game.balance.itemRatePercent
  )
  game.fountains = new Map()
  game.altars = new Map()
  game.merchants = []
  game.traps = new Map()
  initializeFeaturesFromVault(
    dungeonLevel,
    portal.dungeonDepth,
    game.fountains,
    game.altars,
    game.merchants,
    game.traps,
    generateMerchantInventory
  )

  // Update FOV (dynamic light radius based on equipment/race/depth)
  const lightRadius = calculateLightRadius(game.character, portal.dungeonDepth)
  computeFOV(dungeonLevel, game.character.position, lightRadius)

  // Clear town-specific state
  game.healer = null

  return { success: true, energyCost: 100 }
}

/**
 * Tick the portal timer - called each turn
 *
 * Decrements turns remaining and destroys portal if expired.
 */
export function tickPortalTimer(game: GameState): void {
  if (!game.townPortal) return

  game.townPortal.turnsRemaining--

  if (game.townPortal.turnsRemaining <= 0) {
    destroyPortal(game)
  }
}

/**
 * Destroy the town portal
 *
 * Removes portal tiles from both town and dungeon.
 */
function destroyPortal(game: GameState): void {
  if (!game.townPortal) return

  const portal = game.townPortal

  // Remove portal tile from dungeon (if level is in cache)
  // Restore original tile type (e.g., stairs_down) instead of hardcoding floor
  const dungeonLevel = game.levelCache.get(portal.dungeonDepth)
  if (dungeonLevel) {
    setTile(
      dungeonLevel,
      portal.dungeonPosition.x,
      portal.dungeonPosition.y,
      portal.originalTileType
    )
  }

  // Remove portal tile from town (if level is in cache)
  const townLevel = game.levelCache.get(0)
  if (townLevel) {
    setTile(townLevel, portal.townPosition.x, portal.townPosition.y, 'floor')
  }

  // Clear portal state
  game.townPortal = null
}

// ============================================================================
// TOWN INITIALIZATION
// ============================================================================

/**
 * Initialize town features (healer, 5 specialized shops)
 *
 * Called when entering town via portal or ascending from depth 1.
 * Town shop inventory scales with maxDepthEver (permanent progression).
 * Once you've reached depth 15+, alchemy shops stock better potions, etc.
 */
export function initializeTown(game: GameState): void {
  // Initialize healer
  game.healer = {
    position: { ...HEALER_POSITION },
    costPerHP: HEALER_COST_PER_HP,
  }

  // Capture maxDepthEver for tiered inventory generation
  const maxDepthEver = game.maxDepthEver

  // Create inventory generator closure that uses maxDepthEver
  const generateTownInventory = (merchantId: string, _depth: number): Item[] => {
    return generateTownShopInventory(merchantId, maxDepthEver)
  }

  // Initialize all 5 town shops
  game.merchants = []
  for (const shopId of TOWN_SHOP_IDS) {
    const position = TOWN_SHOP_POSITIONS[shopId]
    const merchant = initializeMerchant(
      shopId,
      { ...position },
      0, // Town level (depth 0)
      generateTownInventory
    )
    if (merchant) {
      game.merchants.push(merchant)
    }
  }

  // Reset features
  game.fountains = new Map()
  game.altars = new Map()
  game.traps = new Map()
}

/**
 * Generate inventory for town shops based on shop type and permanent progression.
 *
 * Shop inventory tiers scale with maxDepthEver:
 * - Tier 0 (default): Basic items, depths 1-14
 * - Tier 1: Better healing/escapes, depths 15-29
 * - Tier 2: Best consumables, depths 30+
 *
 * @param merchantId - The shop ID
 * @param maxDepthEver - Permanent progression metric (deepest ever reached)
 */
function generateTownShopInventory(merchantId: string, maxDepthEver: number): Item[] {
  switch (merchantId as TownShopId) {
    case 'town_general':
      return generateGeneralStoreInventory()
    case 'town_armory':
      return generateArmoryInventory(maxDepthEver)
    case 'town_weapons':
      return generateWeaponShopInventory(maxDepthEver)
    case 'town_alchemy':
      return generateAlchemyShopInventory(maxDepthEver)
    case 'town_magic':
      return generateMagicShopInventory(maxDepthEver)
    default:
      return []
  }
}

/**
 * General Store: Town Portal scrolls, basic gear (tier 1), light potions
 */
function generateGeneralStoreInventory(): Item[] {
  const items: Item[] = []

  // Always stock Town Portal Scrolls (3-5)
  const tpScroll = SCROLLS.find((s) => s.name === 'Scroll of Town Portal')
  if (tpScroll) {
    const count = randomInt(3, 5)
    for (let i = 0; i < count; i++) {
      const item = createItem(tpScroll, 0)
      item.shopPrice = 75
      items.push(item)
    }
  }

  // Stock light healing potions (2-3 each of Cure Light and Cure Serious)
  const lightHealing = POTIONS.filter(
    (p) => p.name === 'Potion of Cure Light Wounds' || p.name === 'Potion of Cure Serious Wounds'
  )
  for (const potion of lightHealing) {
    const count = randomInt(2, 3)
    for (let i = 0; i < count; i++) {
      const item = createItem(potion, 0)
      item.shopPrice = Math.floor(potion.tier * 15 * 2.0)
      items.push(item)
    }
  }

  // Stock Phase Door scrolls (2-3)
  const phaseDoor = SCROLLS.find((s) => s.name === 'Scroll of Phase Door')
  if (phaseDoor) {
    const count = randomInt(2, 3)
    for (let i = 0; i < count; i++) {
      const item = createItem(phaseDoor, 0)
      item.shopPrice = Math.floor(phaseDoor.tier * 20 * 2.0)
      items.push(item)
    }
  }

  return items
}

/**
 * Armory: Armor, shields, helms, gloves, boots
 *
 * Inventory tiers scale with maxDepthEver:
 * - Tier 0 (depths 1-14): Tier 1-2 equipment
 * - Tier 1 (depths 15-29): Tier 2-3 equipment
 * - Tier 2 (depths 30+): Tier 3-4 equipment
 */
function generateArmoryInventory(maxDepthEver: number): Item[] {
  const items: Item[] = []
  const tier = maxDepthEver >= 30 ? 2 : maxDepthEver >= 15 ? 1 : 0

  // Determine tier range based on progression
  const minTier = tier + 1 // 1, 2, or 3
  const maxTier = tier + 2 // 2, 3, or 4

  // Filter for armor-type items in tier range
  const armorTypes: ItemTemplate['slot'][] = ['body', 'shield', 'helm', 'gloves', 'boots']
  const armorItems = ALL_EQUIPMENT.filter(
    (e) => e.slot && armorTypes.includes(e.slot) && e.tier >= minTier && e.tier <= maxTier
  )

  // Stock 6-8 random armor pieces (more at higher tiers)
  const count = randomInt(6 + tier, 8 + tier)
  for (let i = 0; i < count && armorItems.length > 0; i++) {
    const template = armorItems[randomInt(0, armorItems.length - 1)]!
    const item = createItem(template, 0)
    item.shopPrice = Math.floor(template.tier * 50 * 2.0)
    items.push(item)
  }

  return items
}

/**
 * Weapon Smithy: Weapons and bows
 *
 * Inventory tiers scale with maxDepthEver:
 * - Tier 0 (depths 1-14): Tier 1-2 weapons
 * - Tier 1 (depths 15-29): Tier 2-3 weapons
 * - Tier 2 (depths 30+): Tier 3-4 weapons
 */
function generateWeaponShopInventory(maxDepthEver: number): Item[] {
  const items: Item[] = []
  const tier = maxDepthEver >= 30 ? 2 : maxDepthEver >= 15 ? 1 : 0

  // Determine tier range based on progression
  const minTier = tier + 1 // 1, 2, or 3
  const maxTier = tier + 2 // 2, 3, or 4

  // Filter for weapon-type items in tier range
  const weaponTypes: ItemTemplate['slot'][] = ['weapon', 'bow']
  const weaponItems = ALL_EQUIPMENT.filter(
    (e) => e.slot && weaponTypes.includes(e.slot) && e.tier >= minTier && e.tier <= maxTier
  )

  // Stock 6-8 random weapons (more at higher tiers)
  const count = randomInt(6 + tier, 8 + tier)
  for (let i = 0; i < count && weaponItems.length > 0; i++) {
    const template = weaponItems[randomInt(0, weaponItems.length - 1)]!
    const item = createItem(template, 0)
    item.shopPrice = Math.floor(template.tier * 50 * 2.0)
    items.push(item)
  }

  return items
}

/**
 * Alchemy Shop: Healing potions, utility potions, cure potions
 *
 * Inventory tiers scale with maxDepthEver:
 * - Tier 0 (depths 1-14): Cure Light/Serious, Neutralize Poison
 * - Tier 1 (depths 15-29): + Cure Critical, Free Action, Clarity
 * - Tier 2 (depths 30+): + Healing, Heroism, Restoration
 */
function generateAlchemyShopInventory(maxDepthEver: number): Item[] {
  const items: Item[] = []
  const tier = maxDepthEver >= 30 ? 2 : maxDepthEver >= 15 ? 1 : 0

  // Tier 0: Basic healing potions
  const basicHealing = POTIONS.filter(
    (p) => p.name === 'Potion of Cure Light Wounds' || p.name === 'Potion of Cure Serious Wounds'
  )
  for (const potion of basicHealing) {
    const count = randomInt(3, 5)
    for (let i = 0; i < count; i++) {
      const item = createItem(potion, 0)
      item.shopPrice = Math.floor(potion.tier * 15 * 1.8)
      items.push(item)
    }
  }

  // Tier 1+: Add Cure Critical Wounds
  if (tier >= 1) {
    const cureCritical = POTIONS.find((p) => p.name === 'Potion of Cure Critical Wounds')
    if (cureCritical) {
      const count = randomInt(2, 4)
      for (let i = 0; i < count; i++) {
        const item = createItem(cureCritical, 0)
        item.shopPrice = Math.floor(cureCritical.tier * 20 * 1.8)
        items.push(item)
      }
    }

    // Free Action and Clarity potions
    const freeAction = POTIONS.find((p) => p.name === 'Potion of Free Action')
    if (freeAction) {
      const count = randomInt(2, 3)
      for (let i = 0; i < count; i++) {
        const item = createItem(freeAction, 0)
        item.shopPrice = Math.floor(freeAction.tier * 25 * 1.8)
        items.push(item)
      }
    }

    const clarity = POTIONS.find((p) => p.name === 'Potion of Clarity')
    if (clarity) {
      const count = randomInt(2, 3)
      for (let i = 0; i < count; i++) {
        const item = createItem(clarity, 0)
        item.shopPrice = Math.floor(clarity.tier * 25 * 1.8)
        items.push(item)
      }
    }
  }

  // Tier 2: Add Healing, Heroism, and Restoration potions
  if (tier >= 2) {
    const healingPotion = POTIONS.find((p) => p.name === 'Potion of Healing')
    if (healingPotion) {
      const count = randomInt(2, 3)
      for (let i = 0; i < count; i++) {
        const item = createItem(healingPotion, 0)
        item.shopPrice = Math.floor(healingPotion.tier * 25 * 1.8)
        items.push(item)
      }
    }

    const heroismPotion = POTIONS.find((p) => p.name === 'Potion of Heroism')
    if (heroismPotion) {
      const count = randomInt(1, 2)
      for (let i = 0; i < count; i++) {
        const item = createItem(heroismPotion, 0)
        item.shopPrice = Math.floor(heroismPotion.tier * 30 * 2.0)
        items.push(item)
      }
    }

    // Restoration potion
    const restoration = POTIONS.find((p) => p.name === 'Potion of Restoration')
    if (restoration) {
      const count = randomInt(1, 2)
      for (let i = 0; i < count; i++) {
        const item = createItem(restoration, 0)
        item.shopPrice = Math.floor(restoration.tier * 35 * 1.8)
        items.push(item)
      }
    }
  }

  // Utility potions: Speed, Neutralize Poison, Restore Mana
  const utilityPotions = POTIONS.filter(
    (p) =>
      p.name.includes('Speed') || p.name.includes('Neutralize') || p.name.includes('Restore Mana')
  )
  for (const potion of utilityPotions) {
    // More utility potions at higher tiers
    const count = randomInt(2 + tier, 3 + tier)
    for (let i = 0; i < count; i++) {
      const item = createItem(potion, 0)
      item.shopPrice = Math.floor(potion.tier * 20 * 1.8)
      items.push(item)
    }
  }

  return items
}

/**
 * Magic Shop: Scrolls (Town Portal, Phase Door, Teleport, Light, Mapping)
 *
 * Inventory tiers scale with maxDepthEver:
 * - Tier 0 (depths 1-14): Basic scrolls
 * - Tier 1 (depths 15-29): + Teleport Level, Blessing, more quantities
 * - Tier 2 (depths 30+): + Protection from Evil, Enchant scrolls
 */
function generateMagicShopInventory(maxDepthEver: number): Item[] {
  const items: Item[] = []
  const tier = maxDepthEver >= 30 ? 2 : maxDepthEver >= 15 ? 1 : 0

  // Always stock Town Portal Scrolls (more at higher tiers)
  const tpScroll = SCROLLS.find((s) => s.name === 'Scroll of Town Portal')
  if (tpScroll) {
    const count = randomInt(4 + tier, 6 + tier * 2)
    for (let i = 0; i < count; i++) {
      const item = createItem(tpScroll, 0)
      item.shopPrice = 75
      items.push(item)
    }
  }

  // Stock teleport scrolls (Phase Door, Teleportation)
  const teleportScrolls = SCROLLS.filter(
    (s) => s.name.includes('Phase Door') || s.name.includes('Teleportation')
  )
  for (const scroll of teleportScrolls) {
    const count = randomInt(3 + tier, 4 + tier)
    for (let i = 0; i < count; i++) {
      const item = createItem(scroll, 0)
      item.shopPrice = Math.floor(scroll.tier * 20 * 2.2)
      items.push(item)
    }
  }

  // Stock utility scrolls (Light, Magic Mapping)
  const utilityScrolls = SCROLLS.filter(
    (s) => s.name.includes('Light') || s.name.includes('Magic Mapping')
  )
  for (const scroll of utilityScrolls) {
    const count = randomInt(2, 3)
    for (let i = 0; i < count; i++) {
      const item = createItem(scroll, 0)
      item.shopPrice = Math.floor(scroll.tier * 15 * 2.2)
      items.push(item)
    }
  }

  // Tier 1+: Add Teleport Level and Blessing scrolls
  if (tier >= 1) {
    const teleportLevel = SCROLLS.find((s) => s.name === 'Scroll of Teleport Level')
    if (teleportLevel) {
      const count = randomInt(2, 3)
      for (let i = 0; i < count; i++) {
        const item = createItem(teleportLevel, 0)
        item.shopPrice = Math.floor(teleportLevel.tier * 25 * 2.2)
        items.push(item)
      }
    }

    const blessing = SCROLLS.find((s) => s.name === 'Scroll of Blessing')
    if (blessing) {
      const count = randomInt(2, 3)
      for (let i = 0; i < count; i++) {
        const item = createItem(blessing, 0)
        item.shopPrice = Math.floor(blessing.tier * 20 * 2.0)
        items.push(item)
      }
    }
  }

  // Tier 2: Add Protection from Evil and Enchant scrolls
  if (tier >= 2) {
    const protection = SCROLLS.find((s) => s.name === 'Scroll of Protection from Evil')
    if (protection) {
      const count = randomInt(1, 2)
      for (let i = 0; i < count; i++) {
        const item = createItem(protection, 0)
        item.shopPrice = Math.floor(protection.tier * 30 * 2.0)
        items.push(item)
      }
    }

    // Enchant scrolls (weapon and armor)
    const enchantWeapon = SCROLLS.find((s) => s.name === 'Scroll of Enchant Weapon')
    if (enchantWeapon) {
      const count = randomInt(1, 2)
      for (let i = 0; i < count; i++) {
        const item = createItem(enchantWeapon, 0)
        item.shopPrice = Math.floor(enchantWeapon.tier * 40 * 2.0)
        items.push(item)
      }
    }

    const enchantArmor = SCROLLS.find((s) => s.name === 'Scroll of Enchant Armor')
    if (enchantArmor) {
      const count = randomInt(1, 2)
      for (let i = 0; i < count; i++) {
        const item = createItem(enchantArmor, 0)
        item.shopPrice = Math.floor(enchantArmor.tier * 40 * 2.0)
        items.push(item)
      }
    }
  }

  return items
}

// ============================================================================
// HEALER INTERACTION
// ============================================================================

/**
 * Use the healer to restore HP
 *
 * Costs gold based on HP missing (cheaper than potions).
 */
export function useHealer(game: GameState): ActionResult {
  if (!game.healer) {
    return { success: false, message: 'No healer available', energyCost: 0 }
  }

  const character = game.character
  const healer = game.healer

  // Check if adjacent to healer
  const dx = Math.abs(character.position.x - healer.position.x)
  const dy = Math.abs(character.position.y - healer.position.y)
  if (dx > 1 || dy > 1) {
    return { success: false, message: 'You are not near the healer', energyCost: 0 }
  }

  // Check if needs healing
  const hpMissing = character.maxHp - character.hp
  if (hpMissing <= 0) {
    return { success: false, message: 'You are already at full health', energyCost: 0 }
  }

  // Calculate cost
  const cost = Math.ceil(hpMissing * healer.costPerHP)

  // Check if can afford
  if (character.gold < cost) {
    // Partial heal with available gold
    const affordableHp = Math.floor(character.gold / healer.costPerHP)
    if (affordableHp <= 0) {
      return { success: false, message: 'You cannot afford healing', energyCost: 0 }
    }
    character.hp += affordableHp
    character.gold = 0
    return {
      success: true,
      message: `Healed ${affordableHp} HP (spent all your gold)`,
      energyCost: 100,
    }
  }

  // Full heal
  character.hp = character.maxHp
  character.gold -= cost

  return {
    success: true,
    message: `Healed to full HP for ${cost} gold`,
    energyCost: 100,
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if player is in town (depth 0)
 */
export function isInTown(game: GameState): boolean {
  return game.character.depth === 0
}

/**
 * Check if player is standing on the portal tile
 */
export function isOnPortal(game: GameState): boolean {
  const tile = getTile(game.currentLevel, game.character.position.x, game.character.position.y)
  return tile?.type === 'portal'
}

/**
 * Check if player is standing on the dungeon entrance
 */
export function isOnDungeonEntrance(game: GameState): boolean {
  const tile = getTile(game.currentLevel, game.character.position.x, game.character.position.y)
  return tile?.type === 'dungeon_entrance'
}

/**
 * Check if player is adjacent to healer
 */
export function isAdjacentToHealer(game: GameState): boolean {
  if (!game.healer) return false
  const dx = Math.abs(game.character.position.x - game.healer.position.x)
  const dy = Math.abs(game.character.position.y - game.healer.position.y)
  return dx <= 1 && dy <= 1
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PORTAL_DURATION,
  HEALER_COST_PER_HP,
  PORTAL_SPAWN_POSITION,
  DUNGEON_ENTRANCE_POSITION,
  HEALER_POSITION,
  TOWN_SHOP_IDS,
  TOWN_SHOP_POSITIONS,
}
