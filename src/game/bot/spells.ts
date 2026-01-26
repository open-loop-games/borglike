/**
 * Bot Spell Decision Making
 *
 * Handles spell casting decisions for magic-using classes.
 * Determines when to cast healing, damage, buff, and escape spells.
 */

import type { GameState, GameAction, Monster, Character } from '../types'
import { MINION_TEMPLATES } from '../types'
import type { PersonalityConfig, DangerMap } from './types'
import type { SpellTemplate } from '../data/spells'
import { getAvailableSpells, getNearestVisibleMonster, selectAOETargets } from '../spell-resolution'
import { getLocalDanger } from './danger'
import { countAdjacentMonsters } from './combat'
import { hasStatusEffect } from './items'
import { hasAbility } from '../data/monsters'

// ============================================================================
// RACE RESTRICTIONS
// ============================================================================

/**
 * Check if character can cast spells
 * GOLEM RESTRICTION: Golems cannot cast spells
 */
function canCastSpells(character: Character): boolean {
  return character.raceId !== 'golem'
}

// ============================================================================
// HEALING SPELLS
// ============================================================================

/**
 * Check if we should cast a healing spell
 *
 * Higher priority than potions for casters (mana is renewable, potions aren't)
 * Uses Angband-style graduated thresholds based on danger level.
 *
 * @param game - Current game state
 * @param config - Personality configuration
 * @param danger - Local danger value (damage potential from nearby monsters)
 * @param healsPriority - If true, heal more aggressively (Priest, Paladin)
 * @returns GameAction to cast a heal spell, or null if no healing needed/available
 */
export function getHealingSpellAction(
  game: GameState,
  config: PersonalityConfig,
  danger: number = 0,
  healsPriority: boolean = false
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  const hpRatio = character.hp / character.maxHp
  const hpDown = character.maxHp - character.hp

  // Angband-style graduated thresholds based on danger
  if (!evaluateHealNeed(hpRatio, danger, character.hp, config, healsPriority)) {
    return null
  }

  // Get available heal spells
  const available = getAvailableSpells(character, game.turn)
  const healSpells = available.filter(
    (entry) =>
      entry.canCast && (entry.spell.effectType === 'heal' || entry.spell.effectType === 'lifedrain')
  )

  if (healSpells.length === 0) return null

  // Select appropriate heal based on wound size and danger
  const spell = selectHealSpell(healSpells, hpDown, danger)
  if (spell) {
    return { type: 'cast', spellId: spell.id }
  }

  return null
}

/**
 * Evaluate whether healing is needed based on Angband-style graduated thresholds.
 * Lower HP = always heal, higher HP = only heal if danger is high.
 *
 * Classes with healsPriority (Priest, Paladin) heal more aggressively since
 * they have renewable spell healing and should reserve potions.
 */
function evaluateHealNeed(
  hpRatio: number,
  danger: number,
  currentHp: number,
  _config: PersonalityConfig,
  healsPriority: boolean = false
): boolean {
  // Always heal if danger exceeds current HP (would die next hit)
  if (danger >= currentHp) return true

  if (healsPriority) {
    // Priests/Paladins heal more aggressively with spells (mana is renewable)
    // This keeps them at higher HP and reserves potions for emergencies
    if (hpRatio < 0.4) return true // Always heal below 40%
    if (hpRatio < 0.6) return danger > 10 // Very low danger threshold
    if (hpRatio < 0.75) return danger > 30 // Low danger threshold
    if (hpRatio < 0.85) return danger > 60 // Moderate danger threshold
  } else {
    // Standard thresholds (Angband-style)
    // Lower HP = always heal, higher HP = only if danger justifies it
    if (hpRatio < 0.25) return true // Always heal below 25%
    if (hpRatio < 0.4) return danger > 20 // Heal at 40% if any real danger
    if (hpRatio < 0.55) return danger > 50 // Heal at 55% if moderate danger
    if (hpRatio < 0.7) return danger > 100 // Heal at 70% if high danger
  }

  return false
}

/**
 * Select the appropriate healing spell based on wound size and danger.
 * Implements anti-rope-a-dope: don't waste small heals against big danger.
 */
function selectHealSpell(
  healSpells: Array<{ spell: SpellTemplate; canCast: boolean }>,
  hpDown: number,
  danger: number
): SpellTemplate | null {
  // Anti-rope-a-dope: filter out heals that are too small relative to danger
  // A heal must restore at least 1/3 of the danger to be worthwhile
  const validHeals = healSpells.filter((entry) => {
    const estimatedHeal = entry.spell.level * 5 + 10
    // If danger is low, any heal is fine
    if (danger < 30) return true
    // Otherwise, heal must be meaningful relative to danger
    return estimatedHeal > danger / 3
  })

  // If no heals pass the anti-rope-a-dope filter, use best available anyway
  // (better to heal a little than die)
  const candidates = validHeals.length > 0 ? validHeals : healSpells

  // Prefer pure heals over lifedrain when we need reliable healing
  const pureHeals = candidates.filter((entry) => entry.spell.effectType === 'heal')
  const sortedCandidates = pureHeals.length > 0 ? pureHeals : candidates

  // Sort by spell level (higher = stronger heal)
  // Prefer larger heals when more wounded
  sortedCandidates.sort((a, b) => b.spell.level - a.spell.level)

  // If wound is small, use smallest adequate heal to conserve mana
  if (hpDown < 30) {
    // Reverse to get smallest first
    const smallest = [...sortedCandidates].sort((a, b) => a.spell.level - b.spell.level)
    return smallest[0]?.spell ?? null
  }

  // For larger wounds, use biggest heal
  return sortedCandidates[0]?.spell ?? null
}

// ============================================================================
// DAMAGE SPELLS
// ============================================================================

/**
 * Check if we should cast a damage spell
 *
 * Considers:
 * - Mana efficiency (don't waste mana on weak enemies)
 * - AOE opportunities (multiple targets)
 * - Distance (prefer ranged spells when not adjacent)
 * - Monster threat level
 *
 * @returns GameAction to cast a damage spell, or null if melee is better
 */
export function getDamageSpellAction(
  game: GameState,
  config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  if (visibleMonsters.length === 0) {
    return null
  }

  // Get available damage spells
  const available = getAvailableSpells(character, game.turn)
  const damageSpells = available.filter(
    (entry) =>
      entry.canCast &&
      (entry.spell.effectType === 'damage' ||
        entry.spell.effectType === 'aoe_damage' ||
        entry.spell.effectType === 'lifedrain')
  )

  if (damageSpells.length === 0) {
    return null
  }

  // Check mana - don't cast if we're very low on mana
  const mpRatio = character.mp / character.maxMp
  if (mpRatio < 0.2 && !isInDanger(game, config)) {
    return null // Save mana for emergencies
  }

  // Find nearest monster
  const nearest = getNearestVisibleMonster(game)
  if (!nearest) return null

  const distToNearest =
    Math.abs(nearest.position.x - character.position.x) +
    Math.abs(nearest.position.y - character.position.y)

  // Check for AOE opportunities
  const aoeSpells = damageSpells.filter((entry) => entry.spell.effectType === 'aoe_damage')
  if (aoeSpells.length > 0 && visibleMonsters.length >= 2) {
    // Worth using AOE if 2+ targets
    const bestAoe = aoeSpells[0]
    if (bestAoe && bestAoe.spell.manaCost <= character.mp) {
      // Check if we can hit multiple targets
      const potentialTargets = selectAOETargets(game, bestAoe.spell.maxTargets ?? 3)
      if (potentialTargets.length >= 2) {
        return { type: 'cast', spellId: bestAoe.spell.id }
      }
    }
  }

  // Single target spell selection
  if (distToNearest > 1) {
    // Not adjacent - ranged spell is good
    // Prefer lifedrain if we're below full HP
    const hpRatio = character.hp / character.maxHp
    if (hpRatio < 0.8) {
      const lifedrain = damageSpells.find((entry) => entry.spell.effectType === 'lifedrain')
      if (lifedrain) {
        return { type: 'cast', spellId: lifedrain.spell.id, targetId: nearest.id }
      }
    }

    // Use most mana-efficient damage spell
    const sortedByEfficiency = damageSpells
      .filter((entry) => entry.spell.effectType !== 'aoe_damage')
      .sort((a, b) => {
        // Rough damage per mana estimate
        const aEff = (a.spell.level * 2) / a.spell.manaCost
        const bEff = (b.spell.level * 2) / b.spell.manaCost
        return bEff - aEff
      })

    if (sortedByEfficiency[0]) {
      return { type: 'cast', spellId: sortedByEfficiency[0].spell.id, targetId: nearest.id }
    }
  }

  // Adjacent - only cast if spell is worth it over melee
  // (e.g., lifedrain for sustain, or very high damage spell)
  if (distToNearest === 1) {
    const hpRatio = character.hp / character.maxHp

    // Lifedrain is always good when we need HP
    if (hpRatio < 0.7) {
      const lifedrain = damageSpells.find((entry) => entry.spell.effectType === 'lifedrain')
      if (lifedrain) {
        return { type: 'cast', spellId: lifedrain.spell.id, targetId: nearest.id }
      }
    }

    // High-level spells might outdamage melee
    const meleeDamage = character.combat.meleeDamage
    const highDamageSpell = damageSpells.find((entry) => {
      const estimatedDamage = entry.spell.level * 3 + 5
      return estimatedDamage > meleeDamage * 1.5 // 50% better than melee
    })

    if (highDamageSpell) {
      return { type: 'cast', spellId: highDamageSpell.spell.id, targetId: nearest.id }
    }
  }

  return null
}

// ============================================================================
// BUFF SPELLS
// ============================================================================

/**
 * Check if we should cast a buff spell
 *
 * Casts buffs when:
 * - Entering combat (enemies visible but not adjacent)
 * - Before descending to new level
 * - Buff has worn off
 *
 * @returns GameAction to cast a buff spell, or null
 */
export function getBuffSpellAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  // Get available buff spells
  const available = getAvailableSpells(character, game.turn)
  const buffSpells = available.filter((entry) => entry.canCast && entry.spell.effectType === 'buff')

  if (buffSpells.length === 0) return null

  // Don't buff if mana is very low (save for healing/escape)
  if (character.mp < character.maxMp * 0.3) return null

  // Check if we already have active buffs
  const existingBuffTypes = character.statusEffects.map((e) => e.type)

  // Consider casting if enemies are visible but not adjacent
  const adjacentCount = countAdjacentMonsters(game, character.position)
  if (adjacentCount > 0) {
    // In melee - only Dark Pact is worth casting (damage boost)
    const darkPact = buffSpells.find((entry) => entry.spell.id === 'dark_pact')
    if (darkPact && !hasStatusEffect(character, 'berserk') && character.hp > 20) {
      return { type: 'cast', spellId: 'dark_pact' }
    }
    return null
  }

  if (visibleMonsters.length > 0) {
    // Enemies nearby but not adjacent - good time for buffs

    // Mage Armor for mages (protection buff)
    const mageArmor = buffSpells.find((entry) => entry.spell.id === 'mage_armor')
    if (mageArmor && !existingBuffTypes.includes('protection')) {
      return { type: 'cast', spellId: 'mage_armor' }
    }

    // Bless for combat
    const bless = buffSpells.find((entry) => entry.spell.id === 'bless')
    if (bless && !existingBuffTypes.includes('blessing')) {
      return { type: 'cast', spellId: 'bless' }
    }

    // Sanctuary for tough fights (multiple enemies)
    if (visibleMonsters.length >= 2) {
      const sanctuary = buffSpells.find((entry) => entry.spell.id === 'sanctuary')
      if (sanctuary && !existingBuffTypes.includes('protection')) {
        return { type: 'cast', spellId: 'sanctuary' }
      }
    }

    // Resist elements (check if visible monsters use fire/cold)
    const hasElementalEnemy = visibleMonsters.some(
      (m) => hasAbility(m.template, 'FIRE') || hasAbility(m.template, 'COLD')
    )
    if (hasElementalEnemy) {
      const resistElements = buffSpells.find((entry) => entry.spell.id === 'resist_elements')
      if (
        resistElements &&
        !character.tempResistances.some((r) => r.type === 'FIRE' || r.type === 'COLD')
      ) {
        return { type: 'cast', spellId: 'resist_elements' }
      }
    }
  }

  return null
}

// ============================================================================
// ESCAPE/UTILITY SPELLS
// ============================================================================

/**
 * Check if we should cast an escape spell (teleport/phase door)
 *
 * Higher priority than scroll because spells are renewable
 *
 * @returns GameAction to cast an escape spell, or null
 */
export function getEscapeSpellAction(
  game: GameState,
  _config: PersonalityConfig,
  dangers: DangerMap
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  const hpRatio = character.hp / character.maxHp
  const pos = character.position

  // Check local danger
  const localDanger = getLocalDanger(dangers, pos)
  const adjacentCount = countAdjacentMonsters(game, pos)

  // Emergency teleport conditions:
  // - Very low HP + in danger
  // - Surrounded (3+ adjacent monsters)
  const isEmergency =
    (hpRatio < 0.2 && adjacentCount > 0) ||
    adjacentCount >= 3 ||
    (hpRatio < 0.3 && localDanger > 150)

  if (!isEmergency) return null

  // Get available teleport spells
  const available = getAvailableSpells(character, game.turn)
  const teleportSpells = available.filter(
    (entry) => entry.canCast && entry.spell.effectType === 'teleport'
  )

  if (teleportSpells.length === 0) return null

  // Prefer full teleport for emergencies, phase door for tactical repositioning
  if (hpRatio < 0.15 || adjacentCount >= 3) {
    // Full emergency - use best teleport
    const fullTeleport = teleportSpells.find((entry) => entry.spell.teleportRange === 0)
    if (fullTeleport) {
      return { type: 'cast', spellId: fullTeleport.spell.id }
    }
  }

  // Phase door for moderate emergencies
  const phaseDoor = teleportSpells.find((entry) => (entry.spell.teleportRange ?? 0) > 0)
  if (phaseDoor) {
    return { type: 'cast', spellId: phaseDoor.spell.id }
  }

  // Use any teleport
  if (teleportSpells[0]) {
    return { type: 'cast', spellId: teleportSpells[0].spell.id }
  }

  return null
}

/**
 * Get a teleport/phase door spell without emergency checks
 * Used for proactive escape when entering DANGER tier with adjacent enemies
 */
export function getTeleportSpellAction(game: GameState): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  const available = getAvailableSpells(character, game.turn)
  const teleportSpells = available.filter(
    (entry) => entry.canCast && entry.spell.effectType === 'teleport'
  )

  if (teleportSpells.length === 0) return null

  // Prefer phase door (shorter range) for tactical repositioning
  const phaseDoor = teleportSpells.find((entry) => (entry.spell.teleportRange ?? 0) > 0)
  if (phaseDoor) {
    return { type: 'cast', spellId: phaseDoor.spell.id }
  }

  // Fall back to full teleport
  if (teleportSpells[0]) {
    return { type: 'cast', spellId: teleportSpells[0].spell.id }
  }

  return null
}

/**
 * Get Phase Door spell only (no full teleport fallback)
 * Used for DANGER tier tactical escape - stays in same area, goals remain valid
 * Only mage/archmage have this spell (at L1)
 */
export function getPhaseDoorSpellAction(game: GameState): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  const available = getAvailableSpells(character, game.turn)

  // Find phase door specifically (teleportRange > 0 means short-range)
  const phaseDoor = available.find(
    (entry) =>
      entry.canCast && entry.spell.effectType === 'teleport' && (entry.spell.teleportRange ?? 0) > 0
  )

  if (phaseDoor) {
    return { type: 'cast', spellId: phaseDoor.spell.id }
  }

  return null
}

/**
 * Check if we should cast a debuff spell
 *
 * Useful for:
 * - Slowing dangerous enemies
 * - Weakening strong melee monsters
 *
 * @returns GameAction to cast a debuff, or null
 */
export function getDebuffSpellAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  if (visibleMonsters.length === 0) return null

  // Get available debuff spells
  const available = getAvailableSpells(character, game.turn)
  const debuffSpells = available.filter(
    (entry) => entry.canCast && entry.spell.effectType === 'debuff'
  )

  if (debuffSpells.length === 0) return null

  // Find strongest visible monster (by HP - we want to slow tanky targets)
  const sortedByHp = [...visibleMonsters].sort((a, b) => b.hp - a.hp)
  const strongestMonster = sortedByHp[0]

  if (!strongestMonster) return null

  // Check if monster is already slowed
  const isAlreadySlowed = strongestMonster.debuffs.some((d) => d.type === 'slow')

  // Slow any monster with significant HP (worth the mana investment)
  // Threshold: monster HP > 50% of character's max HP
  const isWorthSlowing = strongestMonster.hp > character.maxHp * 0.5
  const shouldSlow = !isAlreadySlowed && isWorthSlowing

  if (shouldSlow) {
    const slowSpell = debuffSpells.find((entry) => entry.spell.debuff?.type === 'slow')
    if (slowSpell) {
      return { type: 'cast', spellId: slowSpell.spell.id, targetId: strongestMonster.id }
    }
  }

  // Weaken as fallback (if slow not available or already slowed)
  if (isWorthSlowing) {
    const weakenSpell = debuffSpells.find((entry) => entry.spell.debuff?.type === 'weaken')
    if (weakenSpell) {
      return { type: 'cast', spellId: weakenSpell.spell.id, targetId: strongestMonster.id }
    }
  }

  return null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if character is currently in danger
 */
function isInDanger(game: GameState, config: PersonalityConfig): boolean {
  const hpRatio = game.character.hp / game.character.maxHp
  const cautionThreshold = config.caution / 100
  const adjacentCount = countAdjacentMonsters(game, game.character.position)

  return hpRatio < cautionThreshold || adjacentCount >= 2
}

/**
 * Get the best available spell for a given purpose
 */
export function getBestSpellForPurpose(
  game: GameState,
  purpose: 'damage' | 'heal' | 'escape' | 'buff'
): SpellTemplate | null {
  // GOLEM RESTRICTION
  if (!canCastSpells(game.character)) return null

  const available = getAvailableSpells(game.character, game.turn)

  const matching = available.filter((entry) => {
    if (!entry.canCast) return false
    switch (purpose) {
      case 'damage':
        return (
          entry.spell.effectType === 'damage' ||
          entry.spell.effectType === 'aoe_damage' ||
          entry.spell.effectType === 'lifedrain'
        )
      case 'heal':
        return entry.spell.effectType === 'heal'
      case 'escape':
        return entry.spell.effectType === 'teleport'
      case 'buff':
        return entry.spell.effectType === 'buff'
      default:
        return false
    }
  })

  if (matching.length === 0) return null

  // Sort by level (higher = better)
  matching.sort((a, b) => b.spell.level - a.spell.level)
  return matching[0]?.spell ?? null
}

/**
 * Check if character has any castable spells
 */
export function hasCastableSpells(game: GameState): boolean {
  const available = getAvailableSpells(game.character, game.turn)
  return available.some((entry) => entry.canCast)
}

/**
 * Check if character has enough mana for their cheapest spell
 */
export function canCastAnySpell(game: GameState): boolean {
  const available = getAvailableSpells(game.character, game.turn)
  return available.some((entry) => entry.canCast)
}

/**
 * Check if character can cast any damage spell right now
 * Used to determine if casters should get KITE goals
 */
export function hasCastableDamageSpell(game: GameState): boolean {
  const available = getAvailableSpells(game.character, game.turn)
  return available.some(
    (entry) =>
      entry.canCast &&
      (entry.spell.effectType === 'damage' ||
        entry.spell.effectType === 'aoe_damage' ||
        entry.spell.effectType === 'lifedrain')
  )
}

// ============================================================================
// ROOT/STUN SPELLS (for kiting)
// ============================================================================

/**
 * Check if we should cast root_shot to stun an enemy for kiting
 *
 * Used by Rangers to root enemies and back off
 */
export function getRootShotAction(game: GameState, adjacentMonster: Monster): GameAction | null {
  const character = game.character

  // Get available spells
  const available = getAvailableSpells(character, game.turn)

  // Look for root_shot specifically (damage spell with 100% slow = stun)
  const rootShot = available.find((entry) => entry.canCast && entry.spell.id === 'root_shot')

  if (rootShot) {
    // Check if monster is already rooted/slowed
    const isAlreadySlowed = adjacentMonster.debuffs.some(
      (d) => d.type === 'slow' && d.turnsRemaining > 1
    )
    if (!isAlreadySlowed) {
      return { type: 'cast', spellId: 'root_shot', targetId: adjacentMonster.id }
    }
  }

  return null
}

// ============================================================================
// SUMMON SPELLS
// ============================================================================

/**
 * Check if we should cast a summon spell
 *
 * Priorities:
 * - Ranger: Summon wolf immediately if no wolf companion (proactive)
 * - Necromancer: Summon skeleton proactively or when enemies visible
 *
 * @returns GameAction to cast summon spell, or null
 */
export function getSummonSpellAction(
  game: GameState,
  _config: PersonalityConfig,
  visibleMonsters: Monster[]
): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  // Get available summon spells
  const available = getAvailableSpells(character, game.turn)
  const summonSpells = available.filter(
    (entry) => entry.canCast && entry.spell.effectType === 'summon'
  )

  if (summonSpells.length === 0) return null

  // Check existing minions
  const existingMinions = game.minions.filter((m) => m.hp > 0)

  // For permanent pets (wolf): summon IMMEDIATELY if missing, heal if damaged
  // This is high priority - we want the wolf out at all times
  const wolfSpell = summonSpells.find((entry) => entry.spell.id === 'summon_wolf')
  if (wolfSpell) {
    const wolf = existingMinions.find((m) => m.type === 'wolf')
    if (!wolf) {
      // No wolf - summon one immediately (even without enemies)
      return { type: 'cast', spellId: 'summon_wolf' }
    }
    // Wolf exists but damaged - heal it when below 50%
    if (wolf.hp < wolf.maxHp * 0.5 && character.mp >= character.maxMp * 0.3) {
      return { type: 'cast', spellId: 'summon_wolf' }
    }
  }

  // For temporary summons (skeleton): summon proactively when we have mana
  // Necromancer should always try to have a skeleton out
  const skeletonSpell = summonSpells.find((entry) => entry.spell.id === 'summon_skeleton')
  if (skeletonSpell) {
    // Count non-permanent summons
    const tempSummons = existingMinions.filter((m) => !MINION_TEMPLATES[m.type].permanent)

    // Summon if we have no summons and decent mana
    if (tempSummons.length === 0 && character.mp >= character.maxMp * 0.4) {
      return { type: 'cast', spellId: 'summon_skeleton' }
    }

    // Summon second skeleton if enemies are visible and we have good mana
    if (
      tempSummons.length < 2 &&
      visibleMonsters.length > 0 &&
      character.mp >= character.maxMp * 0.5
    ) {
      return { type: 'cast', spellId: 'summon_skeleton' }
    }
  }

  return null
}

/**
 * Check if bot has any active minions
 */
export function hasActiveMinions(game: GameState): boolean {
  return game.minions.some((m) => m.hp > 0)
}

/**
 * Check if bot should use summons based on class
 */
export function classShouldSummon(classId: string): boolean {
  return classId === 'ranger' || classId === 'necromancer' || classId === 'druid'
}

// ============================================================================
// LIGHT ORB SPELL
// ============================================================================

/**
 * Get vision buff spell action (Light Orb or Shadow Sight)
 *
 * Cast when:
 * - Character is mage, archmage, or necromancer
 * - Has light_orb or shadow_sight spell available
 * - Not already buffed with enhanced_light
 * - Not in town (full visibility anyway)
 *
 * @returns GameAction to cast vision buff, or null
 */
export function getLightOrbSpellAction(game: GameState): GameAction | null {
  const character = game.character

  // GOLEM RESTRICTION
  if (!canCastSpells(character)) return null

  // Only caster classes have vision buffs
  const visionSpellId =
    character.classId === 'mage' || character.classId === 'archmage'
      ? 'light_orb'
      : character.classId === 'necromancer'
        ? 'shadow_sight'
        : null

  if (!visionSpellId) {
    return null
  }

  // Town is fully lit - don't waste mana
  if (character.depth === 0) {
    return null
  }

  // Already have enhanced light buff?
  const hasEnhancedLight = character.statusEffects.some((e) => e.type === 'enhanced_light')
  if (hasEnhancedLight) {
    return null
  }

  // Get available spells
  const available = getAvailableSpells(character, game.turn)
  const visionSpell = available.find((entry) => entry.canCast && entry.spell.id === visionSpellId)

  if (visionSpell) {
    return { type: 'cast', spellId: visionSpellId }
  }

  return null
}
