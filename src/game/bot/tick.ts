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
import { isBossOrUnique } from '../types'
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
  cleanupBlacklist,
} from './state'
import { computeFlow, computeExplorationFlow, createFlowResult, isFlowValid, getFlowCost } from './flow'
import { selectStep, isSamePosition } from './movement'
import { buildBotContext } from './context'
import {
  computeDangerGrid,
  buildAvoidSet,
  getDangerThreshold,
  getLocalDanger,
  getImmediateDanger,
  getImmediateDangerTier,
  getMonsterThreat,
} from './danger'
import {
  detectStuckLevel,
  getStuckResponse,
  handleWallFollowStrategy,
  handleClearHistoryStrategy,
  handleForceDescentStrategy,
  handleStopFleeingStrategy,
} from './stuck'
import { selectGoal } from './goals'
import { invalidateFrontierCache, getFrontierPositions } from './exploration'
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
    invalidateFrontierCache()
  }

  // Increment turn counter
  incrementTurn(botState)

  // Clean up expired blacklist entries
  cleanupBlacklist(botState, game.turn)

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
    setKillGoal(botState, adjacentMonster, game.turn, 'Desperate attack')
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
    setKillGoal(botState, adjacentMonster, game.turn, 'Melee attack (danger)')
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

  // 1. Combat buffs only for bosses/uniques when approaching
  if (visibleMonsters.length > 0 && !adjacentMonster) {
    // Only buff for dangerous targets (uniques/bosses)
    const hasBossTarget = visibleMonsters.some(isBossOrUnique)

    if (hasBossTarget) {
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

    // No buffs - let goal system handle movement toward monsters (creates KILL goal)
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
    setKillGoal(botState, adjacentMonster, game.turn, 'Melee combat')
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

  // 4. Pre-combat buffs only for bosses/uniques
  if (visibleMonsters.length > 0) {
    const hasBossTarget = visibleMonsters.some(isBossOrUnique)

    if (hasBossTarget) {
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

    // Engage distant enemies with spells
    const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpell) {
      recordProgress(botState, game.turn)
      return damageSpell
    }

    // No spells - let goal system handle movement toward monsters (creates KILL goal)
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
    case 'wall_follow':
      return handleWallFollowStrategy(game, botState)

    case 'clear_history':
      handleClearHistoryStrategy(botState, game.turn)
      return null

    case 'force_combat':
      // Handled by tier system now
      return null

    case 'force_descent':
      return handleForceDescentStrategy(game, botState)

    case 'stop_fleeing':
      return handleStopFleeingStrategy(game, botState, findAdjacentMonster)

    case 'wait':
      return { type: 'wait' }

    default:
      return null
  }
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

  // For EXPLORE goals, use Dijkstra map approach (all frontiers as goals)
  // This eliminates target selection thrashing - bot just "rolls downhill"
  if (goal.type === 'EXPLORE') {
    // Recompute exploration flow each turn (frontier changes as we move)
    const frontiers = getFrontierPositions(game)
    if (frontiers.length === 0) {
      // No frontiers - exploration complete
      botState.currentGoal = null
      botState.goalTarget = null
      return { type: 'wait' }
    }
    flowCosts = computeExplorationFlow(game.currentLevel, frontiers, avoidSet)
    botState.cachedFlow = null // Don't use single-target cache for EXPLORE
  } else {
    // Standard single-target flow for other goal types
    const needsRecompute = !isFlowValid(botState.cachedFlow, goal.target, game.turn)
    if (needsRecompute) {
      flowCosts = computeFlow(game.currentLevel, goal.target, avoidSet)
      botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
    }
  }

  // Check if goal is reachable
  const currentCost = getFlowCost(flowCosts!, pos)
  if (currentCost >= MAX_FLOW_COST) {
    // Try without avoidance
    if (avoidSet.size > 0) {
      if (goal.type === 'EXPLORE') {
        // For EXPLORE, recompute exploration flow without avoidance
        const frontiers = getFrontierPositions(game)
        flowCosts = frontiers.length > 0
          ? computeExplorationFlow(game.currentLevel, frontiers)
          : new Map()
      } else {
        flowCosts = computeFlow(game.currentLevel, goal.target)
        botState.cachedFlow = createFlowResult(goal.target, flowCosts, game.turn)
      }
      const fallbackCost = getFlowCost(flowCosts, pos)
      if (fallbackCost >= MAX_FLOW_COST) {
        // Truly unreachable
        botState.currentGoal = null
        botState.goalTarget = null
        botState.cachedFlow = null
        return { type: 'wait' }
      }
    } else {
      // No avoidance to remove - truly unreachable
      botState.currentGoal = null
      botState.goalTarget = null
      botState.cachedFlow = null
      return { type: 'wait' }
    }
  }

  // Check for buffs when approaching dangerous KILL target
  // This catches bosses like Wormtongue before we enter melee range
  if (goal.type === 'KILL' && goal.targetId) {
    const targetMonster = game.monsters.find(m => m.id === goal.targetId && m.hp > 0)
    if (targetMonster) {
      const threat = getMonsterThreat(targetMonster, game.character)
      // Use same threshold as getPreCombatBuffAction (100 = roughly 10-damage awake monster)
      // But also check for unique/boss monsters which may have lower threat but deserve buffs
      const BUFF_THREAT_THRESHOLD = 100
      const isUnique = targetMonster.template.flags.includes('UNIQUE')
      const shouldBuff = threat >= BUFF_THREAT_THRESHOLD || isUnique

      if (shouldBuff) {
        // Try combat buff potions (heroism/berserk) for dangerous fights
        const combatBuff = getCombatBuffAction(game, context.config, dangerResult.dangers)
        if (combatBuff) {
          recordProgress(botState, game.turn)
          return combatBuff
        }

        // Try pre-combat buffs (blessing scrolls)
        const preCombatBuff = getPreCombatBuffAction(game, context.config, context.visibleMonsters)
        if (preCombatBuff) {
          recordProgress(botState, game.turn)
          return preCombatBuff
        }
      }
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
  // Mark shop as visited based on goal type and targetId (shop ID)
  if (goal.type === 'SELL_TO_MERCHANT' && goal.targetId) {
    botState.shopsVisitedForSelling.add(goal.targetId)
  }
  if (goal.type === 'VISIT_HEALER') {
    botState.healerVisited = true
  }
  if (goal.type === 'BUY_FROM_MERCHANT' && goal.targetId) {
    botState.shopsVisitedForBuying.add(goal.targetId)
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

// ============================================================================
// COMBAT HELPERS
// ============================================================================

/**
 * Set a KILL goal for an adjacent monster
 * This ensures combat actions are tracked in the goal system
 */
function setKillGoal(
  botState: BotState,
  monster: { id: string; position: { x: number; y: number }; template: { name: string } },
  turn: number,
  reason: string
): void {
  setGoal(botState, {
    type: 'KILL',
    target: monster.position,
    targetId: monster.id,
    reason: reason,
    startTurn: turn,
  })
}
