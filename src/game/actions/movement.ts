/**
 * Movement Action Handlers for Borglike
 *
 * Handles player movement, ascending, and descending stairs.
 */

import type {
  GameState,
  ActionResult,
  Direction,
  FountainState,
  AltarState,
  TrapState,
} from '../types'
import {
  DIRECTION_VECTORS as DirectionVectors,
  MAX_DEPTH,
} from '../types'
import { calculateLightRadius } from '../lighting'
import {
  generateLevel,
  getTile,
  isWalkable,
  computeFOV,
  findOpenPosition,
} from '../dungeon'
import { spawnMonstersForLevel } from '../monster-ai'
import { spawnItemsForLevel, generateMerchantInventory } from '../items'
import { triggerTrap, checkTrapDetection, initializeFeaturesFromVault } from '../features'
import {
  touchLevelCache,
  evictOldLevels,
  LEVEL_CACHE_MAX_SIZE,
} from '../level-cache'
import { isInTown } from '../town'
import { addMessage } from './helpers'
import { handleAttack } from './combat'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base energy cost for actions (100 = 1 turn) */
export const BASE_ENERGY_COST = 100

// ============================================================================
// MOVEMENT
// ============================================================================

/**
 * Handle movement action
 *
 * Checks if target tile is walkable, handles bump-attack on monsters
 */
export function handleMove(game: GameState, direction: Direction): ActionResult {
  if (direction === 'wait') {
    return handleWait(game)
  }

  const delta = DirectionVectors[direction]
  const newX = game.character.position.x + delta.x
  const newY = game.character.position.y + delta.y

  // Check for monster at target position (bump attack)
  const monsterAtTarget = game.monsters.find(
    (m) => m.position.x === newX && m.position.y === newY
  )

  if (monsterAtTarget) {
    return handleAttack(game, monsterAtTarget.id)
  }

  // Check if target tile is walkable
  const targetTile = getTile(game.currentLevel, newX, newY)

  if (!targetTile) {
    return { success: false, message: 'You cannot move there.', energyCost: 0 }
  }

  // Handle closed doors - open them instead of moving
  if (targetTile.type === 'door_closed') {
    targetTile.type = 'door_open'
    addMessage(game, 'You open the door.', 'info')
    return { success: true, energyCost: BASE_ENERGY_COST }
  }

  if (!isWalkable(targetTile)) {
    return { success: false, message: 'You cannot move there.', energyCost: 0 }
  }

  // Execute move
  game.character.position = { x: newX, y: newY }

  // Check for trap at new position
  triggerTrap(game, { x: newX, y: newY })

  // Check for trap detection nearby
  checkTrapDetection(game)

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle wait action
 */
export function handleWait(game: GameState): ActionResult {
  // Waiting allows HP/MP regen (simplified)
  if (game.character.hp < game.character.maxHp) {
    const regenAmount = Math.max(1, Math.floor(game.character.maxHp * 0.01))
    game.character.hp = Math.min(game.character.hp + regenAmount, game.character.maxHp)
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

// ============================================================================
// STAIRS
// ============================================================================

/**
 * Handle descending stairs
 *
 * Check if on stairs down or dungeon entrance (from town), generate/load next level
 */
export function handleDescend(game: GameState): ActionResult {
  const currentTile = getTile(
    game.currentLevel,
    game.character.position.x,
    game.character.position.y
  )

  // Allow descending from stairs_down OR dungeon_entrance (town exit)
  const canDescend =
    currentTile &&
    (currentTile.type === 'stairs_down' || currentTile.type === 'dungeon_entrance')

  if (!canDescend) {
    return { success: false, message: 'There are no stairs here.', energyCost: 0 }
  }

  // From dungeon_entrance (town, depth 0), always go to depth 1
  const newDepth =
    currentTile?.type === 'dungeon_entrance' ? 1 : game.character.depth + 1

  if (newDepth > MAX_DEPTH) {
    return { success: false, message: 'You cannot go any deeper.', energyCost: 0 }
  }

  // NOTE: Entity caching removed - entities regenerate on level entry (Angband-style)
  // Layout is cached in levelCache, but monsters/items are freshly spawned

  // Get or generate new level
  let newLevel = game.levelCache.get(newDepth)

  if (!newLevel) {
    newLevel = generateLevel(newDepth)
    game.levelCache.set(newDepth, newLevel)
    // Evict old levels to limit memory usage
    evictOldLevels(game.levelCache, newDepth, LEVEL_CACHE_MAX_SIZE)
  } else {
    // Touch the level to mark it as recently used
    touchLevelCache(game.levelCache, newDepth)
  }

  // Update game state
  game.currentLevel = newLevel
  game.character.depth = newDepth

  // Place character at stairs up
  if (newLevel.stairsUp) {
    game.character.position = { ...newLevel.stairsUp }
  } else {
    game.character.position = findOpenPosition(newLevel)
  }

  // ENTITY REGENERATION: Always spawn fresh entities on level entry
  // Layout is cached, but monsters/items regenerate (Angband-style)
  // UniqueState ensures unique monsters don't respawn
  game.monsters = spawnMonstersForLevel(newLevel, newDepth, game.balance.monsterHpPercent, game.uniqueState)
  game.items = spawnItemsForLevel(newLevel, newDepth, game.balance.potionRatePercent, game.balance.enchantRatePercent, game.balance.itemRatePercent)

  // Reset features for level entry
  game.fountains = new Map<string, FountainState>()
  game.altars = new Map<string, AltarState>()
  game.merchants = []
  game.traps = new Map<string, TrapState>()

  // Initialize features from vault data (if vault was placed on this level)
  initializeFeaturesFromVault(
    newLevel,
    newDepth,
    game.fountains,
    game.altars,
    game.merchants,
    game.traps,
    generateMerchantInventory
  )

  // Update stats
  if (newDepth > game.stats.deepestDepth) {
    game.stats.deepestDepth = newDepth
  }

  // Update FOV (dynamic light radius)
  const lightRadius = calculateLightRadius(game.character, newDepth)
  computeFOV(newLevel, game.character.position, lightRadius)

  // Clear town-specific state when leaving town
  if (isInTown(game) || currentTile?.type === 'dungeon_entrance') {
    game.healer = null
  }

  const message =
    currentTile?.type === 'dungeon_entrance'
      ? 'You enter the dungeon.'
      : `You descend to depth ${newDepth}.`
  addMessage(game, message, 'info')

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle ascending stairs
 *
 * Check if on stairs up, load previous level
 */
export function handleAscend(game: GameState): ActionResult {
  const currentTile = getTile(
    game.currentLevel,
    game.character.position.x,
    game.character.position.y
  )

  if (!currentTile || currentTile.type !== 'stairs_up') {
    return { success: false, message: 'There are no stairs here.', energyCost: 0 }
  }

  if (game.character.depth <= 1) {
    return { success: false, message: 'You cannot leave the dungeon.', energyCost: 0 }
  }

  const newDepth = game.character.depth - 1

  // NOTE: Entity caching removed - entities regenerate on level entry (Angband-style)

  // Load previous level
  const previousLevel = game.levelCache.get(newDepth)

  if (!previousLevel) {
    return { success: false, message: 'Previous level not found.', energyCost: 0 }
  }

  // Touch the level to mark it as recently used (LRU)
  touchLevelCache(game.levelCache, newDepth)

  // Update game state
  game.currentLevel = previousLevel
  game.character.depth = newDepth

  // Place character at stairs down
  if (previousLevel.stairsDown) {
    game.character.position = { ...previousLevel.stairsDown }
  } else {
    game.character.position = findOpenPosition(previousLevel)
  }

  // ENTITY REGENERATION: Always spawn fresh entities on level entry
  // Layout is cached, but monsters/items regenerate (Angband-style)
  // UniqueState ensures unique monsters don't respawn
  game.monsters = spawnMonstersForLevel(previousLevel, newDepth, game.balance.monsterHpPercent, game.uniqueState)
  game.items = spawnItemsForLevel(previousLevel, newDepth, game.balance.potionRatePercent, game.balance.enchantRatePercent, game.balance.itemRatePercent)

  // Reset features for level entry
  game.fountains = new Map<string, FountainState>()
  game.altars = new Map<string, AltarState>()
  game.merchants = []
  game.traps = new Map<string, TrapState>()

  // Initialize features from vault data (if vault was placed on this level)
  initializeFeaturesFromVault(
    previousLevel,
    newDepth,
    game.fountains,
    game.altars,
    game.merchants,
    game.traps,
    generateMerchantInventory
  )

  // Update FOV (dynamic light radius)
  const lightRadius = calculateLightRadius(game.character, newDepth)
  computeFOV(previousLevel, game.character.position, lightRadius)

  addMessage(game, `You ascend to depth ${newDepth}.`, 'info')

  return { success: true, energyCost: BASE_ENERGY_COST }
}

