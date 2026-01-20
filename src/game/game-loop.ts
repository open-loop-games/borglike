/**
 * Game Loop and Turn Processing for Borglike
 *
 * Handles game initialization, turn processing, action handling, and win/loss conditions.
 * Suitable for both manual play and bot control.
 */

import type {
  GameState,
  RunConfig,
  GameAction,
  GameEvent,
  ActionResult,
  Direction,
  Monster,
  GroundItem,
  DungeonLevel,
  GameMessage,
  RunStats,
  EquipSlot,
} from './types'
import {
  DIRECTION_VECTORS as DirectionVectors,
  MAX_DEPTH,
  FOV_RADIUS,
  getDirectionFromDelta,
} from './types'
import { createCharacter, gainXP, equipItem } from './character'
import { DEFAULT_BONUSES, applyXPBonus } from './upgrade-effects'
import { generateLevel, getTile, isWalkable, computeFOV, findOpenPosition } from './dungeon'
import { attack, applyDamage, formatAttackMessageFromEntities } from './combat'
import { spawnItemsForLevel } from './items'
import { spawnMonstersForLevel } from './monster-ai'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base energy cost for actions (100 = 1 turn) */
const BASE_ENERGY_COST = 100

/** Energy gained per game tick based on speed */
const ENERGY_PER_TICK = 100

/** Victory boss name (used for win condition check) */
const VICTORY_BOSS_NAME = 'Morgoth, Lord of Darkness'

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

/**
 * Create a new game with the given configuration
 *
 * @param config - Run configuration including race/class
 * @returns Complete initial game state
 */
export function createGame(config: RunConfig): GameState {
  const seed = config.seed ?? Date.now()
  const runId = `run_${seed}_${Math.random().toString(36).substring(2, 9)}`
  const upgradeBonuses = config.upgradeBonuses ?? DEFAULT_BONUSES

  // Create character with upgrade bonuses
  const character = createCharacter({
    raceId: config.raceId,
    classId: config.classId,
    upgradeBonuses,
  })

  // Generate first dungeon level
  const firstLevel = generateLevel(1)

  // Place character at stairs up location (or random if depth 1)
  const startPosition = firstLevel.stairsUp ?? findOpenPosition(firstLevel)
  character.position = startPosition
  character.depth = 1

  // Initialize level cache
  const levelCache = new Map<number, DungeonLevel>()
  levelCache.set(1, firstLevel)

  // Spawn monsters for first level
  const monsters = spawnMonstersForLevel(firstLevel, 1)

  // Spawn items for first level
  const items = spawnItemsForLevel(firstLevel, 1)

  // Initialize run stats
  const stats: RunStats = {
    kills: 0,
    goldCollected: 0,
    damageDealt: 0,
    damageTaken: 0,
    itemsFound: 0,
    turnsPlayed: 0,
    deepestDepth: 1,
    startTime: Date.now(),
    endTime: null,
  }

  // Create initial game state
  const gameState: GameState = {
    runId,
    seed,
    character,
    currentLevel: firstLevel,
    levelCache,
    monsters,
    items,
    turn: 0,
    isRunning: true,
    isPaused: false,
    isVictory: false,
    stats,
    messages: [],
    upgradeBonuses,
  }

  // Compute initial FOV
  computeFOV(firstLevel, character.position, FOV_RADIUS)

  // Add welcome message
  addMessage(gameState, 'Welcome to the dungeon! Find your way to depth 50.', 'info')

  return gameState
}

// ============================================================================
// TURN PROCESSING
// ============================================================================

/**
 * Process a single game turn
 *
 * @param game - Current game state
 * @param action - Player action to execute
 * @returns List of events generated during the turn
 */
export function processTurn(game: GameState, action: GameAction): GameEvent[] {
  const events: GameEvent[] = []

  if (!game.isRunning || game.isPaused) {
    return events
  }

  // Validate and execute player action
  const actionResult = executeAction(game, action)

  if (!actionResult.success) {
    if (actionResult.message) {
      addMessage(game, actionResult.message, 'info')
    }
    return events
  }

  // Update turn counter
  game.turn++
  game.stats.turnsPlayed++
  events.push({ type: 'turn', turn: game.turn })

  // Process monster turns
  const monsterEvents = processMonsterTurns(game)
  events.push(...monsterEvents)

  // Check for death
  if (game.character.isDead) {
    game.isRunning = false
    game.stats.endTime = Date.now()
    addMessage(game, 'You have died!', 'danger')
    events.push({ type: 'death', character: game.character })
    return events
  }

  // Check for victory
  if (game.isVictory) {
    game.isRunning = false
    game.stats.endTime = Date.now()
    addMessage(game, 'Congratulations! You have defeated Morgoth and won!', 'good')
    events.push({ type: 'victory' })
    return events
  }

  // Update FOV
  computeFOV(game.currentLevel, game.character.position, FOV_RADIUS)

  return events
}

/**
 * Execute a player action
 */
function executeAction(game: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'move':
      return handleMove(game, action.direction)
    case 'attack':
      return handleAttack(game, action.targetId)
    case 'descend':
      return handleDescend(game)
    case 'ascend':
      return handleAscend(game)
    case 'pickup':
      return handlePickup(game, action.itemId)
    case 'use':
      return handleUse(game, action.itemId)
    case 'equip':
      return handleEquip(game, action.itemId)
    case 'drop':
      return handleDrop(game, action.itemId)
    case 'unequip':
      return handleUnequip(game, action.slot)
    case 'wait':
      return handleWait(game)
    default:
      return { success: false, message: 'Unknown action', energyCost: 0 }
  }
}

// ============================================================================
// ACTION HANDLERS
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
  const monsterAtTarget = game.monsters.find((m) => m.position.x === newX && m.position.y === newY)

  if (monsterAtTarget) {
    return handleAttack(game, monsterAtTarget.id)
  }

  // Check if target tile is walkable
  const targetTile = getTile(game.currentLevel, newX, newY)

  if (!targetTile || !isWalkable(targetTile)) {
    return { success: false, message: 'You cannot move there.', energyCost: 0 }
  }

  // Execute move
  game.character.position = { x: newX, y: newY }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle attack action
 *
 * Find monster by ID, resolve combat, apply damage, award XP
 */
export function handleAttack(game: GameState, targetId: string): ActionResult {
  const monster = game.monsters.find((m) => m.id === targetId)

  if (!monster) {
    return { success: false, message: 'No target found.', energyCost: 0 }
  }

  // Resolve attack
  const attackResult = attack(game.character, monster)
  const message = formatAttackMessageFromEntities(game.character, monster, attackResult)
  addMessage(game, message, 'combat')

  if (attackResult.hit) {
    // Apply damage to monster
    applyDamage(monster, attackResult.damage)
    game.stats.damageDealt += attackResult.damage

    if (attackResult.killed) {
      // Remove monster from game
      const monsterIndex = game.monsters.indexOf(monster)
      if (monsterIndex >= 0) {
        game.monsters.splice(monsterIndex, 1)
      }

      // Award XP with upgrade bonus
      const bonuses = game.upgradeBonuses ?? DEFAULT_BONUSES
      const baseXP = monster.template.experience
      const xpToAward = applyXPBonus(baseXP, bonuses)
      const { leveledUp, newLevel } = gainXP(game.character, xpToAward)
      game.stats.kills++

      if (leveledUp && newLevel) {
        addMessage(game, `You have reached level ${newLevel}!`, 'good')
      }

      // Check for victory (killed Morgoth)
      if (
        monster.template.flags.includes('UNIQUE') &&
        monster.template.name === VICTORY_BOSS_NAME
      ) {
        game.isVictory = true
      }
    }
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle descending stairs
 *
 * Check if on stairs down, generate/load next level
 */
export function handleDescend(game: GameState): ActionResult {
  const currentTile = getTile(
    game.currentLevel,
    game.character.position.x,
    game.character.position.y
  )

  if (!currentTile || currentTile.type !== 'stairs_down') {
    return { success: false, message: 'There are no stairs here.', energyCost: 0 }
  }

  const newDepth = game.character.depth + 1

  if (newDepth > MAX_DEPTH) {
    return { success: false, message: 'You cannot go any deeper.', energyCost: 0 }
  }

  // Save current level state (monsters and items)
  saveLevelState(game)

  // Get or generate new level
  let newLevel = game.levelCache.get(newDepth)

  if (!newLevel) {
    newLevel = generateLevel(newDepth)
    game.levelCache.set(newDepth, newLevel)
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

  // Load or spawn monsters/items for new level
  game.monsters = spawnMonstersForLevel(newLevel, newDepth)
  game.items = spawnItemsForLevel(newLevel, newDepth)

  // Update stats
  if (newDepth > game.stats.deepestDepth) {
    game.stats.deepestDepth = newDepth
  }

  // Update FOV
  computeFOV(newLevel, game.character.position, FOV_RADIUS)

  addMessage(game, `You descend to depth ${newDepth}.`, 'info')

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

  // Save current level state
  saveLevelState(game)

  // Load previous level
  const previousLevel = game.levelCache.get(newDepth)

  if (!previousLevel) {
    return { success: false, message: 'Previous level not found.', energyCost: 0 }
  }

  // Update game state
  game.currentLevel = previousLevel
  game.character.depth = newDepth

  // Place character at stairs down
  if (previousLevel.stairsDown) {
    game.character.position = { ...previousLevel.stairsDown }
  } else {
    game.character.position = findOpenPosition(previousLevel)
  }

  // Load monsters/items for previous level (simplified - respawn)
  game.monsters = spawnMonstersForLevel(previousLevel, newDepth)
  game.items = spawnItemsForLevel(previousLevel, newDepth)

  // Update FOV
  computeFOV(previousLevel, game.character.position, FOV_RADIUS)

  addMessage(game, `You ascend to depth ${newDepth}.`, 'info')

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle item pickup
 */
export function handlePickup(game: GameState, itemId: string): ActionResult {
  const itemIndex = game.items.findIndex(
    (i) =>
      i.id === itemId &&
      i.position.x === game.character.position.x &&
      i.position.y === game.character.position.y
  )

  if (itemIndex < 0) {
    // Check if any item is at current position
    const itemAtPosition = game.items.find(
      (i) =>
        i.position.x === game.character.position.x && i.position.y === game.character.position.y
    )

    if (itemAtPosition) {
      return handlePickup(game, itemAtPosition.id)
    }

    return { success: false, message: 'There is nothing here to pick up.', energyCost: 0 }
  }

  const item = game.items[itemIndex]
  if (!item) {
    return { success: false, message: 'Item not found.', energyCost: 0 }
  }
  game.items.splice(itemIndex, 1)

  // Add to inventory (strip position data)
  game.character.inventory.push(item)
  game.stats.itemsFound++

  addMessage(game, `You pick up ${item.template.name}.`, 'item')

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle item use (potions, scrolls, etc.)
 */
export function handleUse(game: GameState, itemId: string): ActionResult {
  const itemIndex = game.character.inventory.findIndex((i) => i.id === itemId)

  if (itemIndex < 0) {
    return { success: false, message: 'You do not have that item.', energyCost: 0 }
  }

  const item = game.character.inventory[itemIndex]!

  // Check if item is consumable
  if (item.template.type !== 'potion' && item.template.type !== 'scroll') {
    return { success: false, message: 'You cannot use that item.', energyCost: 0 }
  }

  // Apply effect based on item type
  const effect = item.template.effect || ''
  const itemName = item.template.name

  if (item.template.type === 'potion') {
    if (effect.includes('Cure') || effect.includes('Heal')) {
      // Healing potion
      const healAmount = getHealAmount(effect, game.character.level)
      game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
      addMessage(game, `You drink the ${itemName}. You feel better!`, 'good')
    } else if (effect.includes('Restore')) {
      // Restore stats/MP
      game.character.mp = game.character.maxMp
      addMessage(game, `You drink the ${itemName}. You feel restored!`, 'good')
    } else {
      addMessage(game, `You drink the ${itemName}.`, 'item')
    }
  } else if (item.template.type === 'scroll') {
    // Scrolls have various effects
    if (effect.includes('Teleport')) {
      const newPos = findOpenPosition(game.currentLevel)
      game.character.position = newPos
      computeFOV(game.currentLevel, newPos, FOV_RADIUS)
      addMessage(game, `You read the ${itemName}. You teleport!`, 'item')
    } else if (effect.includes('Mapping')) {
      // Reveal entire level
      for (let y = 0; y < game.currentLevel.height; y++) {
        const row = game.currentLevel.tiles[y]
        if (row) {
          for (let x = 0; x < game.currentLevel.width; x++) {
            const tile = row[x]
            if (tile) tile.explored = true
          }
        }
      }
      addMessage(game, `You read the ${itemName}. The level is revealed!`, 'good')
    } else {
      addMessage(game, `You read the ${itemName}.`, 'item')
    }
  }

  // Remove item from inventory
  game.character.inventory.splice(itemIndex, 1)

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle item equip
 */
export function handleEquip(game: GameState, itemId: string): ActionResult {
  const itemIndex = game.character.inventory.findIndex((i) => i.id === itemId)

  if (itemIndex < 0) {
    return { success: false, message: 'You do not have that item.', energyCost: 0 }
  }

  const item = game.character.inventory[itemIndex]
  if (!item) {
    return { success: false, message: 'Item not found.', energyCost: 0 }
  }

  // Check if item is equippable
  if (!item.template.slot) {
    return { success: false, message: 'You cannot equip that item.', energyCost: 0 }
  }

  const result = equipItem(game.character, item)

  if (result.success) {
    addMessage(game, `You equip ${item.template.name}.`, 'item')
    if (result.unequipped) {
      addMessage(game, `You unequip ${result.unequipped.template.name}.`, 'item')
    }
    return { success: true, energyCost: BASE_ENERGY_COST }
  }

  return { success: false, message: 'You cannot equip that item.', energyCost: 0 }
}

/**
 * Handle item drop
 */
export function handleDrop(game: GameState, itemId: string): ActionResult {
  const itemIndex = game.character.inventory.findIndex((i) => i.id === itemId)

  if (itemIndex < 0) {
    return { success: false, message: 'You do not have that item.', energyCost: 0 }
  }

  const item = game.character.inventory[itemIndex]
  if (!item) {
    return { success: false, message: 'Item not found.', energyCost: 0 }
  }
  game.character.inventory.splice(itemIndex, 1)

  // Create ground item with position
  const droppedItem: GroundItem = {
    id: item.id,
    template: item.template,
    enchantment: item.enchantment,
    identified: item.identified,
    artifact: item.artifact,
    position: { ...game.character.position },
  }

  // Add to ground items
  game.items.push(droppedItem)

  addMessage(game, `You drop ${item.template.name}.`, 'item')

  return { success: true, energyCost: BASE_ENERGY_COST }
}

/**
 * Handle unequip action
 */
export function handleUnequip(game: GameState, slot: EquipSlot): ActionResult {
  const item = game.character.equipment[slot]

  if (!item) {
    return { success: false, message: 'Nothing is equipped in that slot.', energyCost: 0 }
  }

  // Move to inventory
  delete game.character.equipment[slot]
  game.character.inventory.push(item)

  addMessage(game, `You unequip ${item.template.name}.`, 'item')

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
// MONSTER TURN PROCESSING
// ============================================================================

/**
 * Process all monster turns
 *
 * Uses energy/speed system where faster monsters act more often
 */
export function processMonsterTurns(game: GameState): GameEvent[] {
  const events: GameEvent[] = []

  for (const monster of game.monsters) {
    // Add energy based on speed (110 is normal)
    monster.energy += Math.floor((monster.template.speed / 110) * ENERGY_PER_TICK)

    // Process actions while monster has enough energy
    while (monster.energy >= BASE_ENERGY_COST && !game.character.isDead) {
      monster.energy -= BASE_ENERGY_COST

      // Get AI decision and execute
      const monsterAction = getMonsterAction(game, monster)

      if (monsterAction) {
        const monsterEvents = executeMonsterAction(game, monster, monsterAction)
        events.push(...monsterEvents)
      }
    }
  }

  return events
}

/**
 * Get monster AI decision
 *
 * Note: monster-ai.ts is being created in parallel. This is a placeholder implementation.
 */
function getMonsterAction(
  game: GameState,
  monster: Monster
): { type: 'move'; direction: Direction } | { type: 'attack' } | null {
  // Check if monster can see player
  const dx = game.character.position.x - monster.position.x
  const dy = game.character.position.y - monster.position.y
  const distance = Math.sqrt(dx * dx + dy * dy)

  // Wake up if player is close
  if (distance <= FOV_RADIUS && !monster.isAwake) {
    // Check if monster's tile is visible
    const tile = getTile(game.currentLevel, monster.position.x, monster.position.y)
    if (tile?.visible) {
      monster.isAwake = true
      monster.seen = true
    }
  }

  if (!monster.isAwake) {
    return null // Sleeping monsters don't act
  }

  // Adjacent to player? Attack!
  if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
    return { type: 'attack' }
  }

  // Move towards player (simple pathfinding)
  if (distance > 1) {
    const moveX = dx !== 0 ? Math.sign(dx) : 0
    const moveY = dy !== 0 ? Math.sign(dy) : 0

    // Convert to direction
    const direction = getDirectionFromDelta(moveX, moveY)
    if (direction) {
      return { type: 'move', direction }
    }
  }

  return null
}

/**
 * Execute a monster action
 */
function executeMonsterAction(
  game: GameState,
  monster: Monster,
  action: { type: 'move'; direction: Direction } | { type: 'attack' }
): GameEvent[] {
  const events: GameEvent[] = []

  if (action.type === 'attack') {
    // Monster attacks player
    const attackResult = attack(monster, game.character)
    const message = formatAttackMessageFromEntities(monster, game.character, attackResult)
    addMessage(game, message, 'combat')

    if (attackResult.hit) {
      applyDamage(game.character, attackResult.damage)
      game.stats.damageTaken += attackResult.damage

      events.push({
        type: 'attack',
        attackerId: monster.id,
        defenderId: game.character.id,
        damage: attackResult.damage,
        killed: attackResult.killed,
      })
    }
  } else if (action.type === 'move') {
    const delta = DirectionVectors[action.direction]
    const newX = monster.position.x + delta.x
    const newY = monster.position.y + delta.y

    // Check if position is valid
    const targetTile = getTile(game.currentLevel, newX, newY)

    if (targetTile && isWalkable(targetTile)) {
      // Check if another monster is there
      const blockingMonster = game.monsters.find(
        (m) => m.id !== monster.id && m.position.x === newX && m.position.y === newY
      )

      // Check if player is there
      const playerBlocking =
        game.character.position.x === newX && game.character.position.y === newY

      if (!blockingMonster && !playerBlocking) {
        const oldPos = { ...monster.position }
        monster.position = { x: newX, y: newY }

        events.push({
          type: 'move',
          entityId: monster.id,
          from: oldPos,
          to: monster.position,
        })
      }
    }
  }

  return events
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add a message to the game log
 */
function addMessage(game: GameState, text: string, type: GameMessage['type']): void {
  game.messages.push({
    turn: game.turn,
    text,
    type,
  })

  // Keep only last 100 messages
  if (game.messages.length > 100) {
    game.messages.shift()
  }
}

/**
 * Save current level state (for returning to it later)
 */
function saveLevelState(_game: GameState): void {
  // The level is already in the cache, but in a full implementation
  // we would save monster/item positions here
}

/**
 * Get heal amount from potion effect description
 */
function getHealAmount(effect: string, level: number): number {
  // Parse effect string for heal amounts
  if (effect.includes('Light')) return 10 + level
  if (effect.includes('Serious')) return 25 + level * 2
  if (effect.includes('Critical')) return 50 + level * 3
  if (effect.includes('Healing')) return 100 + level * 5
  if (effect.includes('*Healing*')) return Math.floor(level * 10)
  return 20 + level // Default
}

// ============================================================================
// EXPORTS FOR EXTERNAL USE
// ============================================================================

export { addMessage, getMonsterAction }

// Type exports for consumers
export type { ActionResult }
