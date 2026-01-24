/**
 * Game Loop and Turn Processing for Borglike
 *
 * Handles game initialization, turn processing, action handling, and win/loss conditions.
 * Suitable for both manual play and bot control.
 *
 * Action handlers have been extracted to src/game/actions/ for better organization.
 */

import type {
  GameState,
  RunConfig,
  GameAction,
  GameEvent,
  ActionResult,
  RunStats,
  FountainState,
  AltarState,
  TrapState,
  BalanceOverrides,
} from './types'
import { DEFAULT_BALANCE } from './types'
import { seedRNG, random, randomInt } from './rng'
import { calculateLightRadius } from './lighting'
import { createCharacter } from './character'
import { DEFAULT_BONUSES } from './upgrade-effects'
import { DEFAULT_BOOSTER_BONUSES } from './booster-effects'
import { generateLevel, computeFOV, setAllTilesVisible, findOpenPosition } from './dungeon'
import { spawnMonstersForLevel, processMonsterTurns } from './monster-ai'
import { processMinionTurns } from './minion-ai'
import { spawnItemsForLevel, createStartingEquipment, createRandomPotion } from './items'
import { initializeFeaturesFromVault } from './features'
import { generateMerchantInventory } from './items'
import { tickPortalTimer } from './town'
import { tickStatusEffects, tickTempResistances, processPoison } from './status-effects'
import {
  addMessage,
  BASE_ENERGY_COST,
  handleMove,
  handleAttack,
  handleRangedAttack,
  handleDescend,
  handleAscend,
  handlePickup,
  handleEquip,
  handleDrop,
  handleUnequip,
  handleWait,
  handleUse,
  handleUseFountain,
  handleUseAltar,
  handleShopBuy,
  handleShopSell,
  handleCast,
  handleReturnPortal,
  handleUseHealer,
  handleSteal,
  handleShapeshift,
} from './actions'
import { equipItem } from './character'

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
  seedRNG(seed)
  const runId = `run_${seed}_${Math.random().toString(36).substring(2, 9)}`
  const upgradeBonuses = config.upgradeBonuses ?? DEFAULT_BONUSES
  const boosterBonuses = config.boosterBonuses ?? DEFAULT_BOOSTER_BONUSES
  const balance: BalanceOverrides = { ...DEFAULT_BALANCE, ...config.balanceOverrides }

  // Create character with upgrade bonuses and booster bonuses
  const character = createCharacter({
    raceId: config.raceId,
    classId: config.classId,
    upgradeBonuses,
    boosterBonuses,
  })

  // Give starting equipment based on class (with booster enchantment bonuses)
  const startingItems = createStartingEquipment(
    config.classId,
    boosterBonuses,
    balance.startingPotions
  )
  for (const item of startingItems) {
    if (item.template.slot) {
      // Auto-equip weapons and armor
      equipItem(character, item)
    } else {
      // Put consumables in inventory
      character.inventory.push(item)
    }
  }

  // Lucky Start booster: add random potion
  if (boosterBonuses.startsWithPotion) {
    const potion = createRandomPotion()
    if (potion) {
      character.inventory.push(potion)
    }
  }

  // Generate first dungeon level
  const firstLevel = generateLevel(1)

  // Place character at stairs up location (or random if depth 1)
  const startPosition = firstLevel.stairsUp ?? findOpenPosition(firstLevel)
  character.position = startPosition
  character.depth = 1

  // Initialize level cache
  const levelCache = new Map<number, typeof firstLevel>()
  levelCache.set(1, firstLevel)

  // Initialize unique tracking
  const uniqueState = {
    spawned: new Set<string>(),
    killed: new Set<string>(),
  }

  // Spawn monsters for first level (pass uniqueState for unique tracking)
  const monsters = spawnMonstersForLevel(firstLevel, 1, balance.monsterHpPercent, uniqueState)

  // Spawn items for first level
  const items = spawnItemsForLevel(
    firstLevel,
    1,
    balance.potionRatePercent,
    balance.enchantRatePercent,
    balance.itemRatePercent
  )

  // Initialize run stats
  const stats: RunStats = {
    kills: 0,
    goldCollected: 0,
    goldSpent: 0,
    damageDealt: 0,
    damageTaken: 0,
    itemsFound: 0,
    itemsBought: 0,
    itemsSold: 0,
    spellsCast: 0,
    abilitiesUsed: 0,
    turnsPlayed: 0,
    deepestDepth: 1,
    startTime: Date.now(),
    endTime: null,
    monsterKills: {},
    itemsDiscovered: {},
  }

  // Initialize features for first level
  const fountains = new Map<string, FountainState>()
  const altars = new Map<string, AltarState>()
  const merchants: typeof gameState.merchants = []
  const traps = new Map<string, TrapState>()

  // Create initial game state (needed for initializeFeaturesFromVault)
  const gameState: GameState = {
    runId,
    seed,
    character,
    currentLevel: firstLevel,
    levelCache,
    entityCache: new Map(),
    monsters,
    items,
    minions: [], // Player's pets/summons
    fountains,
    altars,
    merchants,
    traps,
    townPortal: null,
    healer: null,
    turn: 0,
    isRunning: true,
    isPaused: false,
    isVictory: false,
    stats,
    messages: [],
    upgradeBonuses,
    boosterBonuses,
    personality: config.botPersonality,
    boosterIds: config.boosterIds,
    usedSecondWind: false,
    bestiary: config.bestiary,
    balance,
    uniqueState,
    maxDepthEver: config.maxDepthEver ?? 1,
  }

  // Initialize features from vault data (if vault was placed)
  initializeFeaturesFromVault(
    firstLevel,
    1,
    fountains,
    altars,
    merchants,
    traps,
    generateMerchantInventory
  )

  // Compute initial FOV (dynamic light radius based on equipment/race)
  const lightRadius = calculateLightRadius(character, 1)
  computeFOV(firstLevel, character.position, lightRadius)

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

  // Check if player is stunned or paralyzed - skip their action but still process turn
  const isStunned = game.character.statusEffects.some((e) => e.type === 'stun')
  const isParalyzed = game.character.statusEffects.some((e) => e.type === 'paralyzed')
  if (isStunned || isParalyzed) {
    addMessage(
      game,
      isParalyzed ? 'You are paralyzed and cannot move!' : 'You are stunned and cannot act!',
      'danger'
    )

    // Update turn counter
    game.turn++
    game.stats.turnsPlayed++
    events.push({ type: 'turn', turn: game.turn })

    // Tick status effects (including stun) and process monsters
    tickStatusEffects(game.character)
    tickTempResistances(game.character)
    processPoison(game, addMessage)

    // Process monster turns
    const monsterEvents = processMonsterTurns(game)
    events.push(...monsterEvents)

    // Check for death
    if (game.character.isDead) {
      game.isRunning = false
      game.stats.endTime = Date.now()
      addMessage(game, 'You have died!', 'danger')
      events.push({ type: 'death', character: game.character })
    }

    return events
  }

  // Check if terrified - cannot attack
  const isTerrified = game.character.statusEffects.some((e) => e.type === 'terrified')
  if (isTerrified && action.type === 'attack') {
    addMessage(game, 'You are too terrified to attack!', 'danger')
    // Convert attack to wait
    action = { type: 'wait' }
  }

  // Check if confused - 50% chance of random movement
  const isConfused = game.character.statusEffects.some((e) => e.type === 'confused')
  if (isConfused && (action.type === 'move' || action.type === 'attack')) {
    if (random() < 0.5) {
      // Random movement instead of intended action
      const directions = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
      const randomDir = directions[randomInt(0, 7)]!
      addMessage(game, 'You stumble in confusion!', 'danger')
      action = { type: 'move', direction: randomDir }
    }
  }

  // Validate and execute player action
  const actionResult = executeAction(game, action)

  if (!actionResult.success) {
    if (actionResult.message) {
      addMessage(game, actionResult.message, 'info')
    }
    // Still advance turn to prevent infinite loops (bot tried invalid action)
    // This is important for bot safety - a failed action should still "use" the turn
    game.turn++
    game.stats.turnsPlayed++
    events.push({ type: 'turn', turn: game.turn })
    return events
  }

  // Collect events from action result (e.g., spell damage events)
  if (actionResult.events) {
    events.push(...actionResult.events)
  }

  // Update turn counter
  game.turn++
  game.stats.turnsPlayed++
  events.push({ type: 'turn', turn: game.turn })

  // Tick status effects, resistances, and poison
  tickStatusEffects(game.character)
  tickTempResistances(game.character)
  processPoison(game, addMessage)

  // Tick town portal timer (decrements and destroys if expired)
  if (game.townPortal) {
    tickPortalTimer(game)
  }

  // Check if out of combat (no adjacent enemies)
  const adjacentMonster = game.monsters.some((m) => {
    const dx = Math.abs(m.position.x - game.character.position.x)
    const dy = Math.abs(m.position.y - game.character.position.y)
    return dx <= 1 && dy <= 1 && m.hp > 0
  })

  // Mana regeneration (1 + WIS/10 MP per turn when not adjacent to enemies)
  if (game.character.mp < game.character.maxMp && !adjacentMonster) {
    const wisBonus = Math.floor(game.character.stats.wis / 10)
    const manaRegen = 1 + wisBonus
    game.character.mp = Math.min(game.character.mp + manaRegen, game.character.maxMp)
  }

  // Passive HP regeneration (balance override: HP per 10 turns when out of combat)
  if (
    game.balance.regenPer10Turns > 0 &&
    !adjacentMonster &&
    game.character.hp < game.character.maxHp
  ) {
    if (game.turn % 10 === 0) {
      game.character.hp = Math.min(
        game.character.hp + game.balance.regenPer10Turns,
        game.character.maxHp
      )
    }
  }

  // Process minion turns (player's pets/summons act before monsters)
  const minionEvents = processMinionTurns(game)
  events.push(...minionEvents)

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

  // Update FOV (town is always fully visible, dungeon uses shadowcasting)
  if (game.character.depth === 0) {
    setAllTilesVisible(game.currentLevel)
  } else {
    const lightRadius = calculateLightRadius(game.character, game.character.depth)
    computeFOV(game.currentLevel, game.character.position, lightRadius)
  }

  return events
}

// ============================================================================
// ACTION DISPATCH
// ============================================================================

/**
 * Execute a player action
 */
function executeAction(game: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'move':
      return handleMove(game, action.direction)
    case 'attack':
      return handleAttack(game, action.targetId)
    case 'ranged_attack':
      return handleRangedAttack(game, action.targetId)
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
    case 'use_fountain':
      return handleUseFountain(game)
    case 'use_altar':
      return handleUseAltar(game)
    case 'shop_buy':
      return handleShopBuy(game, action.merchantIndex, action.itemIndex)
    case 'shop_sell':
      return handleShopSell(game, action.merchantIndex, action.inventoryIndex)
    case 'cast':
      return handleCast(game, action.spellId, action.targetId)
    case 'use_return_portal':
      return handleReturnPortal(game)
    case 'use_healer':
      return handleUseHealer(game)
    case 'steal':
      return handleSteal(game, action.targetId)
    case 'shapeshift':
      return handleShapeshift(game, action.formId)
    default:
      return { success: false, message: 'Unknown action', energyCost: 0 }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export commonly used items for backwards compatibility
export { addMessage, BASE_ENERGY_COST }
export type { ActionResult }
