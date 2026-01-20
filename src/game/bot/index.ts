/**
 * Bot AI Module - Phase 8: Personality System
 *
 * Provides auto-player functionality for Borglike.
 * This module implements reliable movement with danger avoidance,
 * goal-based decision making, combat engagement, item evaluation,
 * smart exploration, personality-driven behavior, and anti-stuck recovery.
 */

import type { GameState, GameAction, BotPersonality } from '../types'
import type { UpgradeBonuses } from '../upgrade-effects'
import { DEFAULT_BONUSES } from '../upgrade-effects'
import { getTile } from '../dungeon'

// Internal imports
import type { BotState, BotGoal, BotContext, PersonalityConfig, FlowMap, DangerTier, PhaseDoorSafety } from './types'
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
import {
  buildBotContext,
  getBotStatus,
  evaluateDanger,
} from './context'
import {
  computeDangerGrid,
  buildAvoidSet,
  getDangerThreshold,
  getLocalDanger,
  calculateAvoidance,
  getDangerTier,
} from './danger'
import {
  detectStuckLevel,
  getStuckResponse,
  getWallFollowDirection,
  clearPositionHistory,
} from './stuck'
import { selectGoal } from './goals'
import { findAdjacentMonster } from './combat'
import { findEquipmentUpgrades } from './items'
import { getSurvivalConsumableAction, getCombatBuffAction, getUtilityConsumableAction } from './survival'
import {
  getHealingSpellAction,
  getDamageSpellAction,
  getBuffSpellAction,
  getEscapeSpellAction,
} from './spells'

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types
export type { BotState, BotGoal, BotContext, PersonalityConfig, DangerTier, PhaseDoorSafety }

// Re-export state functions
export { createBotState, resetLevelState }

// Re-export context functions
export { buildBotContext, getBotStatus, evaluateDanger }

// Re-export danger functions (Angband-inspired avoidance system)
export { calculateAvoidance, getDangerTier }

// Re-export personality functions
export {
  PERSONALITIES,
  BASE_CONFIGS,
  getPersonalityConfig,
  getPersonalityTypes,
  isValidPersonality,
  createCustomPersonality,
  blendPersonalities,
  modifyPersonality,
  validatePersonality,
  describePersonality,
  summarizePersonality,
  comparePersonalities,
  predictCombatBehavior,
  predictExplorationBehavior,
  getItemDetourDistance,
  getEffectiveDangerThreshold,
  getPersonalityDebugInfo,
  PARAMETER_INFO,
} from './personality'

export type { ParameterInfo } from './personality'

// Re-export item functions
export {
  evaluateItem,
  shouldPickup,
  shouldEquip,
  compareEquipment,
  calculateEquipmentScore,
  findEquipmentUpgrades,
  prioritizeItems,
  findHealingPotion,
  findEscapeScroll,
  findPhaseDoorScroll,
  findFullTeleportScroll,
  findSpeedPotion,
  findBuffPotion,
  findResistancePotion,
  findNeutralizePoison,
  findBlessingScroll,
  findProtectionScroll,
  findMappingScroll,
  findEnchantScroll,
  hasStatusEffect,
  hasTempResistance,
} from './items'

export type { ItemEvaluation, EquipmentComparison } from './items'

// Re-export survival functions
export {
  getSurvivalConsumableAction,
  getCombatBuffAction,
  getUtilityConsumableAction,
  shouldRetreat,
  needsHealing,
  isCriticalHP,
  findBestEscapeRoute,
  getHPStatus,
  getHitsTillDeath,
  evaluatePhaseDoorSafety,
  shouldEscapeOverHeal,
} from './survival'

export type { RetreatEvaluation, EscapeRoute } from './survival'

// Re-export exploration functions
export {
  findFrontierTiles,
  findExplorationTarget,
  getExplorationStats,
  getExplorationProgress,
  shouldStopExploring,
  findExplorationClusters,
  findBestCluster,
  getExplorationDebugInfo,
} from './exploration'

export type { FrontierTile, ExplorationCluster, ExplorationStats } from './exploration'

// ============================================================================
// MAIN BOT TICK
// ============================================================================

/**
 * Run one tick of bot decision making
 *
 * @param game - Current game state
 * @param personality - Bot personality type
 * @param upgrades - Optional upgrade bonuses (for future use)
 * @param existingState - Optional existing bot state (for persistence)
 * @returns GameAction to execute
 */
export function runBotTick(
  game: GameState,
  personality: BotPersonality,
  _upgrades: UpgradeBonuses = DEFAULT_BONUSES,
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
  const config = context.config

  // Update known stairs if we can see them
  const stairsDown = game.currentLevel.stairsDown
  if (stairsDown) {
    const tile = getTile(game.currentLevel, stairsDown.x, stairsDown.y)
    if (tile?.explored) {
      botState.knownStairsDown = stairsDown
    }
  }

  // Phase 2: Compute danger grid
  const dangerResult = computeDangerGrid(game)
  botState.cachedDanger = dangerResult
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)

  // Phase 2: Compute danger threshold
  const dangerThreshold = getDangerThreshold(config.aggression, config.caution)

  // Check for adjacent monsters
  const adjacentMonster = findAdjacentMonster(game)
  const hpRatio = game.character.hp / game.character.maxHp

  // Caster emergency healing: heal BEFORE attack when critically low HP
  // This follows the Angband borg pattern: borg_caution() runs before borg_attack()
  if (adjacentMonster && hpRatio < 0.5) {
    const healSpellAction = getHealingSpellAction(game, config, localDanger)
    if (healSpellAction) {
      recordProgress(botState, game.turn)
      return healSpellAction
    }
  }

  // Attack adjacent monster (only if we didn't need emergency healing)
  if (adjacentMonster) {
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // Normal healing spells (when not in melee - higher priority than potions for casters)
  const healSpellAction = getHealingSpellAction(game, config, localDanger)
  if (healSpellAction) {
    recordProgress(botState, game.turn)
    return healSpellAction
  }

  // Emergency escape spells (before survival consumables)
  const escapeSpellAction = getEscapeSpellAction(game, config, dangerResult.dangers)
  if (escapeSpellAction) {
    recordProgress(botState, game.turn)
    return escapeSpellAction
  }

  // Check if we need to use a survival consumable (healing/escape/antidote)
  const survivalAction = getSurvivalConsumableAction(game, config, dangerResult.dangers, botState)
  if (survivalAction) {
    recordProgress(botState, game.turn)
    return survivalAction
  }

  // Check if we should use combat buffs (speed, heroism, berserk, blessing, resistances)
  const combatBuffAction = getCombatBuffAction(game, config, dangerResult.dangers)
  if (combatBuffAction) {
    recordProgress(botState, game.turn)
    return combatBuffAction
  }

  // Buff spells before combat (if enemies visible but not adjacent)
  const visibleMonsters = context.visibleMonsters
  if (visibleMonsters.length > 0) {
    const buffSpellAction = getBuffSpellAction(game, config, visibleMonsters)
    if (buffSpellAction) {
      recordProgress(botState, game.turn)
      return buffSpellAction
    }
  }

  // Damage spells in combat (when enemies are visible)
  if (visibleMonsters.length > 0) {
    const damageSpellAction = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpellAction) {
      recordProgress(botState, game.turn)
      return damageSpellAction
    }
  }

  // Check for items at our position (quick pickup)
  const itemHere = game.items.find((item) =>
    isSamePosition(item.position, game.character.position)
  )
  if (itemHere && localDanger < dangerThreshold) {
    recordProgress(botState, game.turn)
    return { type: 'pickup', itemId: itemHere.id }
  }

  // Check for equipment upgrades in inventory (when safe)
  if (localDanger < dangerThreshold) {
    const upgrades = findEquipmentUpgrades(game.character)
    if (upgrades.length > 0) {
      recordProgress(botState, game.turn)
      return { type: 'equip', itemId: upgrades[0]!.id }
    }

    // Check if we should use utility consumables (enchant scrolls, mapping)
    const utilityAction = getUtilityConsumableAction(game, config, dangerResult.dangers)
    if (utilityAction) {
      recordProgress(botState, game.turn)
      return utilityAction
    }
  }

  // Phase 3: Stuck detection and recovery
  const stuckLevel = detectStuckLevel(botState, game)
  if (stuckLevel > 0) {
    const isFleeing = botState.currentGoal?.type === 'FLEE'
    const stuckResponse = getStuckResponse(
      stuckLevel,
      adjacentMonster !== null,
      botState.knownStairsDown !== null,
      isFleeing
    )

    switch (stuckResponse) {
      case 'wall_follow':
        // Use wall following to systematically find new areas
        const wallDir = getWallFollowDirection(game, botState)
        if (wallDir) {
          recordPosition(botState, pos)
          // Don't record progress - wall following is a recovery action, not real progress
          return { type: 'move', direction: wallDir }
        }
        break

      case 'clear_history':
        // Clear position history and cached data to start fresh
        clearPositionHistory(botState)
        botState.cachedFlow = null
        botState.currentGoal = null
        botState.goalTarget = null
        recordProgress(botState, game.turn)
        // Fall through to normal logic with fresh state
        break

      case 'force_combat':
        // Attack adjacent monster to clear blockage
        // Note: already handled by early adjacentMonster check above
        // This case falls through to normal goal selection
        break

      case 'force_descent':
        // Head straight to stairs, ignoring danger
        if (botState.knownStairsDown) {
          if (isSamePosition(pos, botState.knownStairsDown)) {
            recordProgress(botState, game.turn)
            return { type: 'descend' }
          }
          // Force path to stairs without avoidance
          const stairsFlow = computeFlow(game.currentLevel, botState.knownStairsDown)
          const stairsDir = selectStep(game, botState, stairsFlow)
          if (stairsDir !== 'wait') {
            recordPosition(botState, pos)
            return { type: 'move', direction: stairsDir }
          }
        }
        break

      case 'stop_fleeing':
        // Fleeing isn't working - force a different behavior
        // Set cooldown to prevent immediately fleeing again (20 turns)
        botState.fleeCooldownUntil = game.turn + 20

        // Re-check for adjacent monster (state may have changed)
        const forceAttackTarget = findAdjacentMonster(game)
        if (forceAttackTarget) {
          recordProgress(botState, game.turn)
          return { type: 'attack', targetId: forceAttackTarget.id }
        }
        // Otherwise, find nearest visible monster and head toward it
        const nearestMonster = game.monsters
          .filter(m => m.hp > 0)
          .map(m => ({
            m,
            dist: Math.abs(m.position.x - pos.x) + Math.abs(m.position.y - pos.y)
          }))
          .sort((a, b) => a.dist - b.dist)[0]?.m

        if (nearestMonster) {
          // Clear flee state and set KILL goal
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
          // Fall through to movement toward the monster
        } else {
          // No monsters - clear state and explore
          clearPositionHistory(botState)
          botState.cachedFlow = null
          botState.currentGoal = null
          botState.goalTarget = null
          recordProgress(botState, game.turn)
        }
        break

      case 'wait':
        // Severely stuck, just wait
        return { type: 'wait' }
    }
    // If stuck response didn't produce action, fall through to normal logic
  }

  // Phase 4: Goal selection with priorities
  const goal = selectGoal(context, botState, dangerResult.dangers, dangerThreshold)

  if (!goal || !goal.target) {
    // No goal or no target - just wait
    // Adjacent monsters are handled by early check above
    return { type: 'wait' }
  }

  // Set goal in state
  setGoal(botState, goal)

  // Check if we're at the goal
  if (isSamePosition(pos, goal.target)) {
    // Reaching a goal is progress
    recordProgress(botState, game.turn)
    // At goal - execute goal action
    return executeGoalAction(goal, game)
  }

  // Phase 2: Build avoid set from danger (skip when fleeing - need any path)
  const avoidSet =
    goal.type === 'FLEE'
      ? new Set<string>() // Don't avoid anything when fleeing
      : buildAvoidSet(dangerResult.dangers, dangerThreshold, game.character)

  // Compute or reuse flow (invalidate if danger changed significantly)
  let flowCosts: FlowMap | undefined = botState.cachedFlow?.costs

  // Recompute flow when goal target changed
  // Note: FLEE goals now persist their target, so no special case needed
  const needsRecompute = !isFlowValid(botState.cachedFlow, goal.target, game.turn)

  if (needsRecompute) {
    // Recompute flow with danger avoidance
    flowCosts = computeFlow(game.currentLevel, goal.target, avoidSet)
    botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
  }

  // Check if goal is reachable
  const currentCost = getFlowCost(flowCosts!, pos)
  if (currentCost >= MAX_FLOW_COST) {
    // Goal unreachable with avoidance - try without avoidance
    if (avoidSet.size > 0) {
      flowCosts = computeFlow(game.currentLevel, goal.target)
      botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
      const fallbackCost = getFlowCost(flowCosts, pos)
      if (fallbackCost >= MAX_FLOW_COST) {
        // Truly unreachable
        botState.currentGoal = null
        botState.goalTarget = null
        botState.cachedFlow = null
        return { type: 'wait' }
      }
    } else {
      // Goal truly unreachable
      botState.currentGoal = null
      botState.goalTarget = null
      botState.cachedFlow = null
      return { type: 'wait' }
    }
  }

  // Select step toward goal
  const direction = selectStep(game, botState, flowCosts!)

  // Record position for anti-oscillation
  recordPosition(botState, pos)

  // Record progress only for productive goals (not FLEE/RECOVER/WAIT)
  // This ensures stuck detection triggers when fleeing in circles
  if (direction !== 'wait' && goal.type !== 'FLEE' && goal.type !== 'RECOVER') {
    recordProgress(botState, game.turn)
  }

  return { type: 'move', direction }
}

// ============================================================================
// GOAL EXECUTION
// ============================================================================

/**
 * Execute action when at goal
 */
function executeGoalAction(goal: BotGoal, game: GameState): GameAction {
  switch (goal.type) {
    case 'DESCEND':
      return { type: 'descend' }

    case 'TAKE':
      // Pick up item at our position
      const itemAtGoal = game.items.find((item) =>
        isSamePosition(item.position, game.character.position)
      )
      if (itemAtGoal) {
        return { type: 'pickup', itemId: itemAtGoal.id }
      }
      return { type: 'wait' }

    case 'EXPLORE':
      // We've reached exploration target, will select new one next tick
      return { type: 'wait' }

    case 'RECOVER':
      // Wait to recover HP
      return { type: 'wait' }

    case 'KILL':
      // We should be adjacent to target - attack handled by adjacentMonster check
      // If we're here, the target moved or died
      return { type: 'wait' }

    case 'FLEE':
      // Reached flee target, re-evaluate
      return { type: 'wait' }

    default:
      return { type: 'wait' }
  }
}

