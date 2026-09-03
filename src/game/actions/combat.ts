/**
 * Combat Action Handlers for Borglike
 *
 * Handles player attack actions (melee and ranged).
 */

import type { GameState, ActionResult, Monster } from '../types'
import {
  meleeAttack,
  attack,
  applyDamage,
  formatMultiAttackMessage,
  multiRangedAttack,
  canRangedAttack,
  calculateLifesteal,
} from '../combat'
import { gainXP, calculateAttackCount } from '../character'
import { getRaceById } from '../data/races'
import { getClassById } from '../data/classes'
import { DEFAULT_BONUSES, applyXPBonus } from '../upgrade-effects'
import { awardMonsterGold } from '../features'
import { addTaggedMessage, BASE_ENERGY_COST } from './helpers'
import { getKnowledgeBonuses } from '../knowledge-effects'
import { VICTORY_BOSS_NAME } from '../data/index'
import { handleRiftKillProgress, handleAffixDeath, applyThornsReflect } from '../rift/director'

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

  // Melee staple (cleave et al): swings spread across the arc/surround when
  // 2+ targets share it. Single occupants fall through to the classic path.
  const splash = getStapleSplash(game, monster)
  if (splash) {
    return resolveStapleAttack(game, splash)
  }

  // Compute knowledge bonuses from bestiary (or override for testing)
  const knowledgeBonuses = getKnowledgeBonuses(
    monster.template.baseName ?? monster.template.name,
    game.bestiary,
    game.balance.bestiaryBonusPercent,
    game.upgradeBonuses?.bestiaryCapPercent
  )

  // Resolve multi-attack with knowledge bonuses and armor penetration
  // Number of attacks scales with level, STR, and class cap
  const attackResult = meleeAttack(
    game.character,
    monster,
    knowledgeBonuses,
    game.balance.armorPenetration,
    game.upgradeBonuses?.armorPenPercent ?? 0
  )

  // Adrenaline Rush: +damage% when below 20% HP
  const adrenalinePercent = game.boosterBonuses?.adrenalineRushPercent ?? 0
  if (adrenalinePercent > 0 && game.character.hp < game.character.maxHp * 0.2) {
    attackResult.totalDamage = Math.floor(attackResult.totalDamage * (1 + adrenalinePercent / 100))
  }

  const message = formatMultiAttackMessage(`the ${monster.template.name}`, attackResult)
  addTaggedMessage(game, message, 'combat', { tags: ['combat.hit'], importance: 2 })

  // Track melee combat accuracy
  game.stats.meleeHits += attackResult.hits
  game.stats.meleeMisses += attackResult.attackCount - attackResult.hits
  game.stats.criticalHits += attackResult.criticals

  if (attackResult.hits > 0) {
    // Apply total damage to monster
    applyDamage(monster, attackResult.totalDamage)
    game.stats.damageDealt += attackResult.totalDamage
    game.stats.damageBySource.melee += attackResult.totalDamage

    // Thorns retaliation (melee only — spells, arrows, and minions bypass)
    if (game.ruleset.mode === 'rift') {
      applyThornsReflect(game, monster, attackResult.totalDamage)
    }

    // SNEAK ATTACK: Consume buff and show message
    const sneakAttackIndex = game.character.statusEffects.findIndex(
      (e) => e.type === 'sneak_attack'
    )
    if (sneakAttackIndex >= 0) {
      game.character.statusEffects.splice(sneakAttackIndex, 1)
      addTaggedMessage(game, 'Sneak Attack!', 'good', { tags: ['combat.hit'], importance: 2 })
    }

    // COMBAT_REGEN: Lifesteal healing (Blackguard)
    const lifesteal = calculateLifesteal(game.character, attackResult.totalDamage)
    if (lifesteal > 0) {
      game.character.hp = Math.min(game.character.hp + lifesteal, game.character.maxHp)
      game.stats.healingBySource.lifesteal += lifesteal
      addTaggedMessage(game, `You drain ${lifesteal} HP!`, 'good', {
        tags: ['combat.hit'],
        importance: 2,
      })
    }

    if (attackResult.killed) {
      handleMonsterKill(game, monster)
    }
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}

// ============================================================================
// MELEE STAPLES (cleave et al: swing pool shared across neighbors)
// ============================================================================

/** Staple splash targets: primary first, then neighbors sharing the pattern. */
interface StapleSplash {
  stapleId: string
  targets: Monster[]
}

/**
 * Find staple splash targets for an attack: class kit pattern around the
 * primary (arc facing it, or full surround), capped at the staple count.
 * Returns null for single occupants (classic path handles those identically).
 */
function getStapleSplash(game: GameState, primary: Monster): StapleSplash | null {
  const staple = getClassById(game.character.classId)?.meleeStaple
  if (!staple) return null

  const pos = game.character.position
  const dx = Math.sign(primary.position.x - pos.x)
  const dy = Math.sign(primary.position.y - pos.y)
  if (Math.max(Math.abs(primary.position.x - pos.x), Math.abs(primary.position.y - pos.y)) !== 1) {
    return null // primary must be adjacent (bump range)
  }

  const neighbors = game.monsters.filter((m) => {
    if (m.hp <= 0 || m.id === primary.id) return false
    const ox = m.position.x - pos.x
    const oy = m.position.y - pos.y
    if (Math.max(Math.abs(ox), Math.abs(oy)) !== 1) return false
    if (staple.pattern === 'surround') return true
    return ox * dx + oy * dy > 0
  })

  const targets = [primary, ...neighbors].slice(0, staple.targets)
  if (targets.length < 2) return null
  return { stapleId: staple.id, targets }
}

/**
 * Resolve a staple attack: the full multi-attack swing pool dealt round-robin
 * across the splash targets. Same total output as single-target, spread out.
 * (No sneak-attack or lifesteal handling — no stapled class has those yet.)
 */
function resolveStapleAttack(game: GameState, splash: StapleSplash): ActionResult {
  // Adrenaline Rush applies per swing like single attacks
  const adrenalinePercent = game.boosterBonuses?.adrenalineRushPercent ?? 0
  const adrenaline =
    adrenalinePercent > 0 && game.character.hp < game.character.maxHp * 0.2
      ? 1 + adrenalinePercent / 100
      : 1

  const swings = calculateAttackCount(game.character)
  let hits = 0
  let totalDamage = 0
  let kills = 0
  const slain: string[] = []

  for (let s = 0; s < swings; s++) {
    const living = splash.targets.filter((m) => m.hp > 0)
    if (living.length === 0) break
    const monster = living[s % living.length]!

    const knowledgeBonuses = getKnowledgeBonuses(
      monster.template.baseName ?? monster.template.name,
      game.bestiary,
      game.balance.bestiaryBonusPercent,
      game.upgradeBonuses?.bestiaryCapPercent
    )
    const result = attack(
      game.character,
      monster,
      knowledgeBonuses,
      game.balance.armorPenetration,
      game.upgradeBonuses?.armorPenPercent ?? 0
    )
    game.stats.meleeHits += result.hit ? 1 : 0
    game.stats.meleeMisses += result.hit ? 0 : 1
    if (result.critical) game.stats.criticalHits += 1
    if (!result.hit) continue

    const damage = Math.floor(result.damage * adrenaline)
    applyDamage(monster, damage)
    game.stats.damageDealt += damage
    game.stats.damageBySource.melee += damage
    hits++
    totalDamage += damage

    // Thorns retaliation (melee by design)
    if (game.ruleset.mode === 'rift') {
      applyThornsReflect(game, monster, damage)
    }

    if (monster.hp <= 0) {
      handleMonsterKill(game, monster)
      kills++
      slain.push(monster.template.name)
    }
  }

  const verb = splash.stapleId === 'cleave' ? 'cleave' : splash.stapleId
  const message =
    kills > 0
      ? `You ${verb} through ${splash.targets.length} foes for ${totalDamage} damage, slaying ${slain.join(', ')}!`
      : hits > 0
        ? `You ${verb} ${splash.targets.length} foes for ${totalDamage} damage!`
        : `You swing wide and miss everything.`
  addTaggedMessage(game, message, 'combat', { tags: ['combat.hit'], importance: 2 })

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

  // Compute knowledge bonuses from bestiary (or override for testing)
  const knowledgeBonuses = getKnowledgeBonuses(
    monster.template.baseName ?? monster.template.name,
    game.bestiary,
    game.balance.bestiaryBonusPercent,
    game.upgradeBonuses?.bestiaryCapPercent
  )

  // Resolve multi-shot ranged attack with knowledge bonuses and armor penetration
  // FAST_SHOT: Rangers get +1 shot per 3 levels
  const attackResult = multiRangedAttack(
    game.character,
    monster,
    distance,
    knowledgeBonuses,
    game.balance.armorPenetration,
    game.upgradeBonuses?.armorPenPercent ?? 0
  )

  // Adrenaline Rush: +damage% when below 20% HP
  const adrenalinePercent = game.boosterBonuses?.adrenalineRushPercent ?? 0
  if (adrenalinePercent > 0 && game.character.hp < game.character.maxHp * 0.2) {
    attackResult.totalDamage = Math.floor(attackResult.totalDamage * (1 + adrenalinePercent / 100))
  }

  const message = formatMultiAttackMessage(`the ${monster.template.name}`, attackResult, 'arrow')
  addTaggedMessage(game, message, 'combat', { tags: ['combat.hit'], importance: 2 })

  // Track ranged combat accuracy
  game.stats.rangedHits += attackResult.hits
  game.stats.rangedMisses += attackResult.attackCount - attackResult.hits
  game.stats.criticalHits += attackResult.criticals

  if (attackResult.hits > 0) {
    // Apply total damage to monster
    applyDamage(monster, attackResult.totalDamage)
    game.stats.damageDealt += attackResult.totalDamage
    game.stats.damageBySource.ranged += attackResult.totalDamage

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
 * Handle monster death - award XP, gold, check victory, track unique kills
 *
 * This is the single source of truth for monster kill handling.
 * All kill paths (melee, ranged, spells) should call this function.
 */
export function handleMonsterKill(game: GameState, monster: Monster): void {
  // Remove monster from game
  const monsterIndex = game.monsters.findIndex((m) => m.id === monster.id)
  if (monsterIndex >= 0) {
    game.monsters.splice(monsterIndex, 1)
  }

  // Track unique kills
  if (monster.template.flags.includes('UNIQUE')) {
    game.uniqueState.killed.add(monster.template.name)
  }

  // Rift tier progress (spawner count → boss → portal) + affix deaths.
  // Single dispatch point; the logic lives in the director.
  if (game.ruleset.mode === 'rift') {
    handleRiftKillProgress(game, monster)
    handleAffixDeath(game, monster)
  }

  // Award XP with upgrade bonus and balance rate
  const bonuses = game.upgradeBonuses ?? DEFAULT_BONUSES
  const baseXP = monster.template.experience
  let upgradedXP = applyXPBonus(baseXP, bonuses)

  // RACIAL: XP bonuses from race abilities (ability-driven, not hardcoded to raceId)
  const race = getRaceById(game.character.raceId)
  const raceAbilityIds = race?.abilities.map((a) => a.id) ?? []
  if (raceAbilityIds.includes('versatile')) {
    upgradedXP = Math.floor(upgradedXP * 1.1) // +10% XP
  } else if (raceAbilityIds.includes('quick_learner')) {
    upgradedXP = Math.floor(upgradedXP * 1.05) // +5% XP
  }

  const xpToAward = Math.floor((upgradedXP * game.balance.xpRatePercent) / 100)
  const { leveledUp, newLevel } = gainXP(game.character, xpToAward, game.balance.levelupHpPercent)
  game.stats.kills++

  // Track monster kill by name for bestiary (affixed rares key to their base)
  const monsterName = monster.template.baseName ?? monster.template.name
  game.stats.monsterKills[monsterName] = (game.stats.monsterKills[monsterName] || 0) + 1

  // Award gold from monster
  awardMonsterGold(game, monster.template)

  if (leveledUp && newLevel) {
    addTaggedMessage(game, `You have reached level ${newLevel}!`, 'good', {
      tags: ['progress'],
      importance: 5,
    })
  }

  // Check for victory (killed Morgoth)
  if (monster.template.flags.includes('UNIQUE') && monster.template.name === VICTORY_BOSS_NAME) {
    game.isVictory = true
  }
}
