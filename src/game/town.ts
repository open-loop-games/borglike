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
import { getTile, setTile, computeFOV } from './dungeon'
import { calculateLightRadius } from './lighting'
import { initializeMerchant, initializeFeaturesFromVault } from './features'
import { saveLevelEntities, loadLevelEntities } from './level-cache'
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
 * All non-wall characters are walkable floor tiles.
 * The visual characters (,, ~, 1-5) create variety but don't block movement.
 */
function charToTileType(char: string): TileType {
  switch (char) {
    case '#':
      return 'wall'
    case '<':
      return 'dungeon_entrance'
    case 'H':
      return 'healer'
    // All decorative and floor characters map to 'floor'
    case '.':
    case ',': // Cobblestone
    case '~': // Well (decorative)
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
  const portal: TownPortalState = {
    dungeonPosition: { ...game.character.position },
    dungeonDepth: game.character.depth,
    createdTurn: game.turn,
    turnsRemaining: PORTAL_DURATION,
    townPosition: { ...PORTAL_SPAWN_POSITION },
  }

  // Place portal tile in dungeon at player's position
  setTile(game.currentLevel, game.character.position.x, game.character.position.y, 'portal')

  return portal
}

/**
 * Enter town through portal
 *
 * Saves current dungeon state (including entities) and teleports player to town.
 */
export function enterTown(game: GameState): void {
  if (!game.townPortal) return

  // Save current level entities (monsters, items, features) to cache
  saveLevelEntities(game)

  // Save current level geometry to cache
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

  // Update FOV - town is fully visible (calculateLightRadius returns MAX for depth 0)
  const lightRadius = calculateLightRadius(game.character, 0)
  computeFOV(townLevel, game.character.position, lightRadius)

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

  // Restore entities from cache, or spawn fresh if not cached
  const cachedEntities = loadLevelEntities(game.entityCache, portal.dungeonDepth)
  if (cachedEntities) {
    // Restore cached entities (monsters, items, features)
    game.monsters = cachedEntities.monsters
    game.items = cachedEntities.items
    game.fountains = cachedEntities.fountains
    game.altars = cachedEntities.altars
    game.merchants = cachedEntities.merchants
    game.traps = cachedEntities.traps
  } else {
    // Spawn fresh entities (fallback if cache was evicted)
    game.monsters = spawnMonstersForLevel(dungeonLevel, portal.dungeonDepth)
    game.items = spawnItemsForLevel(dungeonLevel, portal.dungeonDepth)
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
  }

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
  const dungeonLevel = game.levelCache.get(portal.dungeonDepth)
  if (dungeonLevel) {
    setTile(dungeonLevel, portal.dungeonPosition.x, portal.dungeonPosition.y, 'floor')
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
 */
function initializeTown(game: GameState): void {
  // Initialize healer
  game.healer = {
    position: { ...HEALER_POSITION },
    costPerHP: HEALER_COST_PER_HP,
  }

  // Initialize all 5 town shops
  game.merchants = []
  for (const shopId of TOWN_SHOP_IDS) {
    const position = TOWN_SHOP_POSITIONS[shopId]
    const merchant = initializeMerchant(
      shopId,
      { ...position },
      0, // Town level (depth 0)
      generateTownShopInventory
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
 * Generate inventory for town shops based on shop type
 */
function generateTownShopInventory(merchantId: string, _depth: number): Item[] {
  switch (merchantId as TownShopId) {
    case 'town_general':
      return generateGeneralStoreInventory()
    case 'town_armory':
      return generateArmoryInventory()
    case 'town_weapons':
      return generateWeaponShopInventory()
    case 'town_alchemy':
      return generateAlchemyShopInventory()
    case 'town_magic':
      return generateMagicShopInventory()
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
  const tpScroll = SCROLLS.find(s => s.name === 'Scroll of Town Portal')
  if (tpScroll) {
    const count = randomInt(3, 5)
    for (let i = 0; i < count; i++) {
      const item = createItem(tpScroll, 0)
      item.shopPrice = 75
      items.push(item)
    }
  }

  // Stock light healing potions (2-3 each of Cure Light and Cure Serious)
  const lightHealing = POTIONS.filter(p =>
    p.name === 'Potion of Cure Light Wounds' || p.name === 'Potion of Cure Serious Wounds'
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
  const phaseDoor = SCROLLS.find(s => s.name === 'Scroll of Phase Door')
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
 * Armory: Armor, shields, helms, gloves, boots (tier 1-2)
 */
function generateArmoryInventory(): Item[] {
  const items: Item[] = []

  // Filter for armor-type items (tier 1-2)
  const armorTypes: ItemTemplate['slot'][] = ['body', 'shield', 'helm', 'gloves', 'boots']
  const armorItems = ALL_EQUIPMENT.filter(e =>
    e.slot && armorTypes.includes(e.slot) && e.tier <= 2
  )

  // Stock 6-8 random armor pieces
  const count = randomInt(6, 8)
  for (let i = 0; i < count && armorItems.length > 0; i++) {
    const template = armorItems[randomInt(0, armorItems.length - 1)]!
    const item = createItem(template, 0)
    item.shopPrice = Math.floor(template.tier * 50 * 2.0)
    items.push(item)
  }

  return items
}

/**
 * Weapon Smithy: Weapons and bows (tier 1-2)
 */
function generateWeaponShopInventory(): Item[] {
  const items: Item[] = []

  // Filter for weapon-type items (tier 1-2)
  const weaponTypes: ItemTemplate['slot'][] = ['weapon', 'bow']
  const weaponItems = ALL_EQUIPMENT.filter(e =>
    e.slot && weaponTypes.includes(e.slot) && e.tier <= 2
  )

  // Stock 6-8 random weapons
  const count = randomInt(6, 8)
  for (let i = 0; i < count && weaponItems.length > 0; i++) {
    const template = weaponItems[randomInt(0, weaponItems.length - 1)]!
    const item = createItem(template, 0)
    item.shopPrice = Math.floor(template.tier * 50 * 2.0)
    items.push(item)
  }

  return items
}

/**
 * Alchemy Shop: All healing potions, utility potions (speed, neutralize)
 */
function generateAlchemyShopInventory(): Item[] {
  const items: Item[] = []

  // Stock all healing potions (2-4 each)
  const healingPotions = POTIONS.filter(p =>
    p.name.includes('Cure') || p.name.includes('Healing')
  )
  for (const potion of healingPotions) {
    const count = randomInt(2, 4)
    for (let i = 0; i < count; i++) {
      const item = createItem(potion, 0)
      item.shopPrice = Math.floor(potion.tier * 15 * 1.8)
      items.push(item)
    }
  }

  // Stock utility potions (speed, neutralize poison, restore mana)
  const utilityPotions = POTIONS.filter(p =>
    p.name.includes('Speed') || p.name.includes('Neutralize') || p.name.includes('Restore Mana')
  )
  for (const potion of utilityPotions) {
    const count = randomInt(2, 3)
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
 */
function generateMagicShopInventory(): Item[] {
  const items: Item[] = []

  // Always stock Town Portal Scrolls (4-6, main source)
  const tpScroll = SCROLLS.find(s => s.name === 'Scroll of Town Portal')
  if (tpScroll) {
    const count = randomInt(4, 6)
    for (let i = 0; i < count; i++) {
      const item = createItem(tpScroll, 0)
      item.shopPrice = 75
      items.push(item)
    }
  }

  // Stock teleport scrolls (Phase Door, Teleportation)
  const teleportScrolls = SCROLLS.filter(s =>
    s.name.includes('Phase Door') || s.name.includes('Teleportation')
  )
  for (const scroll of teleportScrolls) {
    const count = randomInt(3, 4)
    for (let i = 0; i < count; i++) {
      const item = createItem(scroll, 0)
      item.shopPrice = Math.floor(scroll.tier * 20 * 2.2)
      items.push(item)
    }
  }

  // Stock utility scrolls (Light, Magic Mapping)
  const utilityScrolls = SCROLLS.filter(s =>
    s.name.includes('Light') || s.name.includes('Magic Mapping')
  )
  for (const scroll of utilityScrolls) {
    const count = randomInt(2, 3)
    for (let i = 0; i < count; i++) {
      const item = createItem(scroll, 0)
      item.shopPrice = Math.floor(scroll.tier * 15 * 2.2)
      items.push(item)
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
