/**
 * Combat Action Handlers for Borglike
 *
 * Handles player attack actions (melee and ranged).
 */

import type { GameState, ActionResult } from '../types'
import {
  attack,
  applyDamage,
  formatAttackMessageFromEntities,
  rangedAttack,
  canRangedAttack,
  formatRangedAttackMessage,
} from '../combat'
import { gainXP } from '../character'
import { DEFAULT_BONUSES, applyXPBonus } from '../upgrade-effects'
import { awardMonsterGold } from '../features'
import { addMessage, BASE_ENERGY_COST } from './helpers'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Victory boss name (used for win condition check) */
const VICTORY_BOSS_NAME = 'Morgoth, Lord of Darkness'

// ============================================================================
// MELEE COMBAT
// ============================================================================

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
      handleMonsterKill(game, monster)
    }
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

// ============================================================================
// RANGED COMBAT
// ============================================================================

/**
 * Handle ranged attack action
 *
 * Find monster by ID, validate range, resolve ranged combat, apply damage, award XP
 */
export function handleRangedAttack(game: GameState, targetId: string): ActionResult {
  const monster = game.monsters.find((m) => m.id === targetId)

  if (!monster) {
    return { success: false, message: 'No target found.', energyCost: 0 }
  }

  // Check if we can perform ranged attack
  if (!canRangedAttack(game.character, monster.position)) {
    // Check specific failure reasons
    const bow = game.character.equipment.bow
    if (!bow) {
      return { success: false, message: 'You have no bow equipped.', energyCost: 0 }
    }

    const dx = Math.abs(monster.position.x - game.character.position.x)
    const dy = Math.abs(monster.position.y - game.character.position.y)
    const distance = Math.max(dx, dy)

    if (distance < 2) {
      return {
        success: false,
        message: 'Target is too close for ranged attack.',
        energyCost: 0,
      }
    }

    const range = bow.template.range ?? 8
    if (distance > range) {
      return { success: false, message: 'Target is out of range.', energyCost: 0 }
    }

    return { success: false, message: 'Cannot perform ranged attack.', energyCost: 0 }
  }

  // Calculate distance
  const dx = Math.abs(monster.position.x - game.character.position.x)
  const dy = Math.abs(monster.position.y - game.character.position.y)
  const distance = Math.max(dx, dy)

  // Resolve ranged attack
  const attackResult = rangedAttack(game.character, monster, distance)
  const message = formatRangedAttackMessage(`the ${monster.template.name}`, attackResult)
  addMessage(game, message, 'combat')

  if (attackResult.hit) {
    // Apply damage to monster
    applyDamage(monster, attackResult.damage)
    game.stats.damageDealt += attackResult.damage

    if (attackResult.killed) {
      handleMonsterKill(game, monster)
    }
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Handle monster death - award XP, gold, check victory
 */
function handleMonsterKill(
  game: GameState,
  monster: { id: string; template: { name: string; experience: number; flags: string[] } }
): void {
  // Remove monster from game
  const monsterIndex = game.monsters.findIndex((m) => m.id === monster.id)
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
  awardMonsterGold(game, monster.template as any)

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
