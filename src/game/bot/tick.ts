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

import type {
  BotState,
  BotGoal,
  BotContext,
  FlowMap,
  DangerResult,
  DangerTier,
  PersonalityConfig,
} from './types'
import { MAX_FLOW_COST, SQUISHY_CLASSES, CASTER_STAIR_SURF_MIN_LEVEL } from './types'
import {
  createBotState,
  resetLevelState,
  recordPosition,
  setGoal,
  clearGoal,
  recordProgress,
  incrementTurn,
  cleanupBlacklist,
  resetAfterTeleport as _resetAfterTeleport,
} from './state'
import {
  computeFlow,
  computeExplorationFlow,
  createFlowResult,
  isFlowValid,
  getFlowCost,
} from './flow'
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
import {
  invalidateFrontierCache,
  getFrontierPositions,
  getSweepFrontierPositions,
} from './exploration'
import { initializeSweepDirection } from './progression'
import { recordVisibleTiles } from './progression'
import {
  findAdjacentMonster,
  hasRangedWeapon,
  findBestRangedTarget,
  findKitePosition,
  shouldAvoidMelee,
  findClosestMonster,
  countAdjacentMonsters,
} from './combat'
import { getBowRange } from '../combat'
import { findEquipmentUpgrades, isTeleportAction as _isTeleportAction } from './items'
import {
  getSurvivalConsumableAction,
  getCombatBuffAction,
  getPreCombatBuffAction,
  getUtilityConsumableAction,
} from './survival'
import {
  getHealingSpellAction,
  getDamageSpellAction,
  getBuffSpellAction,
  getEscapeSpellAction,
  getPhaseDoorSpellAction,
  getDebuffSpellAction,
  getSummonSpellAction,
  getRootShotAction,
  classShouldSummon,
  getLightOrbSpellAction,
} from './spells'
import { botSellItems, botBuySupplies } from './merchant'
import { profile } from './profiler'
import type { DungeonLevel } from '../types'

/**
 * Count explored tiles in a level (for cache validation)
 */
function countExploredTiles(level: DungeonLevel): number {
  let count = 0
  for (let y = 0; y < level.height; y++) {
    const row = level.tiles[y]
    if (!row) continue
    for (let x = 0; x < level.width; x++) {
      if (row[x]?.explored) count++
    }
  }
  return count
}

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
    const wasInFarmingMode = botState.farmingMode
    resetLevelState(botState, game.character.depth, game.turn)
    invalidateFrontierCache()

    // Set known stairs immediately from level data on level transition
    // Both stairsUp and stairsDown positions are stored in the level
    if (game.character.depth > 0) {
      const stairsUp = game.currentLevel.stairsUp
      const stairsDown = game.currentLevel.stairsDown

      if (stairsUp) {
        botState.knownStairsUp = { x: stairsUp.x, y: stairsUp.y }
      }
      if (stairsDown) {
        botState.knownStairsDown = { x: stairsDown.x, y: stairsDown.y }
      }
    }

    // Initialize sweep mode for early-game casters on any dungeon level change
    // Casters use sweep exploration instead of tethered exploration during farming
    const isCaster = SQUISHY_CLASSES.has(game.character.classId)
    const isEarlyGame = game.character.level < CASTER_STAIR_SURF_MIN_LEVEL
    const inDungeon = game.character.depth !== 0
    if (isCaster && isEarlyGame && inDungeon) {
      botState.sweepMode = true
      botState.sweepStartTurn = game.turn
      initializeSweepDirection(game, botState)
      // Don't set tetheredOrigin - casters use sweep, not tether
    } else if (wasInFarmingMode && inDungeon) {
      // Set tethered origin for non-casters in farming mode
      // Origin = current position (where we entered the level)
      // The tether check in evaluateAscendToFarm will block flipping until exploration is done
      botState.tetheredOrigin = { x: game.character.position.x, y: game.character.position.y }
    }
  }

  // Increment turn counter
  incrementTurn(botState)

  // Clean up expired blacklist entries
  cleanupBlacklist(botState, game.turn)

  // Build context
  const context = profile('buildBotContext', () => buildBotContext(game, personality, botState))

  // Update known stairs if visible
  updateKnownStairs(game, botState)

  // Record all currently visible tiles (for tethered exploration check)
  profile('recordVisibleTiles', () => recordVisibleTiles(game, botState))

  // Update HP tracking for DOT detection
  updateHPTracking(game, botState)

  // Compute danger grid
  const dangerResult = profile('computeDangerGrid', () => computeDangerGrid(game))
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
  const action = profile('selectActionByTier', () =>
    selectActionByTier(game, context, botState, dangerResult, personality, immediateTier)
  )
  if (action) {
    return action
  }

  // Fallback: stuck recovery and movement
  return profile('handleFallback', () => handleFallback(game, context, botState, dangerResult))
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
 * Priority: escape > heal > ranged attack (if ranged class) > desperate melee
 */
function handleCriticalTier(
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

  // 1. Try escape spell first (renewable resource)
  const escapeSpell = getEscapeSpellAction(game, config, dangerResult.dangers)
  if (escapeSpell) {
    // TODO: resetAfterTeleport causes regression, disabled pending investigation
    // resetAfterTeleport(botState)
    recordProgress(botState, game.turn)
    return escapeSpell
  }

  // 2. Try escape consumable (teleport scroll, phase door)
  const survivalAction = getSurvivalConsumableAction(
    game,
    config,
    dangerResult.dangers,
    botState,
    personality,
    classProfile.healsPriority
  )
  if (survivalAction) {
    // TODO: resetAfterTeleport causes regression, disabled pending investigation
    // if (isTeleportAction(game.character, survivalAction)) {
    //   resetAfterTeleport(botState)
    // }
    recordProgress(botState, game.turn)
    return survivalAction
  }

  // 3. Try healing spell
  const healSpell = getHealingSpellAction(game, config, localDanger, classProfile.healsPriority)
  if (healSpell) {
    recordProgress(botState, game.turn)
    return healSpell
  }

  // 4. For ranged classes: try to kite away or attack from distance
  if (classProfile.prefersRanged) {
    // Try to kite away if adjacent (physical movement works for all ranged classes)
    if (adjacentMonster) {
      const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
      if (kiteDir) {
        recordProgress(botState, game.turn)
        return { type: 'move', direction: kiteDir }
      }
    }

    // Ranged attack if not adjacent and have targets
    if (!adjacentMonster) {
      if (hasRangedWeapon(game)) {
        // Bow attack for rangers
        const rangedTarget = findBestRangedTarget(game, visibleMonsters)
        if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
          recordProgress(botState, game.turn)
          return { type: 'ranged_attack', targetId: rangedTarget.id }
        }
      } else {
        // Damage spell for casters (mage, archmage, necromancer)
        const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
        if (damageSpell) {
          recordProgress(botState, game.turn)
          return damageSpell
        }
      }
    }
  }

  // 5. Desperate melee attack if cornered (no escape, no heal, can't kite)
  if (adjacentMonster) {
    setKillGoal(botState, adjacentMonster, game.turn, 'Desperate attack')
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 6. Try to move away from danger
  return null // Let fallback handle movement
}

/**
 * DANGER tier: Can take maybe 1 hit
 *
 * Priority for ranged classes: kite > ranged attack > heal > melee fallback
 * Priority for melee classes: heal > attack > escape
 */
function handleDangerTier(
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

  // For ranged classes: prioritize repositioning and attacking from distance
  if (classProfile.prefersRanged) {
    // 1. If adjacent, try root_shot (rangers only) then kite away
    if (adjacentMonster) {
      // Root shot only for rangers who have it
      if (hasRangedWeapon(game)) {
        const rootAction = getRootShotAction(game, adjacentMonster)
        if (rootAction) {
          recordProgress(botState, game.turn)
          return rootAction
        }
      }

      // Mage/Archmage: Try Phase Door at DANGER tier (tactical escape)
      // Only when actually threatened: HP < 50% OR surrounded (2+ adjacent)
      // Avoids disrupting exploration when bot could just fight
      const classId = game.character.classId
      const hpRatio = game.character.hp / game.character.maxHp
      const adjacentCount = countAdjacentMonsters(game, pos)
      if (classId === 'mage' || classId === 'archmage') {
        if (hpRatio < 0.5 || adjacentCount >= 2) {
          const phaseDoorAction = getPhaseDoorSpellAction(game)
          if (phaseDoorAction) {
            // TODO: resetAfterTeleport causes regression, disabled pending investigation
            // resetAfterTeleport(botState)
            recordProgress(botState, game.turn)
            return phaseDoorAction
          }
        }
      }

      // 2. Kite away if adjacent (physical movement works for all ranged classes)
      const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
      if (kiteDir) {
        recordProgress(botState, game.turn)
        return { type: 'move', direction: kiteDir }
      }
    }

    // 3. Ranged attack if at safe distance
    if (!adjacentMonster) {
      if (hasRangedWeapon(game)) {
        // Bow attack for rangers
        const rangedTarget = findBestRangedTarget(game, visibleMonsters)
        if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
          recordProgress(botState, game.turn)
          return { type: 'ranged_attack', targetId: rangedTarget.id }
        }
      } else {
        // Damage spell for casters (mage, archmage, necromancer)
        const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
        if (damageSpell) {
          recordProgress(botState, game.turn)
          return damageSpell
        }
      }
    }
  }

  // 3. Healing spell
  const healSpell = getHealingSpellAction(game, config, localDanger, classProfile.healsPriority)
  if (healSpell) {
    recordProgress(botState, game.turn)
    return healSpell
  }

  // 4. Survival consumables (healing potion, antidote)
  const survivalAction = getSurvivalConsumableAction(
    game,
    config,
    dangerResult.dangers,
    botState,
    personality,
    classProfile.healsPriority
  )
  if (survivalAction) {
    recordProgress(botState, game.turn)
    return survivalAction
  }

  // 5. Summon minion if missing (tanking help)
  if (classShouldSummon(game.character.classId)) {
    const summonAction = getSummonSpellAction(game, config, visibleMonsters)
    if (summonAction) {
      recordProgress(botState, game.turn)
      return summonAction
    }
  }

  // 6. Melee attack if we must (or if melee class)
  if (adjacentMonster) {
    setKillGoal(botState, adjacentMonster, game.turn, 'Melee attack (danger)')
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 7. Escape spell as fallback
  const escapeSpellFallback = getEscapeSpellAction(game, config, dangerResult.dangers)
  if (escapeSpellFallback) {
    // TODO: resetAfterTeleport causes regression, disabled pending investigation
    // resetAfterTeleport(botState)
    recordProgress(botState, game.turn)
    return escapeSpellFallback
  }

  return null
}

/**
 * CAUTION tier: Can take 2+ hits, but should be careful
 *
 * Priority for ranged classes: kite > ranged attack > melee fallback > proactive heal
 * Priority for melee classes: buffs > melee > proactive heal
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

  // 1. For ranged classes: prioritize repositioning and attacking from distance FIRST
  if (classProfile.prefersRanged) {
    if (adjacentMonster) {
      // Try root_shot first (rangers only) to stun before kiting
      if (hasRangedWeapon(game)) {
        const rootAction = getRootShotAction(game, adjacentMonster)
        if (rootAction) {
          recordProgress(botState, game.turn)
          return rootAction
        }

        // Bow users: kite away
        const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
        if (kiteDir) {
          recordProgress(botState, game.turn)
          return { type: 'move', direction: kiteDir }
        }
      } else {
        // Casters: finish the kill with damage spell instead of futile kiting
        // With low visibility, kiting just delays - better to deal damage
        // If HP gets critical, DANGER tier will use phase door to escape
        const damageSpell = getDamageSpellAction(game, config, [adjacentMonster])
        if (damageSpell) {
          recordProgress(botState, game.turn)
          return damageSpell
        }
      }
    } else if (visibleMonsters.length > 0) {
      // Check if we need to proactively reposition (monster very close and pursuing)
      // Only for casters - bow users should shoot at dist 2, not kite
      if (!hasRangedWeapon(game)) {
        const nearest = findClosestMonster(visibleMonsters, pos)
        if (nearest) {
          const dist = nearest.distance
          // Only reposition when at distance 2 AND monster is awake
          // This prevents oscillation while still avoiding getting cornered
          if (dist === 2 && nearest.monster.isAwake) {
            const kiteDir = findKitePosition(game, nearest.monster, classProfile)
            if (kiteDir) {
              recordProgress(botState, game.turn)
              return { type: 'move', direction: kiteDir }
            }
          }
        }
      }

      // Ranged attack from distance
      if (hasRangedWeapon(game)) {
        // Bow attack for rangers
        const rangedTarget = findBestRangedTarget(game, visibleMonsters)
        if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
          recordProgress(botState, game.turn)
          return { type: 'ranged_attack', targetId: rangedTarget.id }
        }
      } else {
        // Damage spell for casters (mage, archmage, necromancer)
        const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
        if (damageSpell) {
          recordProgress(botState, game.turn)
          return damageSpell
        }
      }
    }
  }

  // 2. Combat buffs only for bosses/uniques when approaching
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
  }

  // 3. Melee combat (fallback for ranged classes, primary for melee)
  if (adjacentMonster) {
    setKillGoal(botState, adjacentMonster, game.turn, 'Melee combat')
    recordProgress(botState, game.turn)
    return { type: 'attack', targetId: adjacentMonster.id }
  }

  // 4. Proactive healing when not in melee (if significantly hurt)
  if (hpRatio < 0.7) {
    const healSpell = getHealingSpellAction(game, config, localDanger, classProfile.healsPriority)
    if (healSpell) {
      recordProgress(botState, game.turn)
      return healSpell
    }

    // Only use consumables if no spell available and quite hurt
    if (hpRatio < 0.5) {
      const survivalAction = getSurvivalConsumableAction(
        game,
        config,
        dangerResult.dangers,
        botState,
        personality,
        classProfile.healsPriority
      )
      if (survivalAction) {
        recordProgress(botState, game.turn)
        return survivalAction
      }
    }
  }

  // 5. Summon minion if missing (tanking help)
  if (classShouldSummon(game.character.classId)) {
    const summonAction = getSummonSpellAction(game, config, visibleMonsters)
    if (summonAction) {
      recordProgress(botState, game.turn)
      return summonAction
    }
  }

  // 6. Damage/debuff spells for visible enemies
  if (visibleMonsters.length > 0) {
    // Casters should debuff (slow) tanky targets before blasting
    // Melee classes prefer damage over CC
    const isCaster = ['mage', 'archmage', 'necromancer'].includes(game.character.classId)
    if (isCaster) {
      const debuffSpell = getDebuffSpellAction(game, config, visibleMonsters)
      if (debuffSpell) {
        recordProgress(botState, game.turn)
        return debuffSpell
      }
    }

    const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpell) {
      recordProgress(botState, game.turn)
      return damageSpell
    }

    // Non-casters still get debuffs as fallback
    if (!isCaster) {
      const debuffSpell = getDebuffSpellAction(game, config, visibleMonsters)
      if (debuffSpell) {
        recordProgress(botState, game.turn)
        return debuffSpell
      }
    }
  }

  return null
}

/**
 * SAFE tier: No immediate threats
 *
 * Priority: summons > items > utility > movement/exploration
 */
function handleSafeTier(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult,
  personality: BotPersonality
): GameAction | null {
  const { config, effectiveConfig, visibleMonsters, classProfile } = context
  const pos = game.character.position
  const localDanger = getLocalDanger(dangerResult.dangers, pos)
  const dangerThreshold = getDangerThreshold(effectiveConfig.aggression, effectiveConfig.caution)
  const hpRatio = game.character.hp / game.character.maxHp

  // 0. Proactive summons (wolf for ranger, skeleton for necromancer)
  // These are high priority - we want minions out even when safe
  if (classShouldSummon(game.character.classId)) {
    const summonAction = getSummonSpellAction(game, config, visibleMonsters)
    if (summonAction) {
      recordProgress(botState, game.turn)
      return summonAction
    }
  }

  // 0b. Proactive Light Orb for mage/archmage - extended visibility helps exploration
  const lightOrbAction = getLightOrbSpellAction(game)
  if (lightOrbAction) {
    recordProgress(botState, game.turn)
    return lightOrbAction
  }

  // 1. Pick up items at current position
  const itemHere = game.items.find((item) => isSamePosition(item.position, game.character.position))
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
    const healSpell = getHealingSpellAction(game, config, localDanger, classProfile.healsPriority)
    if (healSpell) {
      recordProgress(botState, game.turn)
      return healSpell
    }

    // Only use potions if quite hurt and safe
    if (hpRatio < 0.4) {
      const survivalAction = getSurvivalConsumableAction(
        game,
        config,
        dangerResult.dangers,
        botState,
        personality,
        classProfile.healsPriority
      )
      if (survivalAction) {
        recordProgress(botState, game.turn)
        return survivalAction
      }
    }
  }

  // 4. Proactive repositioning for casters only (no bow)
  // Bow users (rangers) should shoot at dist 2, not kite - kiting causes oscillation
  // Casters benefit from distance to cast multiple spells before melee
  if (classProfile.prefersRanged && !hasRangedWeapon(game) && visibleMonsters.length > 0) {
    const nearest = findClosestMonster(visibleMonsters, pos)
    if (nearest) {
      const dist = nearest.distance
      // Only reposition when at distance 2 AND monster is awake (actively pursuing)
      // Distance 3+ is fine for casting - no need to create oscillation
      if (dist === 2 && nearest.monster.isAwake) {
        const kiteDir = findKitePosition(game, nearest.monster, classProfile)
        if (kiteDir) {
          recordProgress(botState, game.turn)
          return { type: 'move', direction: kiteDir }
        }
      }
    }
  }

  // 5. Pre-combat buffs only for bosses/uniques
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

    // Casters should debuff (slow) tanky targets before blasting
    const isCaster = ['mage', 'archmage', 'necromancer'].includes(game.character.classId)
    if (isCaster) {
      const debuffSpell = getDebuffSpellAction(game, config, visibleMonsters)
      if (debuffSpell) {
        recordProgress(botState, game.turn)
        return debuffSpell
      }
    }

    // Engage distant enemies with spells
    const damageSpell = getDamageSpellAction(game, config, visibleMonsters)
    if (damageSpell) {
      recordProgress(botState, game.turn)
      return damageSpell
    }

    // Ranged weapon attacks for ranged classes (rangers, etc.)
    if (classProfile.prefersRanged && hasRangedWeapon(game)) {
      const rangedTarget = findBestRangedTarget(game, visibleMonsters)
      if (rangedTarget && canRangedAttack(game.character, rangedTarget.position)) {
        recordProgress(botState, game.turn)
        return { type: 'ranged_attack', targetId: rangedTarget.id }
      }
    }
  }

  // 5. Utility consumables (enchants, mapping)
  if (localDanger < dangerThreshold) {
    const utilityAction = getUtilityConsumableAction(
      game,
      config,
      dangerResult.dangers,
      personality
    )
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
    const stuckAction = profile('fallback.stuckRecovery', () =>
      handleStuckRecovery(game, context, botState)
    )
    if (stuckAction) return stuckAction
  }

  // Goal selection and movement
  return profile('fallback.goalMovement', () =>
    handleGoalMovement(game, context, botState, dangerResult)
  )
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

// ============================================================================
// FALLBACK MOVEMENT - QUERIES
// ============================================================================

/**
 * Check if bot has arrived at goal position.
 */
function isAtGoal(pos: { x: number; y: number }, goal: BotGoal): boolean {
  return goal.target !== null && isSamePosition(pos, goal.target)
}

/**
 * Check if EXPLORE goal should use sweep mode flow (casters re-exploring).
 */
function shouldUseSweepFlow(game: GameState, botState: BotState): boolean {
  return (
    botState.sweepMode &&
    SQUISHY_CLASSES.has(game.character.classId) &&
    game.character.level < CASTER_STAIR_SURF_MIN_LEVEL
  )
}

// ============================================================================
// FALLBACK MOVEMENT - FLOW COMPUTATION
// ============================================================================

/**
 * Compute flow map for goal-based movement.
 * Dispatches by goal type: EXPLORE (sweep vs frontier) vs single-target.
 * Returns null if no valid flow (e.g., no frontiers for exploration).
 */
function computeGoalFlow(
  game: GameState,
  botState: BotState,
  goal: BotGoal,
  avoidSet: Set<string>
): FlowMap | null {
  if (goal.type === 'EXPLORE') {
    return computeExploreGoalFlow(game, botState, goal, avoidSet)
  }
  return computeSingleTargetFlow(game, botState, goal, avoidSet)
}

/**
 * Compute flow for EXPLORE goals.
 * Both sweep mode and normal exploration use multi-target Dijkstra.
 * Sweep: all tiles explored but not seen this visit.
 * Normal: all unexplored frontier tiles.
 */
function computeExploreGoalFlow(
  game: GameState,
  botState: BotState,
  _goal: BotGoal,
  avoidSet: Set<string>
): FlowMap | null {
  // Sweep mode: multi-target Dijkstra to all sweep frontier tiles
  if (shouldUseSweepFlow(game, botState)) {
    const sweepFrontiers = getSweepFrontierPositions(game, botState)
    if (sweepFrontiers.length === 0) {
      // No sweep frontiers (first visit or sweep complete) - fall through to normal exploration
      // This handles fresh level visits where nothing is explored-but-not-seen yet
    } else {
      // Check sweep cache validity (invalidate when seenThisVisit changes)
      const seenCount = botState.seenThisVisit.size
      const cache = botState.cachedSweepFlow
      const cacheValid =
        cache &&
        cache.depth === game.character.depth &&
        cache.seenCount === seenCount &&
        game.turn - cache.computedAt < 5

      if (cacheValid) {
        // Also check if cached sweep flow is reachable
        const pos = game.character.position
        const cachedCost = getFlowCost(cache.costs, pos)
        if (cachedCost < MAX_FLOW_COST) {
          return cache.costs
        }
        // Cached sweep flow unreachable - need to recompute or fall through
      }

      // Compute fresh sweep flow
      const flowCosts = profile('flow.sweep', () =>
        computeExplorationFlow(game.currentLevel, sweepFrontiers, avoidSet)
      )

      // Check if sweep flow is reachable from bot's position
      // If not reachable, fall through to normal exploration
      // This handles the case where sweep frontiers are separated from bot by unexplored tiles
      const pos = game.character.position
      const sweepCost = getFlowCost(flowCosts, pos)
      if (sweepCost < MAX_FLOW_COST) {
        // Sweep flow is reachable - use it
        botState.cachedSweepFlow = {
          costs: flowCosts,
          seenCount,
          computedAt: game.turn,
          depth: game.character.depth,
        }
        botState.cachedFlow = null // Don't use single-target cache for sweep
        return flowCosts
      }
      // Sweep flow unreachable - fall through to normal exploration
      // This is common when bot has explored a corridor and sweep frontiers are elsewhere
    }
  }

  // Normal exploration: multi-target Dijkstra to all frontiers
  const frontiers = profile('getFrontierPositions', () => getFrontierPositions(game))
  if (frontiers.length === 0) {
    // No frontiers - exploration complete
    botState.currentGoal = null
    botState.goalTarget = null
    return null
  }

  // Check cache validity
  const exploredCount = countExploredTiles(game.currentLevel)
  const cache = botState.cachedExplorationFlow
  const cacheValid =
    cache &&
    cache.depth === game.character.depth &&
    cache.exploredCount === exploredCount &&
    game.turn - cache.computedAt < 5

  if (cacheValid) {
    return cache.costs
  }

  // Compute fresh exploration flow
  const flowCosts = profile('flow.exploration', () =>
    computeExplorationFlow(game.currentLevel, frontiers, avoidSet)
  )
  botState.cachedExplorationFlow = {
    costs: flowCosts,
    frontierCount: frontiers.length,
    exploredCount,
    computedAt: game.turn,
    depth: game.character.depth,
  }
  botState.cachedFlow = null // Don't use single-target cache for EXPLORE
  return flowCosts
}

/**
 * Compute flow for single-target goals (KILL, DESCEND, TAKE, etc.).
 * Uses caching to avoid redundant computation.
 */
function computeSingleTargetFlow(
  game: GameState,
  botState: BotState,
  goal: BotGoal,
  avoidSet: Set<string>
): FlowMap {
  const needsRecompute = !isFlowValid(botState.cachedFlow, goal.target, game.turn)
  if (!needsRecompute && botState.cachedFlow?.costs) {
    return botState.cachedFlow.costs
  }

  const flowCosts = profile('flow.singleTarget', () =>
    computeFlow(game.currentLevel, goal.target!, avoidSet)
  )
  botState.cachedFlow = createFlowResult(goal.target!, flowCosts, game.turn)
  return flowCosts
}

/** Max path length to bullrush through danger for cautious DESCEND */
const CAUTIOUS_BULLRUSH_THRESHOLD = 6

/**
 * Ensure goal is reachable, trying without avoidance if blocked.
 * Returns updated flow map or null if truly unreachable.
 *
 * For cautious personalities with DESCEND blocked by danger:
 * - If path is short (<= CAUTIOUS_BULLRUSH_THRESHOLD), allow bullrush
 * - If path is long, set dangerBlockedDescent flag (triggers retreat)
 */
function ensureFlowReachable(
  game: GameState,
  botState: BotState,
  goal: BotGoal,
  flowCosts: FlowMap,
  avoidSet: Set<string>,
  caution: number
): FlowMap | null {
  const pos = game.character.position
  const currentCost = getFlowCost(flowCosts, pos)

  // Already reachable
  if (currentCost < MAX_FLOW_COST) {
    return flowCosts
  }

  // No avoidance to remove - truly unreachable
  if (avoidSet.size === 0) {
    clearUnreachableGoal(botState)
    return null
  }

  // Try without avoidance first to check path length
  let fallbackFlow: FlowMap
  if (goal.type === 'EXPLORE') {
    const frontiers = getFrontierPositions(game)
    fallbackFlow =
      frontiers.length > 0 ? computeExplorationFlow(game.currentLevel, frontiers) : new Map()
  } else {
    fallbackFlow = computeFlow(game.currentLevel, goal.target!)
    botState.cachedFlow = createFlowResult(goal.target!, fallbackFlow, game.turn)
  }

  const fallbackCost = getFlowCost(fallbackFlow, pos)
  if (fallbackCost >= MAX_FLOW_COST) {
    clearUnreachableGoal(botState)
    return null
  }

  // Cautious DESCEND blocked by danger: retreat if path is long, bullrush if short
  // Short path = close to stairs, worth pushing through
  // Long path = far from stairs, retreat to safer depth
  if (goal.type === 'DESCEND' && caution >= 50 && game.character.depth > 1) {
    if (fallbackCost > CAUTIOUS_BULLRUSH_THRESHOLD) {
      botState.dangerBlockedDescent = true
      clearUnreachableGoal(botState)
      return null
    }
    // Short path - allow bullrush through danger
  }

  return fallbackFlow
}

/**
 * Clear goal state when goal is unreachable.
 */
function clearUnreachableGoal(botState: BotState): void {
  botState.currentGoal = null
  botState.goalTarget = null
  botState.cachedFlow = null
}

// ============================================================================
// FALLBACK MOVEMENT - ACTION GETTERS
// ============================================================================

/**
 * Get action when bot has arrived at goal position.
 * Returns null if not at goal.
 */
function getGoalArrivalAction(
  game: GameState,
  botState: BotState,
  goal: BotGoal,
  config: PersonalityConfig
): GameAction | null {
  if (!isAtGoal(game.character.position, goal)) {
    return null
  }

  recordProgress(botState, game.turn)
  updateTownState(botState, goal, game)
  return profile('fallback.executeGoal', () => executeGoalAction(goal, game, botState, config))
}

/**
 * Get tactical action for approaching KILL target.
 * Handles ranged attacks, kiting, and pre-combat buffs.
 * Returns null to fall through to normal movement.
 */
function getKillApproachAction(
  goal: BotGoal,
  game: GameState,
  context: BotContext,
  dangerResult: DangerResult
): GameAction | null {
  if (goal.type !== 'KILL' || !goal.targetId) {
    return null
  }

  const { classProfile, config, visibleMonsters, botState } = context
  const pos = game.character.position
  const targetMonster = game.monsters.find((m) => m.id === goal.targetId && m.hp > 0)

  if (!targetMonster) return null

  // Ranged class tactics
  if (classProfile.prefersRanged && hasRangedWeapon(game)) {
    const dx = Math.abs(targetMonster.position.x - pos.x)
    const dy = Math.abs(targetMonster.position.y - pos.y)
    const distance = Math.max(dx, dy)
    const bowRange = getBowRange(game.character)

    // At shooting range - ranged attack
    if (distance >= 2 && distance <= bowRange) {
      if (canRangedAttack(game.character, targetMonster.position)) {
        recordProgress(botState, game.turn)
        return { type: 'ranged_attack', targetId: targetMonster.id }
      }
    }

    // Adjacent - try to kite away
    if (shouldAvoidMelee(classProfile, distance)) {
      const kiteDir = findKitePosition(game, targetMonster, classProfile)
      if (kiteDir) {
        recordProgress(botState, game.turn)
        return { type: 'move', direction: kiteDir }
      }
    }
  }

  // Pre-combat buffs for dangerous targets
  const threat = getMonsterThreat(targetMonster, game.character)
  const BUFF_THREAT_THRESHOLD = 100
  const isUnique = targetMonster.template.flags.includes('UNIQUE')
  const shouldBuffTarget = threat >= BUFF_THREAT_THRESHOLD || isUnique

  if (shouldBuffTarget) {
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
  }

  return null
}

// ============================================================================
// FALLBACK MOVEMENT - ORCHESTRATION
// ============================================================================

function handleGoalMovement(
  game: GameState,
  context: BotContext,
  botState: BotState,
  dangerResult: DangerResult
): GameAction {
  const { effectiveConfig } = context
  const pos = game.character.position
  const dangerThreshold = getDangerThreshold(effectiveConfig.aggression, effectiveConfig.caution)

  // 1. Select goal
  const goal = profile('selectGoal', () =>
    selectGoal(context, botState, dangerResult.dangers, dangerThreshold)
  )
  if (!goal?.target) {
    return { type: 'wait' }
  }
  setGoal(botState, goal)

  // 2. At goal? Execute
  const arrivalAction = getGoalArrivalAction(game, botState, goal, effectiveConfig)
  if (arrivalAction) return arrivalAction

  // 3. Build avoidance (skip for FLEE)
  const avoidSet =
    goal.type === 'FLEE'
      ? new Set<string>()
      : profile('fallback.buildAvoidSet', () =>
          buildAvoidSet(dangerResult.dangers, dangerThreshold, game.character)
        )

  // 4. Compute flow
  const flowCosts = computeGoalFlow(game, botState, goal, avoidSet)
  if (!flowCosts) {
    return { type: 'wait' }
  }

  // 5. Ensure reachable
  const reachableFlow = ensureFlowReachable(
    game,
    botState,
    goal,
    flowCosts,
    avoidSet,
    effectiveConfig.caution
  )
  if (!reachableFlow) {
    return { type: 'wait' }
  }

  // 6. KILL approach tactics (ranged/kite/buff)
  const killAction = getKillApproachAction(goal, game, context, dangerResult)
  if (killAction) return killAction

  // 7. Step toward goal
  const direction = profile('fallback.selectStep', () => selectStep(game, botState, reachableFlow))
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

function executeGoalAction(
  goal: BotGoal,
  game: GameState,
  botState: BotState,
  config: PersonalityConfig
): GameAction {
  switch (goal.type) {
    case 'DESCEND':
      // Goal system already verified readiness during goal selection
      // Don't re-check here - creates loops when goal eval uses different caution
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
        if (monster) {
          // For bow users, use ranged attack
          if (canRangedAttack(game.character, monster.position)) {
            return { type: 'ranged_attack', targetId: monster.id }
          }
          // For casters without bow, cast damage spell
          const damageSpell = getDamageSpellAction(game, config, [monster])
          if (damageSpell) {
            return damageSpell
          }
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

    case 'ASCEND_TO_FARM':
      return { type: 'ascend' }

    case 'TOWN_TRIP':
      // Use the town portal scroll (stored in targetId)
      if (goal.targetId) {
        return { type: 'use', itemId: goal.targetId }
      }
      return { type: 'wait' }

    case 'USE_ALTAR':
      return { type: 'use_altar' }

    case 'VISIT_MERCHANT':
      // Trade with dungeon merchant (same as town merchants)
      botSellItems(game)
      botBuySupplies(game)
      // Mark merchant as visited so we don't re-target it
      if (goal.targetId) {
        botState.visitedDungeonMerchants.add(goal.targetId)
      }
      return { type: 'wait' }

    case 'HUNT_UNIQUE':
      // Reached unique position - wait for tier system to handle adjacent combat
      // (Monster may have moved; tier handlers will engage when adjacent)
      return { type: 'wait' }

    case 'FARM':
      // Reached farm target - clear goal to immediately re-evaluate
      // Tether sweep targets are just positions to reveal FOV, no need to wait
      // If there's a monster/item, tier system will handle on next tick
      clearGoal(botState)
      return { type: 'wait' }

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

// ============================================================================
// HP TRACKING (DOT DETECTION)
// ============================================================================

/**
 * Track HP changes to detect DOT and invisible damage
 */
function updateHPTracking(game: GameState, botState: BotState): void {
  const currentHp = game.character.hp

  // Calculate rate from previous turn
  if (botState.previousHp > 0) {
    botState.hpRate = currentHp - botState.previousHp
  }

  // Update history (keep last 5 turns)
  botState.hpHistory.push(currentHp)
  if (botState.hpHistory.length > 5) {
    botState.hpHistory.shift()
  }

  botState.previousHp = currentHp
}
