/**
 * Survival Logic
 *
 * Handles retreat decisions, HP monitoring, and escape route finding.
 * Determines when to flee and how to escape safely.
 */

import type { GameState, GameAction, Point, Direction } from '../types'
import type { PersonalityConfig, DangerMap, BotState, PhaseDoorSafety, DangerTier } from './types'
import { getTile, isWalkable, getAdjacentPositions } from '../dungeon'
import { getLocalDanger, getTileDanger, calculateAvoidance, getDangerTier } from './danger'
import { isInCombat, countAdjacentMonsters, getCombatAdvantage } from './combat'
import {
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
// PHASE DOOR SAFETY & ESCAPE DECISIONS (Angband-inspired)
// ============================================================================

/**
 * Evaluate if phase door (short-range teleport) is safe to use
 *
 * Samples tiles within range 10 and counts "safe" zones where
 * danger < avoidance × 0.5. Returns safe if:
 * - >= 25% of landing zones are safe, OR
 * - Average danger is < 50% of current position danger
 */
export function evaluatePhaseDoorSafety(
  game: GameState,
  dangers: DangerMap,
  avoidance: number
): PhaseDoorSafety {
  const pos = game.character.position
  const level = game.currentLevel
  const safeThreshold = avoidance * 0.5
  const currentDanger = getTileDanger(dangers, pos)

  // Sample tiles within phase door range (10 squares)
  const range = 10
  let totalSamples = 0
  let safeSamples = 0
  let totalDanger = 0

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      if (dist === 0 || dist > range) continue

      const x = pos.x + dx
      const y = pos.y + dy

      // Check if tile is walkable
      const tile = getTile(level, x, y)
      if (!tile || !isWalkable(tile)) continue

      // Check if occupied by monster
      const hasMonster = game.monsters.some(
        m => m.position.x === x && m.position.y === y && m.hp > 0
      )
      if (hasMonster) continue

      totalSamples++
      const tileDanger = getTileDanger(dangers, { x, y })
      totalDanger += tileDanger

      if (tileDanger < safeThreshold) {
        safeSamples++
      }
    }
  }

  if (totalSamples === 0) {
    return { isSafe: false, safeRatio: 0, avgDanger: Infinity }
  }

  const safeRatio = safeSamples / totalSamples
  const avgDanger = totalDanger / totalSamples

  // Safe if >= 25% safe zones OR average danger < 50% of current
  const isSafe = safeRatio >= 0.25 || avgDanger < currentDanger * 0.5

  return { isSafe, safeRatio, avgDanger }
}

/**
 * Determine if escape should take priority over healing
 *
 * Escape beats healing when:
 * - CRITICAL tier AND HP < 30%
 * - OR surrounded (3+ adjacent monsters)
 * - OR hitsTillDeath <= 1 with 2+ adjacent
 */
export function shouldEscapeOverHeal(
  game: GameState,
  tier: DangerTier,
  adjacentCount: number
): boolean {
  const hpRatio = game.character.hp / game.character.maxHp
  const hitsTillDeath = getHitsTillDeath(game)

  // CRITICAL tier with low HP - escape is priority
  if (tier === 'CRITICAL' && hpRatio < 0.3) {
    return true
  }

  // Surrounded by 3+ monsters - escape is needed
  if (adjacentCount >= 3) {
    return true
  }

  // About to die with multiple adjacent threats
  if (hitsTillDeath <= 1 && adjacentCount >= 2) {
    return true
  }

  return false
}

// ============================================================================
// CONSUMABLE USAGE
// ============================================================================

/**
 * Check if we should use a consumable for survival
 * Returns an action if we should use something, null otherwise
 *
 * Decision flow (Angband-inspired 4-tier system):
 * 1. Cure poison (unchanged - always priority)
 * 2. Calculate avoidance and danger tier
 * 3. If CRITICAL and shouldEscapeOverHeal:
 *    → Try full teleport (always safe - goes anywhere)
 *    → Try phase door (skip safety check - desperate)
 * 4. If DANGER or higher with healing available:
 *    → Use healing potion
 * 5. If CAUTION or higher, no healing, has escape:
 *    → Check phase door safety
 *    → Use escape if safe OR use full teleport
 * 6. If twitchCounter > 30 and has escape:
 *    → Use escape to break stuck state
 * 7. Return null
 */
export function getSurvivalConsumableAction(
  game: GameState,
  config: PersonalityConfig,
  dangers: DangerMap,
  botState?: BotState
): GameAction | null {
  const character = game.character
  const hpRatio = character.hp / character.maxHp
  const localDanger = getLocalDanger(dangers, character.position)
  const adjacentCount = countAdjacentMonsters(game, character.position)
  const inCombat = isInCombat(game)

  // 1. Cure poison immediately if poisoned (unchanged - always priority)
  if (character.poison) {
    const antidote = findNeutralizePoison(character)
    if (antidote) {
      return { type: 'use', itemId: antidote.id }
    }
    // Also check resistance potion which cures poison
    const resistPotion = findResistancePotion(character, 'poison')
    if (resistPotion) {
      return { type: 'use', itemId: resistPotion.id }
    }
  }

  // 2. Calculate avoidance and danger tier
  const avoidance = calculateAvoidance(game, config)
  const tier = getDangerTier(localDanger, avoidance)

  // 3. If CRITICAL and shouldEscapeOverHeal: escape takes priority
  if (tier === 'CRITICAL' && shouldEscapeOverHeal(game, tier, adjacentCount)) {
    // Try full teleport first (always safe - random destination)
    const fullTeleport = findFullTeleportScroll(character)
    if (fullTeleport) {
      return { type: 'use', itemId: fullTeleport.id }
    }
    // Try phase door (skip safety check - desperate mode)
    const phaseDoor = findPhaseDoorScroll(character)
    if (phaseDoor) {
      return { type: 'use', itemId: phaseDoor.id }
    }
    // Fall back to any escape scroll
    const anyEscape = findEscapeScroll(character)
    if (anyEscape) {
      return { type: 'use', itemId: anyEscape.id }
    }
  }

  // 4. If DANGER or higher with healing available: use healing
  if (tier === 'DANGER' || tier === 'CRITICAL') {
    // Try stronger potions first when more hurt
    const minTier = hpRatio < 0.25 ? 2 : 1
    const potion = findHealingPotion(character, minTier) ?? findHealingPotion(character, 1)
    if (potion) {
      return { type: 'use', itemId: potion.id }
    }
  }

  // 5. If CAUTION or higher, no healing available, consider escape
  if (tier === 'CAUTION' || tier === 'DANGER' || tier === 'CRITICAL') {
    // Check if we have any healing - if so, don't escape at CAUTION level
    const hasHealing = findHealingPotion(character) !== null
    if (!hasHealing || tier !== 'CAUTION') {
      // Try full teleport (always safe)
      const fullTeleport = findFullTeleportScroll(character)
      if (fullTeleport) {
        return { type: 'use', itemId: fullTeleport.id }
      }

      // Try phase door with safety check
      const phaseDoor = findPhaseDoorScroll(character)
      if (phaseDoor) {
        const safety = evaluatePhaseDoorSafety(game, dangers, avoidance)
        if (safety.isSafe) {
          return { type: 'use', itemId: phaseDoor.id }
        }
      }
    }
  }

  // 6. Twitchy escape: if stuck for 30+ turns, use escape to break deadlock
  const TWITCH_THRESHOLD = 30
  if (botState && botState.twitchCounter > TWITCH_THRESHOLD) {
    const fullTeleport = findFullTeleportScroll(character)
    if (fullTeleport) {
      return { type: 'use', itemId: fullTeleport.id }
    }
    const phaseDoor = findPhaseDoorScroll(character)
    if (phaseDoor) {
      return { type: 'use', itemId: phaseDoor.id }
    }
    const anyEscape = findEscapeScroll(character)
    if (anyEscape) {
      return { type: 'use', itemId: anyEscape.id }
    }
  }

  // 7. Also check for basic healing outside of combat when HP is low
  if (!inCombat && hpRatio < 0.4) {
    const potion = findHealingPotion(character, 1)
    if (potion) {
      return { type: 'use', itemId: potion.id }
    }
  }

  return null
}

/**
 * Check if we should use a combat buff before/during combat
 * Returns an action if we should use something, null otherwise
 */
export function getCombatBuffAction(
  game: GameState,
  _config: PersonalityConfig,
  dangers: DangerMap
): GameAction | null {
  const character = game.character
  const inCombat = isInCombat(game)
  const adjacentCount = countAdjacentMonsters(game, character.position)
  const localDanger = getLocalDanger(dangers, character.position)

  // Only use buffs when in combat or approaching strong enemies
  if (!inCombat && localDanger < 30) return null

  // Check if already buffed
  const hasSpeed = hasStatusEffect(character, 'speed')
  const hasHeroism = hasStatusEffect(character, 'heroism')
  const hasBerserk = hasStatusEffect(character, 'berserk')
  const hasBlessing = hasStatusEffect(character, 'blessing')
  const hasProtection = hasStatusEffect(character, 'protection')

  // Use speed potion if facing multiple enemies and not already fast
  if (!hasSpeed && adjacentCount >= 2) {
    const speedPotion = findSpeedPotion(character)
    if (speedPotion) {
      return { type: 'use', itemId: speedPotion.id }
    }
  }

  // Use buff potion (heroism/berserk) for tough fights
  if (!hasHeroism && !hasBerserk && localDanger > 50) {
    const buffPotion = findBuffPotion(character)
    if (buffPotion) {
      return { type: 'use', itemId: buffPotion.id }
    }
  }

  // Use blessing scroll in combat if no blessing active
  if (!hasBlessing && inCombat && adjacentCount >= 1) {
    const blessingScroll = findBlessingScroll(character)
    if (blessingScroll) {
      return { type: 'use', itemId: blessingScroll.id }
    }
  }

  // Use protection from evil when facing many enemies (deep dungeon)
  if (!hasProtection && character.depth >= 20 && localDanger > 80) {
    const protScroll = findProtectionScroll(character)
    if (protScroll) {
      return { type: 'use', itemId: protScroll.id }
    }
  }

  // Use resistance potions based on nearby monster types
  const nearbyMonsters = game.monsters.filter(m => {
    const dx = Math.abs(m.position.x - character.position.x)
    const dy = Math.abs(m.position.y - character.position.y)
    return dx <= 3 && dy <= 3 && m.hp > 0
  })

  for (const monster of nearbyMonsters) {
    const abilities = monster.template.abilities || []

    // Fire resistance for fire-breathing monsters
    if (abilities.some(a => a.toLowerCase().includes('fire')) && !hasTempResistance(character, 'FIRE')) {
      const firePotion = findResistancePotion(character, 'fire')
      if (firePotion) {
        return { type: 'use', itemId: firePotion.id }
      }
    }

    // Cold resistance for frost monsters
    if (abilities.some(a => a.toLowerCase().includes('cold') || a.toLowerCase().includes('frost')) && !hasTempResistance(character, 'COLD')) {
      const coldPotion = findResistancePotion(character, 'cold')
      if (coldPotion) {
        return { type: 'use', itemId: coldPotion.id }
      }
    }

    // Poison resistance for venomous monsters
    if (abilities.some(a => a.toLowerCase().includes('poison') || a.toLowerCase().includes('venom')) && !hasTempResistance(character, 'POISON')) {
      const poisonPotion = findResistancePotion(character, 'poison')
      if (poisonPotion) {
        return { type: 'use', itemId: poisonPotion.id }
      }
    }
  }

  return null
}

/**
 * Check if we should use a utility consumable (mapping, enchant, etc.)
 * Only when safe and not in combat
 */
export function getUtilityConsumableAction(
  game: GameState,
  _config: PersonalityConfig,
  dangers: DangerMap
): GameAction | null {
  const character = game.character
  const inCombat = isInCombat(game)
  const localDanger = getLocalDanger(dangers, character.position)

  // Only use utility items when safe
  if (inCombat || localDanger > 20) return null

  // Use enchant scrolls when safe and have equipment
  const weapon = character.equipment.weapon
  const armor = character.equipment.armor

  // Enchant weapon if we have one equipped and a scroll
  if (weapon && weapon.enchantment < 5) {
    const enchantWeapon = findEnchantScroll(character, 'weapon')
    if (enchantWeapon) {
      return { type: 'use', itemId: enchantWeapon.id }
    }
  }

  // Enchant armor if we have one equipped and a scroll
  if (armor && armor.enchantment < 5) {
    const enchantArmor = findEnchantScroll(character, 'armor')
    if (enchantArmor) {
      return { type: 'use', itemId: enchantArmor.id }
    }
  }

  // Use mapping scroll if exploration is low (< 30%)
  const totalTiles = game.currentLevel.width * game.currentLevel.height
  let exploredCount = 0
  for (const row of game.currentLevel.tiles) {
    if (row) {
      for (const tile of row) {
        if (tile?.explored) exploredCount++
      }
    }
  }
  const explorationRatio = exploredCount / totalTiles

  if (explorationRatio < 0.3) {
    const mappingScroll = findMappingScroll(character)
    if (mappingScroll) {
      return { type: 'use', itemId: mappingScroll.id }
    }
  }

  return null
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
