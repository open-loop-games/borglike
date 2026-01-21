/**
 * Bot AI Tick Logic - Urgency-Gated Architecture
 *
 * Main decision-making loop using danger tiers to gate action priorities.
 * This ensures survival actions are checked appropriately based on threat level.
 *
 * Tier-based priority (Angband borg inspired):
 * - CRITICAL: escape > heal > desperate attack
 * - DANGER:   heal > attack > escape
 * - CAUTION:  attack > proactive heal
 * - SAFE:     normal flow (combat > items > movement)
 */

import type { GameState, GameAction, BotPersonality } from '../types'
import { getTile } from '../dungeon'
import { canRangedAttack } from '../combat'

import type { BotState, BotGoal, BotContext, FlowMap, DangerResult, DangerTier } from './types'
import { MAX_FLOW_COST } from './types'
import {
  createBotState,
  resetLevelState,
  recordPosition,
  setGoal,
  recordProgress,
  incrementTurn,
} from './state'
import { computeFlow, createFlowResult, isFlowValid, getFlowCost } from './flow'
import { selectStep, isSamePosition } from './movement'
import { buildBotContext } from './context'
import {
  computeDangerGrid,
  buildAvoidSet,
  getDangerThreshold,
  getLocalDanger,
  getImmediateDanger,
  getImmediateDangerTier,
} from './danger'
import {
  detectStuckLevel,
  getStuckResponse,
  getWallFollowDirection,
  clearPositionHistory,
} from './stuck'
import { selectGoal } from './goals'
import { findAdjacentMonster, hasRangedWeapon, findBestRangedTarget, findKitePosition } from './combat'
import { findEquipmentUpgrades } from './items'
import { getSurvivalConsumableAction, getCombatBuffAction, getPreCombatBuffAction, getUtilityConsumableAction } from './survival'
import {
  getHealingSpellAction,
  getDamageSpellAction,
  getBuffSpellAction,
  getEscapeSpellAction,
  getDebuffSpellAction,
} from './spells'
import { botSellItems, botBuySupplies } from './merchant'

/**
 * Run one tick of bot decision making
 *
 * Uses urgency-gated phases: danger tier determines action priority ordering.
 */
export function runBotTick(
  game: GameState,
  personality: BotPersonality,
  existingState?: BotState
): GameAction {
  // Get or create bot state
  const botState = existingState ?? createBotState()

  // Check for level change
  if (game.character.depth !== botState.currentDepth) {
    resetLevelState(botState, game.character.depth, game.turn)
  }

  // Increment turn counter
  incrementTurn(botState)

  // Build context
  const context = buildBotContext(game, personality, botState)

  // Update known stairs if visible
  updateKnownStairs(game, botState)

  // Compute danger grid
  const dangerResult = computeDangerGrid(game)
  botState.cachedDanger = dangerResult

  // Calculate immediate danger tier (adjacent threats only)
  const immediateDanger = getImmediateDanger(game)
  const hasAdjacentMonster = findAdjacentMonster(game) !== null
  const immediateTier = getImmediateDangerTier(
    immediateDanger,
    game.character.hp,
    game.character.maxHp,
    hasAdjacentMonster
  )

  // Urgency-gated action selection
  const action = selectActionByTier(game, context, botState, dangerResult, personality, immediateTier)
  if (action) return action

  // Fallback: stuck recovery and movement
  return handleFallback(game, context, botState, dangerResult)
}

// ============================================================================
// URGENCY-GATED ACTION SELECTION
// ============================================================================

/**
 * Select action based on immediate danger tier
 *
 * Each tier has different priority orderings:
 * - CRITICAL: survive at all costs
 * - DANGER: heal first, then fight
 * - CAUTION: fight, but heal proactively
 * - SAFE: normal exploration flow
 */
function selectActionByTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality,
  tier: DangerTier
): GameAction | null {
  switch (tier) {
    case 'CRITICAL':
      return handleCriticalTier(game, context, botState, dangerResult, personality)
    case 'DANGER':
      return handleDangerTier(game, context, botState, dangerResult, personality)
    case 'CAUTION':
      return handleCautionTier(game, context, botState, dangerResult, personality)
    case 'SAFE':
      return handleSafeTier(game, context, botState, dangerResult, personality)
  }
}

/**
 * CRITICAL tier: Might die this turn
 *
 * Priority: escape > heal > desperate attack (if cornered)
 */
function handleCriticalTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality
): GameAction | null {
  const { config } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)

  // 1. Try escape spell first (renewable resource)
  const escapeSpell = getEscapeSpellAction(game, config, dangerResult.dangers)
  if (escapeSpell) {
    recordProgress(botState, game.turn)
    return escapeSpell
  }

  // 2. Try escape consumable (teleport scroll, phase door)
  const survivalAction = getSurvivalConsumableAction(
    game, config, dangerResult.dangers, botState, personality
  )
  if (survivalAction) {
    recordProgress(botState, game.turn)
    return survivalAction
  }

  // 3. Try healing spell
  const healSpell = getHealingSpellAction(game, config, localDanger)
  if (healSpell) {
    recordProgress(botState, game.turn)
    return healSpell
  }

  // 4. Desperate attack if cornered (no escape, no heal)
  const adjacentMonster = findAdjacentMonster(game)
  if (adjacentMonster) {
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 5. Try to move away from danger
  return null // Let fallback handle movement
}

/**
 * DANGER tier: Can take maybe 1 hit
 *
 * Priority: heal > attack > escape (strategic retreat)
 */
function handleDangerTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality
): GameAction | null {
  const { config, classProfile } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)
  const adjacentMonster = findAdjacentMonster(game)

  // 1. Healing spell (priority for casters)
  const healSpell = getHealingSpellAction(game, config, localDanger)
  if (healSpell) {
    recordProgress(botState, game.turn)
    return healSpell
  }

  // 2. Survival consumables (healing potion, antidote)
  const survivalAction = getSurvivalConsumableAction(
    game, config, dangerResult.dangers, botState, personality
  )
  if (survivalAction) {
    recordProgress(botState, game.turn)
    return survivalAction
  }

  // 3. Ranged attack if we have distance (avoid melee when hurt)
  if (classProfile.prefersRanged && hasRangedWeapon(game) && !adjacentMonster) {
    const rangedTarget = findBestRangedTarget(game, context.visibleMonsters)
    if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
      recordProgress(botState, game.turn)
      return { type: 'ranged_attack', targetId: rangedTarget.id }
    }
  }

  // 4. Kite away if adjacent and ranged class
  if (adjacentMonster && classProfile.prefersRanged && hasRangedWeapon(game)) {
    const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
    if (kiteDir) {
      recordProgress(botState, game.turn)
      return { type: 'move', direction: kiteDir }
    }
  }

  // 5. Melee attack if we must
  if (adjacentMonster) {
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 6. Escape spell as fallback
  const escapeSpell = getEscapeSpellAction(game, config, dangerResult.dangers)
  if (escapeSpell) {
    recordProgress(botState, game.turn)
    return escapeSpell
  }

  return null
}

/**
 * CAUTION tier: Can take 2+ hits, but should be careful
 *
 * Priority: attack > proactive heal > buffs
 */
function handleCautionTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality
): GameAction | null {
  const { config, classProfile, visibleMonsters } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)
  const adjacentMonster = findAdjacentMonster(game)
  const hpRatio = game.character.hp / game.character.maxHp

  // 1. Combat buffs when approaching enemies
  if (visibleMonsters.length > 0 && !adjacentMonster) {
    const combatBuff = getCombatBuffAction(game, config, dangerResult.dangers)
    if (combatBuff) {
      recordProgress(botState, game.turn)
      return combatBuff
    }

    const preCombatBuff = getPreCombatBuffAction(game, config, visibleMonsters)
    if (preCombatBuff) {
      recordProgress(botState, game.turn)
      return preCombatBuff
    }

    const buffSpell = getBuffSpellAction(game, config, visibleMonsters)
    if (buffSpell) {
      recordProgress(botState, game.turn)
      return buffSpell
    }
  }

  // 2. Ranged combat for ranged classes
  if (classProfile.prefersRanged && hasRangedWeapon(game)) {
    if (adjacentMonster) {
      // Try to kite away
      const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
      if (kiteDir) {
        recordProgress(botState, game.turn)
        return { type: 'move', direction: kiteDir }
      }
    } else {
      // Ranged attack from distance
      const rangedTarget = findBestRangedTarget(game, visibleMonsters)
      if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
        recordProgress(botState, game.turn)
        return { type: 'ranged_attack', targetId: rangedTarget.id }
      }
    }
  }

  // 3. Melee combat
  if (adjacentMonster) {
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 4. Proactive healing when not in melee (if significantly hurt)
  if (hpRatio < 0.7) {
    const healSpell = getHealingSpellAction(game, config, localDanger)
    if (healSpell) {
      recordProgress(botState, game.turn)
      return healSpell
    }

    // Only use consumables if no spell available and quite hurt
    if (hpRatio < 0.5) {
      const survivalAction = getSurvivalConsumableAction(
        game, config, dangerResult.dangers, botState, personality
      )
      if (survivalAction) {
        recordProgress(botState, game.turn)
        return survivalAction
      }
    }
  }

  // 5. Damage/debuff spells for visible enemies
  if (visibleMonsters.length > 0) {
    const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpell) {
      recordProgress(botState, game.turn)
      return damageSpell
    }

    const debuffSpell = getDebuffSpellAction(game, config, visibleMonsters)
    if (debuffSpell) {
      recordProgress(botState, game.turn)
      return debuffSpell
    }
  }

  return null
}

/**
 * SAFE tier: No immediate threats
 *
 * Priority: items > utility > movement/exploration
 */
function handleSafeTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality
): GameAction | null {
  const { config, effectiveConfig, visibleMonsters } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)
  const dangerThreshold = getDangerThreshold(effectiveConfig.aggression, effectiveConfig.caution)
  const hpRatio = game.character.hp / game.character.maxHp

  // 1. Pick up items at current position
  const itemHere = game.items.find((item) =>
    isSamePosition(item.position, game.character.position)
  )
  if (itemHere && localDanger < dangerThreshold) {
    recordProgress(botState, game.turn)
    return { type: 'pickup', itemId: itemHere.id }
  }

  // 2. Equip upgrades
  if (localDanger < dangerThreshold) {
    const upgrades = findEquipmentUpgrades(game.character)
    if (upgrades.length > 0) {
      recordProgress(botState, game.turn)
      return { type: 'equip', itemId: upgrades[0]!.id }
    }
  }

  // 3. Out-of-combat healing when safe and hurt
  if (hpRatio < 0.6) {
    const healSpell = getHealingSpellAction(game, config, localDanger)
    if (healSpell) {
      recordProgress(botState, game.turn)
      return healSpell
    }

    // Only use potions if quite hurt and safe
    if (hpRatio < 0.4) {
      const survivalAction = getSurvivalConsumableAction(
        game, config, dangerResult.dangers, botState, personality
      )
      if (survivalAction) {
        recordProgress(botState, game.turn)
        return survivalAction
      }
    }
  }

  // 4. Pre-combat buffs if monsters visible
  if (visibleMonsters.length > 0) {
    const preCombatBuff = getPreCombatBuffAction(game, config, visibleMonsters)
    if (preCombatBuff) {
      recordProgress(botState, game.turn)
      return preCombatBuff
    }

    const buffSpell = getBuffSpellAction(game, config, visibleMonsters)
    if (buffSpell) {
      recordProgress(botState, game.turn)
      return buffSpell
    }

    // Engage distant enemies with spells
    const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpell) {
      recordProgress(botState, game.turn)
      return damageSpell
    }
  }

  // 5. Utility consumables (enchants, mapping)
  if (localDanger < dangerThreshold) {
    const utilityAction = getUtilityConsumableAction(game, config, dangerResult.dangers, personality)
    if (utilityAction) {
      recordProgress(botState, game.turn)
      return utilityAction
    }
  }

  return null
}

// ============================================================================
// FALLBACK HANDLING
// ============================================================================

/**
 * Handle stuck recovery and goal-based movement
 */
function handleFallback(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult
): GameAction {
  // Stuck recovery (skip in town)
  if (game.character.depth > 0) {
    const stuckAction = handleStuckRecovery(game, context, botState)
    if (stuckAction) return stuckAction
  }

  // Goal selection and movement
  return handleGoalMovement(game, context, botState, dangerResult)
}

// ============================================================================
// HELPER FUNCTIONS (from original tick.ts)
// ============================================================================

function updateKnownStairs(game: GameState, botState: BotState): void {
  const stairsDown = game.currentLevel.stairsDown
  if (stairsDown) {
    const tile = getTile(game.currentLevel, stairsDown.x, stairsDown.y)
    if (tile?.explored) {
      botState.knownStairsDown = stairsDown
    }
  }
}

function handleStuckRecovery(
  game: GameState,
  _context: BotContext,
  botState: BotState
): GameAction | null {
  const pos = game.character.position
  const stuckLevel = detectStuckLevel(botState, game)

  if (stuckLevel === 0) return null

  const adjacentMonster = findAdjacentMonster(game)
  const isFleeing = botState.currentGoal?.type === 'FLEE'
  const stuckResponse = getStuckResponse(
    stuckLevel,
    adjacentMonster !== null,
    botState.knownStairsDown !== null,
    isFleeing
  )

  switch (stuckResponse) {
    case 'wall_follow': {
      const wallDir = getWallFollowDirection(game, botState)
      if (wallDir) {
        recordPosition(botState, pos)
        return { type: 'move', direction: wallDir }
      }
      break
    }

    case 'clear_history':
      clearPositionHistory(botState)
      botState.cachedFlow = null
      botState.currentGoal = null
      botState.goalTarget = null
      recordProgress(botState, game.turn)
      break

    case 'force_combat':
      // Handled by tier system now
      break

    case 'force_descent':
      if (botState.knownStairsDown) {
        if (isSamePosition(pos, botState.knownStairsDown)) {
          recordProgress(botState, game.turn)
          return { type: 'descend' }
        }
        const stairsFlow = computeFlow(game.currentLevel, botState.knownStairsDown)
        const stairsDir = selectStep(game, botState, stairsFlow)
        if (stairsDir !== 'wait') {
          recordPosition(botState, pos)
          return { type: 'move', direction: stairsDir }
        }
      }
      break

    case 'stop_fleeing': {
      botState.fleeCooldownUntil = game.turn + 20
      const forceAttackTarget = findAdjacentMonster(game)
      if (forceAttackTarget) {
        recordProgress(botState, game.turn)
        return { type: 'attack', targetId: forceAttackTarget.id }
      }
      const nearestMonster = game.monsters
        .filter(m => m.hp > 0)
        .map(m => ({
          m,
          dist: Math.abs(m.position.x - pos.x) + Math.abs(m.position.y - pos.y)
        }))
        .sort((a, b) => a.dist - b.dist)[0]?.m

      if (nearestMonster) {
        clearPositionHistory(botState)
        botState.cachedFlow = null
        botState.currentGoal = {
          type: 'KILL',
          target: nearestMonster.position,
          targetId: nearestMonster.id,
          reason: 'Forced combat (stuck fleeing)',
          startTurn: game.turn,
        }
        botState.goalTarget = nearestMonster.position
        recordProgress(botState, game.turn)
      } else {
        clearPositionHistory(botState)
        botState.cachedFlow = null
        botState.currentGoal = null
        botState.goalTarget = null
        recordProgress(botState, game.turn)
      }
      break
    }

    case 'wait':
      return { type: 'wait' }
  }

  return null
}

function handleGoalMovement(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult
): GameAction {
  const { effectiveConfig } = context
  const pos = game.character.position
  const dangerThreshold = getDangerThreshold(effectiveConfig.aggression, effectiveConfig.caution)

  // Select goal
  const goal = selectGoal(context, botState, dangerResult.dangers, dangerThreshold)

  if (!goal || !goal.target) {
    return { type: 'wait' }
  }

  // Set goal in state
  setGoal(botState, goal)

  // Check if we're at the goal
  if (isSamePosition(pos, goal.target)) {
    recordProgress(botState, game.turn)
    updateTownState(botState, goal, game)
    return executeGoalAction(goal, game)
  }

  // Build avoid set (skip when fleeing)
  const avoidSet =
    goal.type === 'FLEE'
      ? new Set<string>()
      : buildAvoidSet(dangerResult.dangers, dangerThreshold, game.character)

  // Compute or reuse flow
  let flowCosts: FlowMap | undefined = botState.cachedFlow?.costs
  const needsRecompute = !isFlowValid(botState.cachedFlow, goal.target, game.turn)

  if (needsRecompute) {
    flowCosts = computeFlow(game.currentLevel, goal.target, avoidSet)
    botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
  }

  // Check if goal is reachable
  const currentCost = getFlowCost(flowCosts!, pos)
  if (currentCost >= MAX_FLOW_COST) {
    // Try without avoidance
    if (avoidSet.size > 0) {
      flowCosts = computeFlow(game.currentLevel, goal.target)
      botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
      const fallbackCost = getFlowCost(flowCosts, pos)
      if (fallbackCost >= MAX_FLOW_COST) {
        botState.currentGoal = null
        botState.goalTarget = null
        botState.cachedFlow = null
        return { type: 'wait' }
      }
    } else {
      botState.currentGoal = null
      botState.goalTarget = null
      botState.cachedFlow = null
      return { type: 'wait' }
    }
  }

  // Select step toward goal
  const direction = selectStep(game, botState, flowCosts!)
  recordPosition(botState, pos)

  // Record progress for productive goals (not FLEE/RECOVER)
  if (direction !== 'wait' && goal.type !== 'FLEE' && goal.type !== 'RECOVER') {
    recordProgress(botState, game.turn)
  }

  return { type: 'move', direction }
}

function updateTownState(botState: BotState, goal: BotGoal, _game: GameState): void {
  if (goal.type === 'SELL_TO_MERCHANT') {
    botState.itemsSold = true
  }
  if (goal.type === 'VISIT_HEALER') {
    botState.healerVisited = true
  }
  if (goal.type === 'BUY_FROM_MERCHANT') {
    botState.itemsBought = true
  }
}

function executeGoalAction(goal: BotGoal, game: GameState): GameAction {
  switch (goal.type) {
    case 'DESCEND':
      return { type: 'descend' }

    case 'TAKE': {
      const itemAtGoal = game.items.find((item) =>
        isSamePosition(item.position, game.character.position)
      )
      if (itemAtGoal) {
        return { type: 'pickup', itemId: itemAtGoal.id }
      }
      return { type: 'wait' }
    }

    case 'EXPLORE':
      return { type: 'wait' }

    case 'RECOVER':
      return { type: 'wait' }

    case 'KILL':
      return { type: 'wait' }

    case 'FLEE':
      return { type: 'wait' }

    case 'KITE': {
      if (goal.targetId) {
        const monster = game.monsters.find((m) => m.id === goal.targetId && m.hp > 0)
        if (monster && canRangedAttack(game.character, monster.position)) {
          return { type: 'ranged_attack', targetId: monster.id }
        }
      }
      return { type: 'wait' }
    }

    case 'SELL_TO_MERCHANT':
      botSellItems(game)
      return { type: 'wait' }

    case 'VISIT_HEALER':
      return { type: 'use_healer' }

    case 'BUY_FROM_MERCHANT':
      botBuySupplies(game)
      return { type: 'wait' }

    case 'RETURN_PORTAL':
      return { type: 'use_return_portal' }

    case 'EXIT_TOWN':
      return { type: 'descend' }

    default:
      return { type: 'wait' }
  }
}
