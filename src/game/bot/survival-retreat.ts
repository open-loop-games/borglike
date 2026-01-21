/**
 * Retreat and Escape Logic
 *
 * Handles retreat decisions, HP monitoring, and escape route finding.
 * Determines when to flee and how to escape safely.
 */

import type { GameState, Point, Direction } from '../types'
import type { PersonalityConfig, DangerMap } from './types'
import type { ClassBehaviorProfile } from './class-profiles'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'
import { getLocalDanger } from './danger'
import { isInCombat, countAdjacentMonsters, getCombatAdvantage } from './combat'

// ============================================================================
// TYPES
// ============================================================================

/** Retreat evaluation result */
export interface RetreatEvaluation {
  /** Should we retreat? */
  shouldRetreat: boolean
  /** Urgency level (0-100, higher = more urgent) */
  urgency: number
  /** Primary reason for retreat */
  reason: string
}

/** Escape route with safety score */
export interface EscapeRoute {
  direction: Direction
  target: Point
  safetyScore: number
}

// ============================================================================
// RETREAT DECISIONS
// ============================================================================

/**
 * Evaluate whether we should retreat from current position
 *
 * Triggers:
 * - HP below personality caution threshold
 * - Outnumbered (2+ adjacent monsters)
 * - Losing the fight (combat advantage negative)
 * - High local danger
 */
export function shouldRetreat(
  game: GameState,
  config: PersonalityConfig,
  dangers: DangerMap
): RetreatEvaluation {
  const character = game.character
  const hpRatio = character.hp / character.maxHp
  const cautionThreshold = config.caution / 100

  // Check HP threshold
  if (hpRatio < cautionThreshold) {
    const urgency = Math.floor((cautionThreshold - hpRatio) * 200)
    return {
      shouldRetreat: true,
      urgency: Math.min(100, urgency),
      reason: `HP critical (${Math.floor(hpRatio * 100)}%)`,
    }
  }

  // Check if outnumbered
  const adjacentCount = countAdjacentMonsters(game, character.position)
  if (adjacentCount >= 2) {
    // Only retreat if not super aggressive
    if (config.aggression < 80) {
      return {
        shouldRetreat: true,
        urgency: 60 + adjacentCount * 10,
        reason: `Outnumbered (${adjacentCount} enemies)`,
      }
    }
  }

  // Check combat advantage
  if (isInCombat(game)) {
    const advantage = getCombatAdvantage(game)
    if (advantage < -20) {
      // Losing badly
      return {
        shouldRetreat: true,
        urgency: Math.min(100, Math.abs(advantage)),
        reason: 'Losing fight',
      }
    }
  }

  // Check local danger (even if not in combat)
  const localDanger = getLocalDanger(dangers, character.position)
  const dangerThreshold = 100 + config.aggression // Higher aggression = tolerate more danger
  if (localDanger > dangerThreshold && hpRatio < 0.7) {
    return {
      shouldRetreat: true,
      urgency: Math.floor((localDanger / dangerThreshold) * 50),
      reason: 'High danger area',
    }
  }

  return {
    shouldRetreat: false,
    urgency: 0,
    reason: '',
  }
}

/**
 * Quick check for critical HP (emergency retreat)
 */
export function isCriticalHP(game: GameState, config: PersonalityConfig): boolean {
  const hpRatio = game.character.hp / game.character.maxHp
  // Critical = below half of caution threshold
  const criticalThreshold = (config.caution / 100) * 0.5
  return hpRatio < criticalThreshold
}

/**
 * Check if HP is low enough to consider healing/resting
 */
export function needsHealing(game: GameState): boolean {
  const hpRatio = game.character.hp / game.character.maxHp
  return hpRatio < 0.5
}

// ============================================================================
// ESCAPE ROUTES
// ============================================================================

/**
 * Find the best escape route from current position
 *
 * Prefers:
 * - Directions away from monsters
 * - Lower danger tiles
 * - Towards known safe areas (stairs, explored corridors)
 */
export function findBestEscapeRoute(
  game: GameState,
  dangers: DangerMap
): EscapeRoute | null {
  const pos = game.character.position
  const adjacent = getAdjacentPositions(pos)
  const routes: EscapeRoute[] = []

  // Find monster centroid (average position of nearby monsters)
  const nearbyMonsters = game.monsters.filter(m => {
    const dx = Math.abs(m.position.x - pos.x)
    const dy = Math.abs(m.position.y - pos.y)
    return dx <= 3 && dy <= 3 && m.hp > 0
  })

  let monsterCentroid: Point | null = null
  if (nearbyMonsters.length > 0) {
    const sumX = nearbyMonsters.reduce((sum, m) => sum + m.position.x, 0)
    const sumY = nearbyMonsters.reduce((sum, m) => sum + m.position.y, 0)
    monsterCentroid = {
      x: sumX / nearbyMonsters.length,
      y: sumY / nearbyMonsters.length,
    }
  }

  for (const adj of adjacent) {
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (!tile) continue
    if (!isWalkable(tile) && tile.type !== 'door_closed') continue

    // Skip if occupied by monster
    const hasMonster = game.monsters.some(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (hasMonster) continue

    // Calculate safety score
    let safetyScore = 100

    // Penalize for danger
    const tileDanger = dangers.get(`${adj.x},${adj.y}`) ?? 0
    safetyScore -= tileDanger / 2

    // Bonus for moving away from monster centroid
    if (monsterCentroid) {
      const currentDist = Math.hypot(pos.x - monsterCentroid.x, pos.y - monsterCentroid.y)
      const newDist = Math.hypot(adj.x - monsterCentroid.x, adj.y - monsterCentroid.y)
      if (newDist > currentDist) {
        safetyScore += 30 // Moving away from danger
      } else if (newDist < currentDist) {
        safetyScore -= 20 // Moving toward danger
      }
    }

    // Bonus for stairs (ultimate escape)
    if (game.currentLevel.stairsDown) {
      const stairs = game.currentLevel.stairsDown
      if (adj.x === stairs.x && adj.y === stairs.y) {
        safetyScore += 50
      }
    }

    // Calculate direction
    const dx = adj.x - pos.x
    const dy = adj.y - pos.y
    const direction = deltaToDirection(dx, dy)
    if (!direction) continue

    routes.push({
      direction,
      target: adj,
      safetyScore,
    })
  }

  if (routes.length === 0) {
    return null
  }

  // Sort by safety (descending)
  routes.sort((a, b) => b.safetyScore - a.safetyScore)

  return routes[0]!
}

/**
 * Find escape direction away from a specific threat
 */
export function findEscapeDirection(
  game: GameState,
  threatPos: Point
): Direction | null {
  const pos = game.character.position
  const adjacent = getAdjacentPositions(pos)

  let bestDirection: Direction | null = null
  let bestDistance = -Infinity

  for (const adj of adjacent) {
    const tile = getTile(game.currentLevel, adj.x, adj.y)
    if (!tile) continue
    if (!isWalkable(tile) && tile.type !== 'door_closed') continue

    // Skip if occupied by monster
    const hasMonster = game.monsters.some(
      m => m.position.x === adj.x && m.position.y === adj.y && m.hp > 0
    )
    if (hasMonster) continue

    // Calculate distance from threat
    const distFromThreat = Math.hypot(adj.x - threatPos.x, adj.y - threatPos.y)

    if (distFromThreat > bestDistance) {
      bestDistance = distFromThreat
      const dx = adj.x - pos.x
      const dy = adj.y - pos.y
      bestDirection = deltaToDirection(dx, dy)
    }
  }

  return bestDirection
}

// ============================================================================
// HP MONITORING
// ============================================================================

/**
 * Get HP status for decision making
 */
export function getHPStatus(game: GameState, config: PersonalityConfig): {
  ratio: number
  isCritical: boolean
  needsHealing: boolean
  canFight: boolean
} {
  const character = game.character
  const ratio = character.hp / character.maxHp
  const cautionThreshold = config.caution / 100

  return {
    ratio,
    isCritical: ratio < cautionThreshold * 0.5,
    needsHealing: ratio < 0.5,
    canFight: ratio >= cautionThreshold,
  }
}

/**
 * Estimate how many hits we can take
 */
export function getHitsTillDeath(game: GameState): number {
  const character = game.character

  // Estimate average incoming damage based on nearby monsters
  const nearbyMonsters = game.monsters.filter(m => {
    const dx = Math.abs(m.position.x - character.position.x)
    const dy = Math.abs(m.position.y - character.position.y)
    return dx <= 2 && dy <= 2 && m.hp > 0
  })

  if (nearbyMonsters.length === 0) {
    return Infinity
  }

  // Average damage from nearby monsters
  const avgDamage = nearbyMonsters.reduce((sum, m) => {
    const rawDamage = m.template.damage
    return sum + Math.max(rawDamage - character.combat.armor, 1)
  }, 0) / nearbyMonsters.length

  return Math.floor(character.hp / avgDamage)
}

// ============================================================================
// CLASS-AWARE RETREAT
// ============================================================================

/**
 * Evaluate whether we should retreat, considering class profile
 *
 * Key class behaviors:
 * - Berserker: NEVER retreats (neverRetreats=true)
 * - Ranged classes: May want to kite instead of retreat
 * - Melee classes: Use standard retreat logic
 */
export function shouldClassRetreat(
  game: GameState,
  config: PersonalityConfig,
  dangers: DangerMap,
  classProfile: ClassBehaviorProfile
): RetreatEvaluation {
  // Berserker never retreats
  if (classProfile.neverRetreats) {
    return {
      shouldRetreat: false,
      urgency: 0,
      reason: 'Class never retreats',
    }
  }

  // Use base retreat evaluation
  const baseEval = shouldRetreat(game, config, dangers)

  // Apply class modifier to urgency
  // Aggressive classes (positive aggressionMod) have lower urgency
  // Cautious classes (positive cautionMod) have higher urgency
  if (baseEval.shouldRetreat) {
    const modifiedUrgency = baseEval.urgency + classProfile.cautionMod - classProfile.aggressionMod / 2
    return {
      ...baseEval,
      urgency: Math.max(0, Math.min(100, modifiedUrgency)),
    }
  }

  return baseEval
}

// ============================================================================
// HELPERS
// ============================================================================

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
