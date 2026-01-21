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
  MerchantState,
  ActionResult,
  Item,
} from './types'
import {
  TOWN_LAYOUT,
  TOWN_WIDTH,
  TOWN_HEIGHT,
  HEALER_POSITION,
  MERCHANT_POSITION,
  DUNGEON_ENTRANCE_POSITION,
  PORTAL_SPAWN_POSITION,
  HEALER_COST_PER_HP,
  PORTAL_DURATION,
} from './data/town'
import { getTile, setTile, computeFOV } from './dungeon'
import { FOV_RADIUS } from './types'
import { initializeMerchant } from './features'
import { SCROLLS, POTIONS } from './data/items'
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
 */
function charToTileType(char: string): TileType {
  switch (char) {
    case '#':
      return 'wall'
    case '.':
      return 'floor'
    case 'H':
      return 'healer'
    case 'M':
      return 'floor' // Merchant stands on floor
    case '<':
      return 'dungeon_entrance'
    case '@':
      return 'floor' // Spawn point is just floor
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
 * Saves current dungeon state and teleports player to town.
 */
export function enterTown(game: GameState): void {
  if (!game.townPortal) return

  // Save current level state to cache
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

  // Update FOV - town is fully visible
  computeFOV(townLevel, game.character.position, FOV_RADIUS)

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

  // Respawn monsters and items (simplified - full implementation would persist)
  // For now, this is handled by the game loop when depth changes

  // Update FOV
  computeFOV(dungeonLevel, game.character.position, FOV_RADIUS)

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
 * Initialize town features (healer, merchant)
 */
function initializeTown(game: GameState): void {
  // Initialize healer
  game.healer = {
    position: { ...HEALER_POSITION },
    costPerHP: HEALER_COST_PER_HP,
  }

  // Initialize merchant with town portal scrolls and consumables
  game.merchants = []
  const townMerchant = initializeTownMerchant()
  if (townMerchant) {
    game.merchants.push(townMerchant)
  }

  // Reset features
  game.fountains = new Map()
  game.altars = new Map()
  game.traps = new Map()
}

/**
 * Initialize town merchant with appropriate stock
 * Town merchant sells consumables including Town Portal Scrolls
 */
function initializeTownMerchant(): MerchantState | null {
  // Use the wandering_trader template for town
  const merchant = initializeMerchant(
    'wandering_trader',
    { ...MERCHANT_POSITION },
    1, // Low depth for basic item tiers
    generateTownMerchantInventory
  )
  if (!merchant) return null

  // Town merchant has more gold
  merchant.gold = 5000

  return merchant
}

/**
 * Generate inventory for the town merchant
 * Includes Town Portal Scrolls and basic consumables
 */
function generateTownMerchantInventory(_merchantId: string, _depth: number): Item[] {
  const items: Item[] = []

  // Always stock Town Portal Scrolls (3-5)
  const tpScroll = SCROLLS.find(s => s.name === 'Scroll of Town Portal')
  if (tpScroll) {
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const item = createItem(tpScroll, 0)
      // Set shop price (roughly 2.5x base value since tier 2)
      item.shopPrice = 75
      items.push(item)
    }
  }

  // Stock healing potions
  const healingPotions = POTIONS.filter(p =>
    p.name.includes('Cure') || p.name.includes('Healing')
  )
  for (const potion of healingPotions.slice(0, 3)) {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const item = createItem(potion, 0)
      item.shopPrice = Math.floor(potion.tier * 15 * 2.5)
      items.push(item)
    }
  }

  // Stock teleport scrolls
  const teleportScrolls = SCROLLS.filter(s =>
    s.name.includes('Phase Door') || s.name.includes('Teleportation')
  )
  for (const scroll of teleportScrolls) {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const item = createItem(scroll, 0)
      item.shopPrice = Math.floor(scroll.tier * 20 * 2.5)
      items.push(item)
    }
  }

  // Stock speed potions
  const speedPotion = POTIONS.find(p => p.name.includes('Speed'))
  if (speedPotion) {
    const count = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) {
      const item = createItem(speedPotion, 0)
      item.shopPrice = 50
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
  MERCHANT_POSITION,
}
