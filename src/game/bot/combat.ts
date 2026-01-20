/**
 * Combat Logic
 *
 * Handles engagement decisions, target selection, and combat evaluation.
 * Determines when to fight vs flee based on personality and situation.
 */

import type { GameState, Monster, Character, Point } from '../types'
import type { BotContext, PersonalityConfig } from './types'
import { getAdjacentPositions } from '../dungeon'

// ============================================================================
// TYPES
// ============================================================================

/** Combat evaluation result */
export interface CombatEvaluation {
  /** Can we win this fight? */
  canWin: boolean
  /** Estimated turns to kill target */
  turnsToKill: number
  /** Estimated damage we'll take */
  expectedDamage: number
  /** Should we engage based on personality? */
  shouldEngage: boolean
  /** Threat level of the monster */
  threatLevel: number
}

/** Target selection result */
export interface TargetSelection {
  target: Monster
  score: number
  reason: string
}

// ============================================================================
// ENGAGEMENT DECISIONS
// ============================================================================

/**
 * Decide whether to engage a specific monster
 *
 * Considers:
 * - Our HP vs damage we'll take
 * - Personality aggression
 * - Number of nearby enemies
 * - Escape routes available
 */
export function shouldEngage(
  game: GameState,
  monster: Monster,
  config: PersonalityConfig
): boolean {
  const character = game.character
  const evaluation = evaluateCombat(character, monster)

  // Always fight if monster is adjacent and we can't escape
  if (isAdjacent(character.position, monster.position)) {
    const escapeRoutes = countEscapeRoutes(game, character.position)
    if (escapeRoutes === 0) {
      return true // Cornered, must fight
    }
  }

  // Check HP threshold based on personality
  const hpRatio = character.hp / character.maxHp
  const cautionThreshold = config.caution / 100

  // Don't engage if HP is below caution threshold
  if (hpRatio < cautionThreshold) {
    return false
  }

  // Check if we can win without dying
  if (!evaluation.canWin) {
    // Only aggressive personalities fight losing battles
    return config.aggression > 70
  }

  // Will we survive the fight?
  const hpAfterFight = character.hp - evaluation.expectedDamage
  if (hpAfterFight <= 0) {
    return false // Would die
  }

  // Check aggression vs threat
  // High aggression = engage even dangerous monsters
  // Low aggression = only engage weak monsters
  const aggressionThreshold = 100 - config.aggression
  if (evaluation.threatLevel > aggressionThreshold) {
    return false
  }

  return true
}

/**
 * Evaluate a potential combat encounter
 */
export function evaluateCombat(character: Character, monster: Monster): CombatEvaluation {
  const template = monster.template

  // Calculate turns to kill
  const playerDamage = Math.max(character.combat.meleeDamage, 1)
  const turnsToKill = Math.ceil(monster.hp / playerDamage)

  // Calculate expected damage we'll take
  const monsterDamage = Math.max(template.damage - character.combat.armor, 1)
  const expectedDamage = monsterDamage * turnsToKill

  // Can we win?
  const canWin = character.hp > expectedDamage

  // Threat level (0-100)
  // Based on damage potential and HP
  const threatLevel = Math.min(100, Math.floor(
    (monsterDamage / character.maxHp) * 100 +
    (turnsToKill > 3 ? 20 : 0) +
    (monster.isAwake ? 10 : 0)
  ))

  // Should engage (basic heuristic)
  const shouldEngage = canWin && threatLevel < 50

  return {
    canWin,
    turnsToKill,
    expectedDamage,
    shouldEngage,
    threatLevel,
  }
}

// ============================================================================
// TARGET SELECTION
// ============================================================================

/**
 * Select the best target from visible monsters
 *
 * Scoring factors:
 * - Low HP = easier kill (primary)
 * - High threat = remove danger faster
 * - Distance = prefer closer targets
 * - Awake status = awake monsters are more urgent
 */
export function selectTarget(
  context: BotContext,
  adjacentOnly: boolean = false
): TargetSelection | null {
  const { game, config } = context
  const character = game.character
  const pos = character.position

  // Get candidate monsters
  let candidates = context.visibleMonsters.filter(m => m.hp > 0)

  if (adjacentOnly) {
    candidates = candidates.filter(m => isAdjacent(pos, m.position))
  }

  if (candidates.length === 0) {
    return null
  }

  let bestTarget: Monster | null = null
  let bestScore = -Infinity
  let bestReason = ''

  for (const monster of candidates) {
    const evaluation = evaluateCombat(character, monster)
    const distance = chebyshevDistance(pos, monster.position)

    // Base score from ease of kill (lower turns = higher score)
    let score = 100 - evaluation.turnsToKill * 10

    // Bonus for being adjacent
    if (distance === 1) {
      score += 50
    }

    // Bonus for awake monsters (they're coming for us anyway)
    if (monster.isAwake) {
      score += 20
    }

    // Bonus for low HP (secure the kill)
    const hpPercent = monster.hp / monster.maxHp
    score += (1 - hpPercent) * 30

    // Penalty for high threat (unless aggressive)
    const threatPenalty = evaluation.threatLevel * (1 - config.aggression / 100)
    score -= threatPenalty

    // Penalty for distance
    score -= distance * 5

    // Bonus if we can definitely win
    if (evaluation.canWin) {
      score += 25
    }

    let reason = ''
    if (distance === 1) {
      reason = 'adjacent'
    } else if (hpPercent < 0.3) {
      reason = 'low HP'
    } else if (monster.isAwake) {
      reason = 'awake'
    } else {
      reason = 'hunting'
    }

    if (score > bestScore) {
      bestScore = score
      bestTarget = monster
      bestReason = reason
    }
  }

  if (!bestTarget) {
    return null
  }

  return {
    target: bestTarget,
    score: bestScore,
    reason: bestReason,
  }
}

/**
 * Find adjacent monster to attack (quick check)
 */
export function findAdjacentMonster(game: GameState): Monster | null {
  const pos = game.character.position
  const adjacent = getAdjacentPositions(pos)

  for (const adj of adjacent) {
    const monster = game.monsters.find(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (monster) {
      return monster
    }
  }

  return null
}

/**
 * Count adjacent monsters (for outnumbered check)
 */
export function countAdjacentMonsters(game: GameState, pos: Point): number {
  const adjacent = getAdjacentPositions(pos)
  let count = 0

  for (const adj of adjacent) {
    if (game.monsters.some(m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0)) {
      count++
    }
  }

  return count
}

/**
 * Check if we're outnumbered
 */
export function isOutnumbered(game: GameState): boolean {
  const adjacentCount = countAdjacentMonsters(game, game.character.position)
  return adjacentCount >= 2
}

// ============================================================================
// COMBAT STATE
// ============================================================================

/**
 * Check if we're currently in combat
 */
export function isInCombat(game: GameState): boolean {
  return countAdjacentMonsters(game, game.character.position) > 0
}

/**
 * Estimate if we're winning the current fight
 * Returns positive if winning, negative if losing
 */
export function getCombatAdvantage(game: GameState): number {
  const character = game.character
  const adjacentMonsters = game.monsters.filter(m =>
    isAdjacent(character.position, m.position) && m.hp > 0
  )

  if (adjacentMonsters.length === 0) {
    return 100 // Not in combat, we're "winning"
  }

  // Sum up expected damage from all adjacent monsters
  let totalThreat = 0
  let totalTurnsToKill = 0

  for (const monster of adjacentMonsters) {
    const eval_ = evaluateCombat(character, monster)
    totalThreat += eval_.expectedDamage
    totalTurnsToKill += eval_.turnsToKill
  }

  // Advantage = our HP buffer vs expected damage
  const hpBuffer = character.hp - totalThreat
  const advantage = (hpBuffer / character.maxHp) * 100

  return advantage
}

// ============================================================================
// HELPERS
// ============================================================================

function isAdjacent(a: Point, b: Point): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx <= 1 && dy <= 1 && (dx + dy) > 0
}

function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/**
 * Count escape routes (walkable adjacent tiles without monsters)
 */
function countEscapeRoutes(game: GameState, pos: Point): number {
  const adjacent = getAdjacentPositions(pos)
  let routes = 0

  for (const adj of adjacent) {
    // Check if walkable and not occupied by monster
    const hasMonster = game.monsters.some(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (!hasMonster) {
      // Simple check - in real implementation would check tile walkability
      routes++
    }
  }

  return routes
}
