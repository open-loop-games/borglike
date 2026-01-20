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
  FountainState,
  AltarState,
  MerchantState,
  TrapState,
  ResistanceType,
  Character,
  StatusEffect,
  TempResistance,
} from './types'
import {
  DIRECTION_VECTORS as DirectionVectors,
  MAX_DEPTH,
  FOV_RADIUS,
  getDirectionFromDelta,
} from './types'
import { createCharacter, gainXP, equipItem } from './character'
import { DEFAULT_BONUSES, applyXPBonus } from './upgrade-effects'
import { DEFAULT_BOOSTER_BONUSES } from './booster-effects'
import { generateLevel, getTile, isWalkable, computeFOV, findOpenPosition } from './dungeon'
import { attack, applyDamage, formatAttackMessageFromEntities } from './combat'
import { spawnItemsForLevel, createStartingEquipment, createRandomPotion } from './items'
import { spawnMonstersForLevel } from './monster-ai'
import {
  useFountain,
  useAltar,
  buyFromMerchant,
  sellToMerchant,
  awardMonsterGold,
  pickupGold,
  triggerTrap,
  checkTrapDetection,
} from './features'
import { castSpell } from './spell-resolution'

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
// STATUS EFFECT HELPERS
// ============================================================================

/**
 * Add or replace a status effect on a character
 * Replaces existing effect of same type
 */
function addStatusEffect(character: Character, effect: StatusEffect): void {
  character.statusEffects = character.statusEffects.filter((e) => e.type !== effect.type)
  character.statusEffects.push(effect)
}

/**
 * Tick down status effects, removing expired ones
 */
function tickStatusEffects(character: Character): void {
  character.statusEffects = character.statusEffects.filter((effect) => {
    effect.turnsRemaining--
    return effect.turnsRemaining > 0
  })
}

/**
 * Add or replace a temporary resistance on a character
 */
function addTempResistance(character: Character, resistance: TempResistance): void {
  character.tempResistances = character.tempResistances.filter((r) => r.type !== resistance.type)
  character.tempResistances.push(resistance)
}

/**
 * Tick down temporary resistances, removing expired ones
 */
function tickTempResistances(character: Character): void {
  character.tempResistances = character.tempResistances.filter((r) => {
    r.turnsRemaining--
    return r.turnsRemaining > 0
  })
}

/**
 * Check and trigger Second Wind if applicable
 * Second Wind heals the character once when they drop to critical HP (≤20% max)
 */
function checkSecondWind(game: GameState): void {
  const bonuses = game.boosterBonuses
  if (!bonuses?.hasSecondWind) return
  if (game.usedSecondWind) return
  if (game.character.isDead) return

  // Check if at or below critical threshold (20% of max HP)
  const criticalThreshold = Math.floor(game.character.maxHp * 0.2)
  if (game.character.hp > 0 && game.character.hp <= criticalThreshold) {
    // Trigger Second Wind
    const healAmount = Math.floor(game.character.maxHp * (bonuses.secondWindPercent / 100))
    game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
    game.usedSecondWind = true
    addMessage(game, `Second Wind! You recover ${healAmount} HP!`, 'good')
  }
}

/**
 * Process poison damage and tick down duration
 */
function tickPoison(game: GameState): void {
  const poison = game.character.poison
  if (!poison) return

  game.character.hp -= poison.damagePerTurn
  addMessage(game, `You suffer ${poison.damagePerTurn} poison damage!`, 'danger')

  poison.turnsRemaining--
  if (poison.turnsRemaining <= 0) {
    game.character.poison = null
    addMessage(game, 'The poison wears off.', 'info')
  }

  // Check for death from poison
  if (game.character.hp <= 0) {
    game.character.hp = 0
    game.character.isDead = true
  }
}

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
  const boosterBonuses = config.boosterBonuses ?? DEFAULT_BOOSTER_BONUSES

  // Create character with upgrade bonuses and booster bonuses
  const character = createCharacter({
    raceId: config.raceId,
    classId: config.classId,
    upgradeBonuses,
    boosterBonuses,
  })

  // Give starting equipment based on class (with booster enchantment bonuses)
  const startingItems = createStartingEquipment(config.classId, boosterBonuses)
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

  // Pack Mule booster: Note - inventory limit would be tracked elsewhere,
  // but we store the bonus for reference. The Character type doesn't have
  // maxInventory currently, so this is for future use.

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
    monsterKills: {},
  }

  // Initialize features for first level
  const fountains = new Map<string, FountainState>()
  const altars = new Map<string, AltarState>()
  const merchants: MerchantState[] = []
  const traps = new Map<string, TrapState>()

  // Create initial game state
  const gameState: GameState = {
    runId,
    seed,
    character,
    currentLevel: firstLevel,
    levelCache,
    monsters,
    items,
    fountains,
    altars,
    merchants,
    traps,
    turn: 0,
    isRunning: true,
    isPaused: false,
    isVictory: false,
    stats,
    messages: [],
    upgradeBonuses,
    boosterBonuses,
    usedSecondWind: false,
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

  // Tick status effects, resistances, and poison
  tickStatusEffects(game.character)
  tickTempResistances(game.character)
  tickPoison(game)

  // Mana regeneration (1 + WIS/10 MP per turn when not adjacent to enemies)
  if (game.character.mp < game.character.maxMp) {
    const adjacentMonster = game.monsters.some((m) => {
      const dx = Math.abs(m.position.x - game.character.position.x)
      const dy = Math.abs(m.position.y - game.character.position.y)
      return dx <= 1 && dy <= 1 && m.hp > 0
    })
    if (!adjacentMonster) {
      const wisBonus = Math.floor(game.character.stats.wis / 10)
      const manaRegen = 1 + wisBonus
      game.character.mp = Math.min(game.character.mp + manaRegen, game.character.maxMp)
    }
  }

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

  // Check for trap detection nearby (use trapVisionBonus from upgrades if available)
  const trapVisionBonus = game.upgradeBonuses?.trapVisionBonus ?? 0
  checkTrapDetection(game, trapVisionBonus)

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

      // Track monster kill by name for bestiary
      const monsterName = monster.template.name
      game.stats.monsterKills[monsterName] = (game.stats.monsterKills[monsterName] || 0) + 1

      // Award gold from monster
      awardMonsterGold(game, monster.template)

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

  // Reset features for new level (features are generated per-level, not persisted)
  game.fountains = new Map<string, FountainState>()
  game.altars = new Map<string, AltarState>()
  game.merchants = []
  game.traps = new Map<string, TrapState>()

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

  // Reset features for level (features are regenerated per-level)
  game.fountains = new Map<string, FountainState>()
  game.altars = new Map<string, AltarState>()
  game.merchants = []
  game.traps = new Map<string, TrapState>()

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

  // Handle gold items specially
  if (item.goldValue !== undefined) {
    pickupGold(game, item)
    return { success: true, energyCost: BASE_ENERGY_COST }
  }

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
    // Healing potions
    if (effect.includes('Cure') || effect.includes('Heal')) {
      const healAmount = getHealAmount(effect, game.character.level)
      game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
      addMessage(game, `You drink the ${itemName}. You feel better!`, 'good')
    }

    // Restore mana
    if (effect.includes('Restore')) {
      game.character.mp = game.character.maxMp
      addMessage(game, `You drink the ${itemName}. You feel restored!`, 'good')
    }

    // Speed potion (Haste)
    if (effect.includes('Haste') || effect.includes('+10 speed')) {
      const duration = 20 + Math.floor(Math.random() * 20)
      addStatusEffect(game.character, { type: 'speed', turnsRemaining: duration, value: 10 })
      addMessage(game, 'You feel yourself moving faster!', 'good')
    }

    // Heroism potion (+12 to hit, also heals 10 HP in effect description)
    if (effect.includes('+12 to hit')) {
      const duration = 25 + Math.floor(Math.random() * 25)
      addStatusEffect(game.character, { type: 'heroism', turnsRemaining: duration, value: 12 })
      // Small heal from heroism
      if (effect.includes('Heal 10')) {
        game.character.hp = Math.min(game.character.hp + 10, game.character.maxHp)
      }
      addMessage(game, 'You feel like a hero!', 'good')
    }

    // Berserk Strength potion
    if (effect.includes('berserk')) {
      const duration = 25 + Math.floor(Math.random() * 25)
      addStatusEffect(game.character, { type: 'berserk', turnsRemaining: duration, value: 24 })
      // Berserk also heals 30 HP
      if (effect.includes('Heal 30')) {
        game.character.hp = Math.min(game.character.hp + 30, game.character.maxHp)
      }
      addMessage(game, 'You feel a berserker rage!', 'good')
    }

    // Resist Heat (fire resistance)
    if (effect.includes('fire resistance')) {
      addTempResistance(game.character, { type: 'FIRE', turnsRemaining: 40, value: 50 })
      addMessage(game, 'You feel resistant to fire!', 'good')
    }

    // Resist Cold
    if (effect.includes('cold resistance')) {
      addTempResistance(game.character, { type: 'COLD', turnsRemaining: 40, value: 50 })
      addMessage(game, 'You feel resistant to cold!', 'good')
    }

    // Resist/Neutralize Poison
    if (effect.includes('poison')) {
      game.character.poison = null
      addMessage(game, 'The poison is purged!', 'good')
      if (effect.includes('resistance')) {
        addTempResistance(game.character, { type: 'POISON', turnsRemaining: 40, value: 50 })
        addMessage(game, 'You feel resistant to poison!', 'good')
      }
    }

    // Default message if no specific effect was handled
    if (
      !effect.includes('Cure') &&
      !effect.includes('Heal') &&
      !effect.includes('Restore') &&
      !effect.includes('Haste') &&
      !effect.includes('+10 speed') &&
      !effect.includes('+12 to hit') &&
      !effect.includes('berserk') &&
      !effect.includes('fire resistance') &&
      !effect.includes('cold resistance') &&
      !effect.includes('poison')
    ) {
      addMessage(game, `You drink the ${itemName}.`, 'item')
    }
  } else if (item.template.type === 'scroll') {
    // Teleportation scrolls
    if (effect.includes('Teleport')) {
      if (effect.includes('adjacent dungeon level')) {
        // Teleport Level - go down one level
        const newDepth = game.character.depth + 1
        if (newDepth <= 50) {
          handleDescend(game)
        } else {
          addMessage(game, `You read the ${itemName}, but nothing happens.`, 'info')
        }
      } else if (effect.includes('random location')) {
        // Full teleport
        const newPos = findOpenPosition(game.currentLevel)
        game.character.position = newPos
        computeFOV(game.currentLevel, newPos, FOV_RADIUS)
        addMessage(game, `You read the ${itemName}. You teleport!`, 'item')
      } else if (effect.includes('10 squares')) {
        // Phase Door - short range teleport
        const attempts = 20
        let newPos = { ...game.character.position }
        for (let i = 0; i < attempts; i++) {
          const dx = Math.floor(Math.random() * 21) - 10 // -10 to +10
          const dy = Math.floor(Math.random() * 21) - 10
          const testX = game.character.position.x + dx
          const testY = game.character.position.y + dy
          const tile = getTile(game.currentLevel, testX, testY)
          if (tile && isWalkable(tile)) {
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist <= 10 && dist > 0) {
              newPos = { x: testX, y: testY }
              break
            }
          }
        }
        game.character.position = newPos
        computeFOV(game.currentLevel, newPos, FOV_RADIUS)
        addMessage(game, `You read the ${itemName}. You blink!`, 'item')
      } else {
        // Default teleport
        const newPos = findOpenPosition(game.currentLevel)
        game.character.position = newPos
        computeFOV(game.currentLevel, newPos, FOV_RADIUS)
        addMessage(game, `You read the ${itemName}. You teleport!`, 'item')
      }
    }

    // Magic Mapping
    if (effect.includes('Magic Mapping') || effect.includes('reveal level')) {
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
    }

    // Treasure Detection
    if (effect.includes('Detect') && effect.includes('gold')) {
      for (const groundItem of game.items) {
        const tile = getTile(game.currentLevel, groundItem.position.x, groundItem.position.y)
        if (tile) tile.explored = true
      }
      addMessage(game, 'You sense treasures nearby!', 'good')
    }

    // Light scroll
    if (effect.includes('Light nearby')) {
      const pos = game.character.position
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const tile = getTile(game.currentLevel, pos.x + dx, pos.y + dy)
          if (tile) tile.explored = true
        }
      }
      addMessage(game, 'The area is illuminated!', 'good')
    }

    // Enchant Weapon
    if (effect.includes('+1') && effect.includes('weapon')) {
      const weapon = game.character.equipment.weapon
      if (weapon) {
        weapon.enchantment += 1
        addMessage(game, `Your ${weapon.template.name} glows! (+${weapon.enchantment})`, 'good')
      } else {
        addMessage(game, 'You have no weapon equipped.', 'info')
        return { success: false, message: 'No weapon', energyCost: 0 }
      }
    }

    // Enchant Armour
    if (effect.includes('+1') && effect.includes('armor')) {
      const armor = game.character.equipment.armor
      if (armor) {
        armor.enchantment += 1
        addMessage(game, `Your ${armor.template.name} glows! (+${armor.enchantment})`, 'good')
      } else {
        addMessage(game, 'You have no armor equipped.', 'info')
        return { success: false, message: 'No armor', energyCost: 0 }
      }
    }

    // Blessing scroll (+5 to hit, +5 AC)
    if (effect.includes('+5 to hit') && effect.includes('+5 AC')) {
      const duration = 6 + Math.floor(Math.random() * 12)
      addStatusEffect(game.character, { type: 'blessing', turnsRemaining: duration, value: 5 })
      addMessage(game, 'You feel righteous!', 'good')
    }

    // Protection from Evil
    if (effect.includes('Protection from evil')) {
      const duration = 24 + Math.floor(Math.random() * 24)
      addStatusEffect(game.character, { type: 'protection', turnsRemaining: duration, value: 50 })
      addMessage(game, 'You feel protected from evil!', 'good')
    }

    // Default message if no specific effect was handled
    if (
      !effect.includes('Teleport') &&
      !effect.includes('Magic Mapping') &&
      !effect.includes('reveal level') &&
      !effect.includes('Detect') &&
      !effect.includes('Light nearby') &&
      !effect.includes('+1') &&
      !effect.includes('+5 to hit') &&
      !effect.includes('Protection from evil')
    ) {
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

/**
 * Handle spell casting
 */
export function handleCast(game: GameState, spellId: string, targetId?: string): ActionResult {
  const result = castSpell(game, spellId, targetId)

  if (result.message) {
    const messageType = result.success ? (result.damage ? 'combat' : 'good') : 'info'
    addMessage(game, result.message, messageType)
  }

  return {
    success: result.success,
    message: result.message,
    energyCost: result.success ? BASE_ENERGY_COST : 0,
  }
}

/**
 * Handle using a fountain
 */
export function handleUseFountain(game: GameState): ActionResult {
  const success = useFountain(game)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

/**
 * Handle using an altar
 */
export function handleUseAltar(game: GameState): ActionResult {
  const success = useAltar(game)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

/**
 * Handle buying from a merchant
 */
export function handleShopBuy(
  game: GameState,
  merchantIndex: number,
  itemIndex: number
): ActionResult {
  const success = buyFromMerchant(game, merchantIndex, itemIndex)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
}

/**
 * Handle selling to a merchant
 */
export function handleShopSell(
  game: GameState,
  merchantIndex: number,
  inventoryIndex: number
): ActionResult {
  const success = sellToMerchant(game, merchantIndex, inventoryIndex)
  return { success, energyCost: success ? BASE_ENERGY_COST : 0 }
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
    // Monster attacks player - pass primary ability type for resistance calculation
    const primaryAbility = monster.template.abilities[0] as ResistanceType | undefined
    const attackResult = attack(monster, game.character, primaryAbility)
    const message = formatAttackMessageFromEntities(monster, game.character, attackResult)
    addMessage(game, message, 'combat')

    if (attackResult.hit) {
      applyDamage(game.character, attackResult.damage)
      game.stats.damageTaken += attackResult.damage

      // Check for Second Wind booster (auto-heal when critical)
      checkSecondWind(game)

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
