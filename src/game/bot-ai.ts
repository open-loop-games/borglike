/**
 * Bot AI for Borglike Auto-Player
 *
 * Implements decision making for automated dungeon crawling.
 * Supports different personalities that affect risk tolerance and priorities.
 */

import type {
  GameState,
  GameAction,
  BotPersonality,
  BotContext,
  Monster,
  Item,
  Point,
  Direction,
} from './types'
import { FOV_RADIUS, getDirectionFromDelta, DIRECTION_VECTORS } from './types'
import {
  getTile,
  isWalkable,
  computeFOV,
  findPath,
  distance,
  getAdjacentPositions,
} from './dungeon'

// ============================================================================
// CONSTANTS
// ============================================================================

/** HP thresholds for retreat by personality (as fraction of max HP) */
const RETREAT_THRESHOLDS: Record<BotPersonality, number> = {
  cautious: 0.6, // Retreat at 60% HP
  aggressive: 0.2, // Retreat at 20% HP
  greedy: 0.4, // Retreat at 40% HP
  speedrunner: 0.3, // Retreat at 30% HP
}

/** HP thresholds for using healing items */
const HEAL_THRESHOLDS: Record<BotPersonality, number> = {
  cautious: 0.7, // Heal at 70% HP
  aggressive: 0.3, // Heal at 30% HP
  greedy: 0.5, // Heal at 50% HP
  speedrunner: 0.4, // Heal at 40% HP
}

/** How much the bot values items vs safety (higher = greedier) */
const GREED_FACTOR: Record<BotPersonality, number> = {
  cautious: 0.3,
  aggressive: 0.5,
  greedy: 1.0,
  speedrunner: 0.1,
}

/** How much the bot prioritizes descending */
const DESCENT_PRIORITY: Record<BotPersonality, number> = {
  cautious: 0.3,
  aggressive: 0.5,
  greedy: 0.4,
  speedrunner: 1.0,
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build the decision context for the bot
 *
 * Gathers information about visible monsters, items, and exploration state.
 */
export function buildBotContext(game: GameState, personality: BotPersonality): BotContext {
  const level = game.currentLevel
  const playerPos = game.character.position

  // Compute FOV to know what's visible
  const visibleTiles = computeFOV(level, playerPos, FOV_RADIUS)

  // Find visible monsters
  const visibleMonsters = game.monsters.filter((m) => {
    const key = `${m.position.x},${m.position.y}`
    return visibleTiles.has(key)
  })

  // Find visible items (items on the ground)
  const visibleItems = game.items.filter((item) => {
    const key = `${item.position.x},${item.position.y}`
    return visibleTiles.has(key)
  })

  // Find known stairs (if explored)
  let knownStairs: Point | null = null
  if (level.stairsDown) {
    const stairTile = getTile(level, level.stairsDown.x, level.stairsDown.y)
    if (stairTile?.explored) {
      knownStairs = level.stairsDown
    }
  }

  // Find unexplored but reachable tiles (frontier)
  const unexploredTiles = findUnexploredTiles(game)

  return {
    game,
    personality,
    visibleMonsters,
    visibleItems,
    knownStairs,
    unexploredTiles,
  }
}

/**
 * Find unexplored tiles adjacent to explored areas
 */
function findUnexploredTiles(game: GameState): Point[] {
  const level = game.currentLevel
  const frontier: Point[] = []
  const seen = new Set<string>()

  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue

    for (let x = 0; x < level.width; x++) {
      const tile = row[x]
      if (!tile) continue

      // Look for explored tiles next to unexplored walkable tiles
      if (tile.explored && isWalkable(tile)) {
        const adjacent = getAdjacentPositions({ x, y })
        for (const adj of adjacent) {
          const adjTile = getTile(level, adj.x, adj.y)
          if (adjTile && !adjTile.explored && isWalkable(adjTile)) {
            const key = `${adj.x},${adj.y}`
            if (!seen.has(key)) {
              seen.add(key)
              frontier.push(adj)
            }
          }
        }
      }
    }
  }

  return frontier
}

// ============================================================================
// DECISION MAKING
// ============================================================================

/**
 * Main bot decision function
 *
 * Returns the best action for the current situation based on personality.
 *
 * Priority order:
 * 1. Survival (retreat/heal if low HP)
 * 2. Combat (fight adjacent enemies or flee from dangerous ones)
 * 3. Items (pick up valuable items nearby)
 * 4. Exploration (move toward unexplored areas or stairs)
 */
export function decideAction(context: BotContext): GameAction {
  // 1. Check if we need to heal or retreat
  const survivalAction = checkSurvival(context)
  if (survivalAction) {
    return survivalAction
  }

  // 2. Check for combat situations
  const combatAction = checkCombat(context)
  if (combatAction) {
    return combatAction
  }

  // 3. Check for items to pick up
  const itemAction = checkItems(context)
  if (itemAction) {
    return itemAction
  }

  // 4. Explore or descend
  const exploreAction = checkExploration(context)
  if (exploreAction) {
    return exploreAction
  }

  // 5. Default: wait
  return { type: 'wait' }
}

// ============================================================================
// SURVIVAL CHECKS
// ============================================================================

/**
 * Check if bot needs to heal or retreat
 */
function checkSurvival(context: BotContext): GameAction | null {
  const { game, personality, visibleMonsters } = context
  const char = game.character
  const hpPercent = char.hp / char.maxHp

  // Check if we should use a healing item
  const healThreshold = HEAL_THRESHOLDS[personality]
  if (hpPercent < healThreshold) {
    const healAction = tryUseHealingItem(context)
    if (healAction) {
      return healAction
    }
  }

  // Check if we should retreat
  const retreatThreshold = RETREAT_THRESHOLDS[personality]
  if (hpPercent < retreatThreshold && visibleMonsters.length > 0) {
    const retreatAction = tryRetreat(context)
    if (retreatAction) {
      return retreatAction
    }
  }

  return null
}

/**
 * Try to use a healing potion
 */
function tryUseHealingItem(context: BotContext): GameAction | null {
  const { game } = context

  // Find healing potions in inventory
  const healingPotion = game.character.inventory.find(
    (item) =>
      item.template.type === 'potion' &&
      (item.template.effect?.includes('Heal') || item.template.effect?.includes('Cure'))
  )

  if (healingPotion) {
    return { type: 'use', itemId: healingPotion.id }
  }

  return null
}

/**
 * Try to retreat from enemies
 */
function tryRetreat(context: BotContext): GameAction | null {
  const { game, visibleMonsters } = context
  const playerPos = game.character.position

  if (visibleMonsters.length === 0) {
    return null
  }

  // Calculate average monster position
  let avgX = 0
  let avgY = 0
  for (const m of visibleMonsters) {
    avgX += m.position.x
    avgY += m.position.y
  }
  avgX /= visibleMonsters.length
  avgY /= visibleMonsters.length

  // Move away from average monster position
  const retreatDir = getDirectionAwayFrom(playerPos, { x: avgX, y: avgY })
  if (retreatDir) {
    // Verify the retreat position is valid
    const delta = getDirectionDelta(retreatDir)
    const newPos = { x: playerPos.x + delta.x, y: playerPos.y + delta.y }
    const tile = getTile(game.currentLevel, newPos.x, newPos.y)

    if (tile && isWalkable(tile)) {
      // Check no monster is there
      const blocked = game.monsters.some(
        (m) => m.position.x === newPos.x && m.position.y === newPos.y
      )
      if (!blocked) {
        return { type: 'move', direction: retreatDir }
      }
    }
  }

  // Try teleport scroll if retreat is blocked
  const teleportScroll = game.character.inventory.find(
    (item) => item.template.type === 'scroll' && item.template.effect?.includes('Teleport')
  )
  if (teleportScroll) {
    return { type: 'use', itemId: teleportScroll.id }
  }

  return null
}

// ============================================================================
// COMBAT CHECKS
// ============================================================================

/**
 * Check for combat situations
 */
function checkCombat(context: BotContext): GameAction | null {
  const { game, personality, visibleMonsters } = context
  const playerPos = game.character.position

  // Find adjacent monsters
  const adjacentMonsters = visibleMonsters.filter(
    (m) => Math.abs(m.position.x - playerPos.x) <= 1 && Math.abs(m.position.y - playerPos.y) <= 1
  )

  // If adjacent to a monster, attack it
  if (adjacentMonsters.length > 0) {
    // Pick the weakest one (lowest HP)
    adjacentMonsters.sort((a, b) => a.hp - b.hp)
    const target = adjacentMonsters[0]
    if (target) {
      return { type: 'attack', targetId: target.id }
    }
  }

  // Aggressive personality: move toward nearest visible monster
  if (personality === 'aggressive' && visibleMonsters.length > 0) {
    const nearest = findNearestMonster(playerPos, visibleMonsters)
    if (nearest) {
      const moveAction = moveToward(game, playerPos, nearest.position)
      if (moveAction) {
        return moveAction
      }
    }
  }

  return null
}

/**
 * Find the nearest monster to a position
 */
function findNearestMonster(pos: Point, monsters: Monster[]): Monster | null {
  if (monsters.length === 0) return null

  let nearest: Monster | null = null
  let nearestDist = Infinity

  for (const m of monsters) {
    const dist = distance(pos, m.position)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = m
    }
  }

  return nearest
}

// ============================================================================
// ITEM CHECKS
// ============================================================================

/**
 * Check for items to pick up
 */
function checkItems(context: BotContext): GameAction | null {
  const { game, personality, visibleItems, visibleMonsters } = context
  const playerPos = game.character.position
  const greedFactor = GREED_FACTOR[personality]

  // Check for items at current position
  const itemsHere = visibleItems.filter(
    (item) => item.position.x === playerPos.x && item.position.y === playerPos.y
  )

  if (itemsHere.length > 0) {
    // Pick up the first valuable item
    const valuable = itemsHere.find((item) => isValuableItem(item, game))
    if (valuable) {
      return { type: 'pickup', itemId: valuable.id }
    }
  }

  // Consider moving toward nearby items (if safe and greedy enough)
  if (greedFactor > 0.3 && visibleMonsters.length === 0) {
    const valuableNearby = visibleItems.find(
      (item) => isValuableItem(item, game) && distance(playerPos, item.position) <= 5
    )

    if (valuableNearby) {
      const moveAction = moveToward(game, playerPos, valuableNearby.position)
      if (moveAction) {
        return moveAction
      }
    }
  }

  // Check if we should equip something better
  const equipAction = checkEquipment(context)
  if (equipAction) {
    return equipAction
  }

  return null
}

/**
 * Check if an item is valuable enough to pick up
 */
function isValuableItem(item: Item, game: GameState): boolean {
  // Always pick up potions and scrolls
  if (item.template.type === 'potion' || item.template.type === 'scroll') {
    return true
  }

  // Pick up artifacts
  if (item.artifact) {
    return true
  }

  // Pick up equipment if it might be an upgrade
  if (item.template.slot) {
    return isEquipmentUpgrade(item, game.character.equipment)
  }

  return false
}

/**
 * Check if equipment is an upgrade over current gear
 */
function isEquipmentUpgrade(item: Item, equipment: Record<string, Item | undefined>): boolean {
  const slot = item.template.slot
  if (!slot) return false

  // Map item slots to equipment slots
  const slotMapping: Record<string, string> = {
    weapon: 'weapon',
    body: 'armor',
    shield: 'shield',
    helm: 'helm',
    gloves: 'gloves',
    boots: 'boots',
    ring: 'ring1', // Simplified - just check first ring slot
    amulet: 'amulet',
    light: 'light',
  }

  const equipSlot = slotMapping[slot]
  if (!equipSlot) return false

  const current = equipment[equipSlot]
  if (!current) {
    return true // Empty slot, definitely an upgrade
  }

  // Compare tiers (higher is better)
  if (item.template.tier > current.template.tier) {
    return true
  }

  // Compare protection for armor
  const itemProtection = (item.template.protection ?? 0) + item.enchantment
  const currentProtection = (current.template.protection ?? 0) + current.enchantment
  if (itemProtection > currentProtection) {
    return true
  }

  return false
}

/**
 * Check if we should equip something from inventory
 */
function checkEquipment(context: BotContext): GameAction | null {
  const { game } = context
  const inventory = game.character.inventory
  const equipment = game.character.equipment

  for (const item of inventory) {
    if (item.template.slot && isEquipmentUpgrade(item, equipment)) {
      return { type: 'equip', itemId: item.id }
    }
  }

  return null
}

// ============================================================================
// EXPLORATION
// ============================================================================

/**
 * Check for exploration or descent opportunities
 */
function checkExploration(context: BotContext): GameAction | null {
  const { game, personality, knownStairs, unexploredTiles } = context
  const playerPos = game.character.position
  const level = game.currentLevel
  const descentPriority = DESCENT_PRIORITY[personality]

  // Check if we're on stairs down
  const currentTile = getTile(level, playerPos.x, playerPos.y)
  if (currentTile?.type === 'stairs_down') {
    // Decide whether to descend based on personality and exploration
    const explorationPercent = getExplorationPercent(level)

    // Speedrunner always descends, others wait for more exploration
    const shouldDescend =
      personality === 'speedrunner' ||
      (explorationPercent > 0.5 && Math.random() < descentPriority) ||
      explorationPercent > 0.8

    if (shouldDescend) {
      return { type: 'descend' }
    }
  }

  // Move toward stairs if known and descent priority is high
  if (knownStairs && descentPriority > 0.7) {
    const explorationPercent = getExplorationPercent(level)
    if (explorationPercent > 0.4) {
      const moveAction = moveToward(game, playerPos, knownStairs)
      if (moveAction) {
        return moveAction
      }
    }
  }

  // Move toward unexplored areas
  if (unexploredTiles.length > 0) {
    // Find nearest unexplored tile
    let nearest: Point | null = null
    let nearestDist = Infinity

    for (const tile of unexploredTiles) {
      const dist = distance(playerPos, tile)
      if (dist < nearestDist) {
        nearestDist = dist
        nearest = tile
      }
    }

    if (nearest) {
      const moveAction = moveToward(game, playerPos, nearest)
      if (moveAction) {
        return moveAction
      }
    }
  }

  // If nothing to explore, head for stairs
  if (knownStairs) {
    const moveAction = moveToward(game, playerPos, knownStairs)
    if (moveAction) {
      return moveAction
    }
  }

  // Wander randomly if stuck
  return tryRandomMove(game)
}

/**
 * Get the exploration percentage of a level
 */
function getExplorationPercent(level: { tiles: { explored: boolean }[][] }): number {
  let explored = 0
  let total = 0

  for (const row of level.tiles) {
    if (!row) continue
    for (const tile of row) {
      if (tile) {
        total++
        if (tile.explored) {
          explored++
        }
      }
    }
  }

  return total > 0 ? explored / total : 0
}

// ============================================================================
// MOVEMENT HELPERS
// ============================================================================

/**
 * Move toward a target position using pathfinding
 */
function moveToward(game: GameState, from: Point, to: Point): GameAction | null {
  const path = findPath(game.currentLevel, from, to)

  // Path includes start position, so we want the second element
  if (path.length < 2) {
    return null
  }

  const nextPos = path[1]
  if (!nextPos) return null

  // Check if a monster is blocking
  const blocked = game.monsters.some(
    (m) => m.position.x === nextPos.x && m.position.y === nextPos.y
  )

  if (blocked) {
    // Attack the blocking monster
    const blocker = game.monsters.find(
      (m) => m.position.x === nextPos.x && m.position.y === nextPos.y
    )
    if (blocker) {
      return { type: 'attack', targetId: blocker.id }
    }
    return null
  }

  const direction = getDirectionFromDelta(nextPos.x - from.x, nextPos.y - from.y)
  if (direction) {
    return { type: 'move', direction }
  }

  return null
}

/**
 * Try a random valid move
 */
function tryRandomMove(game: GameState): GameAction | null {
  const playerPos = game.character.position
  const adjacent = getAdjacentPositions(playerPos)

  // Shuffle adjacent positions
  for (let i = adjacent.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = adjacent[i]
    adjacent[i] = adjacent[j]!
    adjacent[j] = temp!
  }

  for (const pos of adjacent) {
    const tile = getTile(game.currentLevel, pos.x, pos.y)
    if (tile && isWalkable(tile)) {
      // Check no monster
      const blocked = game.monsters.some((m) => m.position.x === pos.x && m.position.y === pos.y)
      if (!blocked) {
        const dir = getDirectionFromDelta(pos.x - playerPos.x, pos.y - playerPos.y)
        if (dir) {
          return { type: 'move', direction: dir }
        }
      }
    }
  }

  return { type: 'wait' }
}

// getDirectionFromDelta is imported from types.ts

/**
 * Get direction away from a point
 */
function getDirectionAwayFrom(from: Point, threat: Point): Direction | null {
  const dx = from.x - threat.x
  const dy = from.y - threat.y

  // Normalize
  const nx = dx === 0 ? 0 : dx > 0 ? 1 : -1
  const ny = dy === 0 ? 0 : dy > 0 ? 1 : -1

  return getDirectionFromDelta(nx, ny)
}

// getDirectionDelta uses DIRECTION_VECTORS from types.ts
function getDirectionDelta(dir: Direction): Point {
  return DIRECTION_VECTORS[dir]
}

// ============================================================================
// BOT RUNNER
// ============================================================================

/**
 * Run one tick of the bot AI
 *
 * Builds context and returns the best action.
 */
export function runBotTick(game: GameState, personality: BotPersonality): GameAction {
  const context = buildBotContext(game, personality)
  return decideAction(context)
}

/**
 * Evaluate the danger level of the current situation
 *
 * Returns 0-1 where 1 is maximum danger.
 */
export function evaluateDanger(context: BotContext): number {
  const { game, visibleMonsters } = context
  const char = game.character

  let danger = 0

  // HP factor (lower HP = more danger)
  const hpFactor = 1 - char.hp / char.maxHp
  danger += hpFactor * 0.4

  // Monster count factor
  const monsterFactor = Math.min(1, visibleMonsters.length / 5)
  danger += monsterFactor * 0.3

  // Adjacent monster factor
  const adjacentCount = visibleMonsters.filter(
    (m) =>
      Math.abs(m.position.x - char.position.x) <= 1 && Math.abs(m.position.y - char.position.y) <= 1
  ).length
  const adjacentFactor = Math.min(1, adjacentCount / 3)
  danger += adjacentFactor * 0.3

  return Math.min(1, danger)
}

/**
 * Get a debug summary of the bot's current decision
 */
export function getBotStatus(context: BotContext): string {
  const { game, personality, visibleMonsters, visibleItems, knownStairs, unexploredTiles } = context
  const char = game.character
  const danger = evaluateDanger(context)

  const parts = [
    `HP: ${char.hp}/${char.maxHp}`,
    `Danger: ${(danger * 100).toFixed(0)}%`,
    `Monsters: ${visibleMonsters.length}`,
    `Items: ${visibleItems.length}`,
    `Unexplored: ${unexploredTiles.length}`,
    `Stairs: ${knownStairs ? 'known' : 'unknown'}`,
    `Personality: ${personality}`,
  ]

  return parts.join(' | ')
}
