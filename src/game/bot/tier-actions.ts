/**
 * Urgency-Gated Tier Actions
 *
 * Decision trees for each danger tier. Each tier has different priority orderings
 * based on immediate threat level (Angband borg inspired):
 *
 * - CRITICAL: escape > heal > desperate attack
 * - DANGER:   heal > attack > escape
 * - CAUTION:  attack > proactive heal
 * - SAFE:     normal flow (combat > items > movement)
 */

import type { GameState, GameAction, BotPersonality } from '../types'
import { isBossOrUnique } from '../types'
import { canRangedAttack } from '../combat'

import type { BotState, BotContext, DangerResult, DangerTier } from './types'
import { getEffectiveCapabilities } from './types'
import { recordProgress, setGoal, resetAfterTeleport } from './state'
import { isSamePosition } from './movement'
import {
  getLocalDanger,
  getDangerThreshold,
  getImmediateDanger,
  getImmediateDangerTier,
} from './danger'
import {
  findAdjacentMonster,
  hasRangedWeapon,
  findBestRangedTarget,
  findKitePosition,
  countAdjacentMonsters,
} from './combat'
import { findEquipmentUpgrades, isTeleportAction } from './items'
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
  getSmartDebuffAction,
  getSummonSpellAction,
  getRootShotAction,
  classShouldSummon,
  getLightOrbSpellAction,
  getDimensionDoorKiteAction,
} from './spells'

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Calculate immediate danger tier from game state.
 * Used by tick.ts to determine which tier handler to invoke.
 */
export function calculateImmediateTier(game: GameState): DangerTier {
  const immediateDanger = getImmediateDanger(game)
  const hasAdjacentMonster = findAdjacentMonster(game) !== null
  return getImmediateDangerTier(
    immediateDanger,
    game.character.hp,
    game.character.maxHp,
    hasAdjacentMonster
  )
}

/**
 * Select action based on immediate danger tier.
 * Dispatches to the appropriate tier handler.
 */
export function selectActionByTier(
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

// ============================================================================
// TIER HANDLERS
// ============================================================================

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
    resetAfterTeleport(botState)
    recordProgress(botState, game.turn)
    return escapeSpell
  }

  // 2. Try escape consumable (teleport scroll, phase door)
  const effective = getEffectiveCapabilities(context)
  const survivalAction = getSurvivalConsumableAction(
    game,
    config,
    dangerResult.dangers,
    botState,
    personality,
    classProfile.healsPriority,
    effective.town
  )
  if (survivalAction) {
    if (isTeleportAction(game.character, survivalAction)) {
      resetAfterTeleport(botState)
    }
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

      // Casters: Try Dimension Door for tactical kiting (targeted escape + continue casting)
      // DD is preferred over Phase Door because it maintains combat engagement
      if (!hasRangedWeapon(game)) {
        const ddAction = getDimensionDoorKiteAction(game, visibleMonsters)
        if (ddAction) {
          resetAfterTeleport(botState)
          recordProgress(botState, game.turn)
          return ddAction
        }
      }

      // Mage/Archmage: Try Phase Door at DANGER tier (random tactical escape)
      // Fallback when DD not available
      // Only when actually threatened: HP < 50% OR surrounded (2+ adjacent)
      // Avoids disrupting exploration when bot could just fight
      // EXCEPTION: Skip phase door when close to stairs with DESCEND goal - push through
      // instead of repeatedly teleporting away and restarting the approach
      const classId = game.character.classId
      const hpRatio = game.character.hp / game.character.maxHp
      const adjacentCount = countAdjacentMonsters(game, pos)
      const goal = botState.currentGoal
      const closeToStairs =
        goal?.type === 'DESCEND' &&
        goal.target &&
        Math.max(Math.abs(pos.x - goal.target.x), Math.abs(pos.y - goal.target.y)) <= 15
      if (classId === 'mage' || classId === 'archmage') {
        if ((hpRatio < 0.5 || adjacentCount >= 2) && !closeToStairs) {
          const phaseDoorAction = getPhaseDoorSpellAction(game)
          if (phaseDoorAction) {
            resetAfterTeleport(botState)
            recordProgress(botState, game.turn)
            return phaseDoorAction
          }
        }
      }

      // Casters: Smart debuff (slow fast+dangerous monsters) - defense before damage
      // Only slow if: fast (speed > 110) AND high damage (4 hits to kill) AND not easily killed
      if (!hasRangedWeapon(game)) {
        const smartDebuff = getSmartDebuffAction(game, visibleMonsters)
        if (smartDebuff) {
          recordProgress(botState, game.turn)
          return smartDebuff
        }
      }

      // 2. Kite away if adjacent (physical movement works for all ranged classes)
      const kiteDir = findKitePosition(game, adjacentMonster, classProfile)
      if (kiteDir) {
        recordProgress(botState, game.turn)
        return { type: 'move', direction: kiteDir }
      }

      // 2b. Can't kite - casters should cast damage spell point-blank, not melee
      if (!hasRangedWeapon(game)) {
        const damageSpell = getDamageSpellAction(game, config, [adjacentMonster])
        if (damageSpell) {
          recordProgress(botState, game.turn)
          return damageSpell
        }
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
  const effective = getEffectiveCapabilities(context)
  const survivalAction = getSurvivalConsumableAction(
    game,
    config,
    dangerResult.dangers,
    botState,
    personality,
    classProfile.healsPriority,
    effective.town
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
    resetAfterTeleport(botState)
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
  _personality: BotPersonality
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
      const effective = getEffectiveCapabilities(context)
      const survivalAction = getSurvivalConsumableAction(
        game,
        config,
        dangerResult.dangers,
        botState,
        _personality,
        classProfile.healsPriority,
        effective.town
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
      const effective = getEffectiveCapabilities(context)
      const survivalAction = getSurvivalConsumableAction(
        game,
        config,
        dangerResult.dangers,
        botState,
        personality,
        classProfile.healsPriority,
        effective.town
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
// HELPERS
// ============================================================================

/**
 * Set a KILL goal for an adjacent monster.
 * Ensures combat actions are tracked in the goal system.
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
