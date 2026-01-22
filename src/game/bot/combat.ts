/**
 * Combat Logic
 *
 * Handles engagement decisions, target selection, and combat evaluation.
 * Determines when to fight vs flee based on personality and situation.
 */

import type { GameState, Monster, Character, Point, Direction } from '../types'
import { chebyshevDistance, isAdjacent } from '../types'
import type { BotContext, PersonalityConfig } from './types'
import type { ClassBehaviorProfile } from './class-profiles'
import { getAdjacentPositions, getTile, isWalkable } from '../dungeon'
import { canRangedAttack, getBowRange } from '../combat'

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
 *
 * @param character - The player character
 * @param monster - The monster to evaluate
 * @param classProfile - Optional class profile for ranged damage calculation
 * @param distance - Distance to monster (default 1 for adjacent)
 */
export function evaluateCombat(
  character: Character,
  monster: Monster,
  classProfile?: ClassBehaviorProfile,
  distance: number = 1
): CombatEvaluation {
  const template = monster.template

  // Calculate turns to kill - use effective damage if class profile provided
  const playerDamage = classProfile
    ? getEffectiveDamage(character, classProfile, distance)
    : Math.max(character.combat.meleeDamage, 1)
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
 * Select target with class-aware scoring
 *
 * For ranged classes: bonus for optimal range (3-4), penalty for adjacent (-30)
 * For melee classes: keep current adjacent bonus (+50)
 */
export function selectTargetForClass(
  context: BotContext,
  classProfile: ClassBehaviorProfile,
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

  const optimalRange = classProfile.engageDistance || 3
  const bowRange = getBowRange(character)

  let bestTarget: Monster | null = null
  let bestScore = -Infinity
  let bestReason = ''

  for (const monster of candidates) {
    const distance = chebyshevDistance(pos, monster.position)
    const evaluation = evaluateCombat(character, monster, classProfile, distance)

    // Base score from ease of kill (lower turns = higher score)
    let score = 100 - evaluation.turnsToKill * 10

    // Class-aware distance scoring
    if (classProfile.prefersRanged && character.equipment.bow) {
      // Ranged class scoring
      if (distance >= optimalRange && distance <= bowRange) {
        // At optimal shooting range
        score += 40
      } else if (distance >= 2 && distance <= bowRange) {
        // Can shoot but not optimal
        score += 20
      } else if (distance === 1) {
        // Adjacent - bad for ranged classes
        score -= 30
      }
    } else {
      // Melee class scoring - prefer adjacent
      if (distance === 1) {
        score += 50
      }
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

    // Penalty for distance (reduced for ranged classes at good range)
    if (classProfile.prefersRanged && distance >= 2 && distance <= bowRange) {
      score -= distance * 2 // Reduced penalty when can shoot
    } else {
      score -= distance * 5
    }

    // Bonus if we can definitely win
    if (evaluation.canWin) {
      score += 25
    }

    let reason = ''
    if (classProfile.prefersRanged && distance >= 2 && distance <= bowRange) {
      reason = 'in range'
    } else if (distance === 1) {
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
// EFFECTIVE DAMAGE CALCULATION
// ============================================================================

/**
 * Get effective damage based on class profile and distance
 *
 * For ranged classes with a bow at distance >= 2, use ranged damage.
 * Otherwise fall back to melee damage.
 */
export function getEffectiveDamage(
  character: Character,
  classProfile: ClassBehaviorProfile,
  distance: number = 1
): number {
  if (classProfile.prefersRanged && character.equipment.bow && distance >= 2) {
    return Math.max(character.combat.rangedDamage, 1)
  }
  return Math.max(character.combat.meleeDamage, 1)
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

/**
 * Count escape routes (walkable adjacent tiles without monsters)
 */
function countEscapeRoutes(game: GameState, pos: Point): number {
  const adjacent = getAdjacentPositions(pos)
  let routes = 0

  for (const adj of adjacent) {
    // Check if tile is walkable
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (!tile || !isWalkable(tile)) continue

    // Check if not occupied by monster
    const hasMonster = game.monsters.some(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (!hasMonster) {
      routes++
    }
  }

  return routes
}

// ============================================================================
// RANGED COMBAT HELPERS
// ============================================================================

/**
 * Check if character has a ranged weapon equipped
 */
export function hasRangedWeapon(game: GameState): boolean {
  return game.character.equipment.bow !== null
}

/**
 * Find best target for ranged attack
 *
 * Prefers targets at optimal range (2-4 tiles) that we can hit
 */
export function findBestRangedTarget(
  game: GameState,
  visibleMonsters: Monster[]
): Monster | null {
  const character = game.character
  const pos = character.position
  const bowRange = getBowRange(character)

  if (bowRange === 0) return null

  let bestTarget: Monster | null = null
  let bestScore = -Infinity

  for (const monster of visibleMonsters) {
    if (monster.hp <= 0) continue

    // Check if we can hit this target
    if (!canRangedAttack(character, monster.position)) continue

    const dx = Math.abs(monster.position.x - pos.x)
    const dy = Math.abs(monster.position.y - pos.y)
    const distance = Math.max(dx, dy)

    // Score based on:
    // - Optimal range (3-4 tiles = highest)
    // - Lower HP = easier kill
    // - Threat level
    let score = 100

    // Range bonus: prefer 3-4 tiles, penalty for 2 or 5+
    if (distance >= 3 && distance <= 4) {
      score += 20
    } else if (distance === 2) {
      score += 10
    } else {
      score -= (distance - 4) * 5
    }

    // HP bonus: prefer low HP targets
    const hpPercent = monster.hp / monster.maxHp
    score += (1 - hpPercent) * 30

    // Awake monsters are more urgent
    if (monster.isAwake) {
      score += 15
    }

    if (score > bestScore) {
      bestScore = score
      bestTarget = monster
    }
  }

  return bestTarget
}

/**
 * Find best position to kite from (maintain distance while able to shoot)
 *
 * Returns a direction to move to maintain optimal range from enemies
 */
export function findKitePosition(
  game: GameState,
  targetMonster: Monster,
  classProfile: ClassBehaviorProfile
): Direction | null {
  const character = game.character
  const pos = character.position
  const targetPos = targetMonster.position

  const currentDx = targetPos.x - pos.x
  const currentDy = targetPos.y - pos.y
  const currentDist = Math.max(Math.abs(currentDx), Math.abs(currentDy))

  const optimalRange = classProfile.engageDistance || 3
  const bowRange = getBowRange(character)

  // If we're at optimal range or better, no need to move
  if (currentDist >= optimalRange && currentDist <= bowRange) {
    return null
  }

  // Need to move away from the monster
  const adjacent = getAdjacentPositions(pos)
  let bestDirection: Direction | null = null
  let bestScore = -Infinity

  for (const adj of adjacent) {
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (!tile) continue
    if (!isWalkable(tile) && tile.type !== 'door_closed') continue

    // Skip if occupied by monster
    const hasMonster = game.monsters.some(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (hasMonster) continue

    // Calculate new distance to target
    const newDx = targetPos.x - adj.x
    const newDy = targetPos.y - adj.y
    const newDist = Math.max(Math.abs(newDx), Math.abs(newDy))

    // Score this position
    let score = 0

    // Prefer positions closer to optimal range
    const distFromOptimal = Math.abs(newDist - optimalRange)
    score = 100 - distFromOptimal * 20

    // Bonus if we can still shoot from this position
    if (newDist >= 2 && newDist <= bowRange) {
      score += 50
    }

    // Bonus for moving away when too close
    if (currentDist < optimalRange && newDist > currentDist) {
      score += 30
    }

    // Calculate direction
    const dx = adj.x - pos.x
    const dy = adj.y - pos.y
    const direction = deltaToDirection(dx, dy)
    if (!direction) continue

    if (score > bestScore) {
      bestScore = score
      bestDirection = direction
    }
  }

  return bestDirection
}

/**
 * Check if we should avoid melee based on class profile
 */
export function shouldAvoidMelee(
  classProfile: ClassBehaviorProfile,
  distance: number
): boolean {
  // Ranged classes should avoid adjacent (distance 1) if possible
  if (classProfile.prefersRanged && distance <= 1) {
    return true
  }
  return false
}

/**
 * Convert delta coordinates to direction
 */
function deltaToDirection(dx: number, dy: number): Direction | null {
  if (dx === 0 && dy === -1) return 'n'
  if (dx === 0 && dy === 1) return 's'
  if (dx === 1 && dy === 0) return 'e'
  if (dx === -1 && dy === 0) return 'w'
  if (dx === 1 && dy === -1) return 'ne'
  if (dx === -1 && dy === -1) return 'nw'
  if (dx === 1 && dy === 1) return 'se'
  if (dx === -1 && dy === 1) return 'sw'
  return null
}
