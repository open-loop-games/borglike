/**
 * Monster Spawning and AI
 *
 * Handles monster spawning, AI decision making, detection, movement,
 * and the speed/energy system for turn-based combat.
 */

import type { Monster, Point, DungeonLevel, GameState, GameAction, MonsterTemplate } from './types'
import { MAX_DEPTH, getDirectionFromDelta } from './types'
import { getSpawnableMonsters, getMonsterByName } from './data/index'
import {
  findPath,
  findOpenPositions,
  isWalkable,
  getTile,
  getAdjacentPositions,
  distance,
} from './dungeon'

/** Victory boss name */
const VICTORY_BOSS_NAME = 'Morgoth, Lord of Darkness'

// ============================================================================
// UNIQUE ID GENERATION
// ============================================================================

let monsterIdCounter = 0

/**
 * Generate a unique monster ID
 */
function generateMonsterId(): string {
  return `monster_${++monsterIdCounter}`
}

/**
 * Reset the monster ID counter (useful for testing)
 */
export function resetMonsterIdCounter(): void {
  monsterIdCounter = 0
}

// ============================================================================
// MONSTER SPAWNING
// ============================================================================

/**
 * Spawn a monster from a template at a given position
 *
 * @param template - The monster template to spawn from
 * @param position - The position to spawn the monster at
 * @returns A new Monster instance
 */
export function spawnMonster(template: MonsterTemplate, position: Point): Monster {
  return {
    id: generateMonsterId(),
    template,
    hp: template.hp,
    maxHp: template.hp,
    position: { ...position },
    energy: 0,
    isAwake: false,
    seen: false,
  }
}

/**
 * Spawn monsters for a dungeon level based on depth
 *
 * Monster count scales with depth: 5 + floor(depth / 2)
 * Monsters are placed at random open positions, avoiding stairs.
 *
 * @param level - The dungeon level to spawn monsters on
 * @param depth - The dungeon depth (affects monster count and types)
 * @returns Array of spawned monsters
 */
export function spawnMonstersForLevel(level: DungeonLevel, depth: number): Monster[] {
  const monsters: Monster[] = []
  const monsterCount = 5 + Math.floor(depth / 2)

  // Get available monster templates for this depth
  const templates = getSpawnableMonsters(depth)
  if (templates.length === 0) {
    return monsters
  }

  // Find open positions, excluding stairs
  const allOpenPositions = findOpenPositions(level, monsterCount + 10)
  const validPositions = allOpenPositions.filter((pos) => {
    const tile = getTile(level, pos.x, pos.y)
    if (!tile) return false
    // Exclude stair tiles
    return tile.type !== 'stairs_up' && tile.type !== 'stairs_down'
  })

  // Spawn monsters at available positions
  const spawnCount = Math.min(monsterCount, validPositions.length)
  for (let i = 0; i < spawnCount; i++) {
    // Pick a random template (weighted toward common monsters at depth)
    const template = pickRandomTemplate(templates)
    const pos = validPositions[i]
    if (template && pos) {
      const monster = spawnMonster(template, pos)
      monsters.push(monster)
    }
  }

  // Spawn boss on max depth
  if (depth === MAX_DEPTH) {
    const bossTemplate = getMonsterByName(VICTORY_BOSS_NAME)
    if (bossTemplate) {
      const bossPos = findOpenPositions(level, 1)[0]
      if (bossPos) {
        const boss = spawnMonster(bossTemplate, bossPos)
        monsters.push(boss)
      }
    }
  }

  return monsters
}

/**
 * Pick a random monster template, weighted by depth appropriateness
 *
 * @param templates - Available templates to choose from
 * @returns A randomly selected template
 */
function pickRandomTemplate(templates: MonsterTemplate[]): MonsterTemplate | null {
  if (templates.length === 0) return null
  // Simple random selection for now
  // Could be weighted by rarity/depth in the future
  const index = Math.floor(Math.random() * templates.length)
  const template = templates[index]
  return template !== undefined ? template : null
}

// ============================================================================
// DETECTION & AWARENESS
// ============================================================================

/**
 * Check if a monster can see/detect the player
 *
 * Uses distance check based on monster's hearing range (derived from template).
 * Also performs a simple line-of-sight check.
 *
 * @param monster - The monster checking detection
 * @param playerPos - The player's position
 * @param level - The dungeon level
 * @returns True if the monster can detect the player
 */
export function canSeePlayer(monster: Monster, playerPos: Point, level: DungeonLevel): boolean {
  // Base detection range from monster speed (faster = more alert)
  // Normal speed (110) gives range of 8, faster monsters see further
  const baseRange = Math.floor(monster.template.speed / 10) - 3
  const detectionRange = Math.max(5, baseRange)

  // Check distance first (hearing)
  const dist = distance(monster.position, playerPos)
  if (dist > detectionRange) {
    return false
  }

  // Perform line-of-sight check using Bresenham's algorithm
  return hasLineOfSight(monster.position, playerPos, level)
}

/**
 * Check line of sight between two points using Bresenham's algorithm
 *
 * @param from - Starting position
 * @param to - Target position
 * @param level - The dungeon level
 * @returns True if there's a clear line of sight
 */
function hasLineOfSight(from: Point, to: Point, level: DungeonLevel): boolean {
  let x0 = from.x
  let y0 = from.y
  const x1 = to.x
  const y1 = to.y

  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    // Don't check the start or end positions for blocking
    if ((x0 !== from.x || y0 !== from.y) && (x0 !== to.x || y0 !== to.y)) {
      const tile = getTile(level, x0, y0)
      if (!tile || tile.type === 'wall' || tile.type === 'door_closed') {
        return false
      }
    }

    if (x0 === x1 && y0 === y1) break

    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (e2 < dx) {
      err += dx
      y0 += sy
    }
  }

  return true
}

/**
 * Wake nearby monsters when the player makes noise (combat, etc.)
 *
 * @param monsters - All monsters on the level
 * @param playerPos - The player's position
 * @param radius - The noise radius
 */
export function wakeNearbyMonsters(monsters: Monster[], playerPos: Point, radius: number): void {
  for (const monster of monsters) {
    if (!monster.isAwake) {
      const dist = distance(monster.position, playerPos)
      if (dist <= radius) {
        monster.isAwake = true
      }
    }
  }
}

// ============================================================================
// AI DECISION MAKING
// ============================================================================

/**
 * Decide what action a monster should take
 *
 * Decision priority:
 * 1. If asleep and player in detection range, wake up
 * 2. If adjacent to player, attack
 * 3. If can see player, move toward player
 * 4. Otherwise, wander randomly
 *
 * @param monster - The monster making a decision
 * @param game - The current game state
 * @returns The action to take, or null to wait
 */
export function decideAction(monster: Monster, game: GameState): GameAction | null {
  const playerPos = game.character.position

  // If asleep, check if we should wake up
  if (!monster.isAwake) {
    if (canSeePlayer(monster, playerPos, game.currentLevel)) {
      monster.isAwake = true
    } else {
      return null // Stay asleep
    }
  }

  // Check if adjacent to player (can attack)
  if (isAdjacentTo(monster.position, playerPos)) {
    return { type: 'attack', targetId: game.character.id }
  }

  // Try to move toward player if we can see them
  if (canSeePlayer(monster, playerPos, game.currentLevel)) {
    const movePos = findMoveTowardPlayer(monster, playerPos, game.currentLevel, game.monsters)
    if (movePos) {
      const direction = getDirectionToward(monster.position, movePos)
      if (direction) {
        return { type: 'move', direction }
      }
    }
  }

  // Wander randomly
  const randomMove = findRandomMove(monster, game.currentLevel, game.monsters)
  if (randomMove) {
    const direction = getDirectionToward(monster.position, randomMove)
    if (direction) {
      return { type: 'move', direction }
    }
  }

  // No valid action, wait
  return { type: 'wait' }
}

/**
 * Check if two positions are adjacent (including diagonals)
 *
 * @param a - First position
 * @param b - Second position
 * @returns True if adjacent
 */
function isAdjacentTo(a: Point, b: Point): boolean {
  const dx = Math.abs(a.x - b.x)
  const dy = Math.abs(a.y - b.y)
  return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0)
}

/**
 * Get the direction from one point toward another
 *
 * @param from - Starting position
 * @param to - Target position
 * @returns The direction, or null if same position
 */
function getDirectionToward(
  from: Point,
  to: Point
): 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null {
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (dx === 0 && dy === 0) return null

  // Normalize to -1, 0, or 1
  const nx = dx === 0 ? 0 : dx > 0 ? 1 : -1
  const ny = dy === 0 ? 0 : dy > 0 ? 1 : -1

  // Use shared utility function (excludes 'wait' from possible returns)
  const dir = getDirectionFromDelta(nx, ny)
  return dir === 'wait' ? null : dir
}

// ============================================================================
// MOVEMENT
// ============================================================================

/**
 * Find the next move position toward the player
 *
 * Uses A* pathfinding but avoids tiles occupied by other monsters.
 *
 * @param monster - The monster looking to move
 * @param playerPos - The player's position
 * @param level - The dungeon level
 * @param monsters - All monsters (to avoid collisions)
 * @returns The next position to move to, or null if no path
 */
export function findMoveTowardPlayer(
  monster: Monster,
  playerPos: Point,
  level: DungeonLevel,
  monsters: Monster[]
): Point | null {
  // Get the full path
  const path = findPath(level, monster.position, playerPos)

  // Path includes start position, so we want the second element
  if (path.length < 2) {
    return null
  }

  const nextPos: Point | undefined = path[1]
  if (!nextPos) return null

  // Check if another monster is occupying that position
  const blocked = monsters.some(
    (m) => m.id !== monster.id && m.position.x === nextPos!.x && m.position.y === nextPos!.y
  )

  if (blocked) {
    // Try to find an alternative adjacent move that gets us closer
    return findAlternativeMove(monster, playerPos, level, monsters) ?? null
  }

  return nextPos!
}

/**
 * Find an alternative move when the primary path is blocked
 *
 * @param monster - The monster looking to move
 * @param playerPos - The player's position
 * @param level - The dungeon level
 * @param monsters - All monsters (to avoid collisions)
 * @returns An alternative position, or null
 */
function findAlternativeMove(
  monster: Monster,
  playerPos: Point,
  level: DungeonLevel,
  monsters: Monster[]
): Point | null {
  const adjacent = getAdjacentPositions(monster.position)
  const currentDist = distance(monster.position, playerPos)

  // Find walkable, unoccupied positions that get us closer
  const validMoves = adjacent.filter((pos) => {
    const tile = getTile(level, pos.x, pos.y)
    if (!tile || !isWalkable(tile)) return false

    // Check for monster collision
    const occupied = monsters.some(
      (m) => m.id !== monster.id && m.position.x === pos.x && m.position.y === pos.y
    )
    if (occupied) return false

    // Must get us closer to the player
    return distance(pos, playerPos) < currentDist
  })

  if (validMoves.length === 0) return null

  // Pick the one that gets us closest
  validMoves.sort((a, b) => distance(a, playerPos) - distance(b, playerPos))
  return validMoves[0] ?? null
}

/**
 * Find a random adjacent walkable tile for wandering
 *
 * @param monster - The monster looking to wander
 * @param level - The dungeon level
 * @param monsters - All monsters (to avoid collisions)
 * @returns A random walkable position, or null if none available
 */
export function findRandomMove(
  monster: Monster,
  level: DungeonLevel,
  monsters: Monster[]
): Point | null {
  const adjacent = getAdjacentPositions(monster.position)

  // Filter to walkable, unoccupied positions
  const validMoves = adjacent.filter((pos) => {
    const tile = getTile(level, pos.x, pos.y)
    if (!tile || !isWalkable(tile)) return false

    // Check for monster collision
    const occupied = monsters.some(
      (m) => m.id !== monster.id && m.position.x === pos.x && m.position.y === pos.y
    )
    return !occupied
  })

  if (validMoves.length === 0) return null

  // Pick a random valid move
  const index = Math.floor(Math.random() * validMoves.length)
  return validMoves[index] ?? null
}

// ============================================================================
// SPEED/ENERGY SYSTEM
// ============================================================================

/**
 * Base energy threshold for taking an action
 */
const ENERGY_THRESHOLD = 100

/**
 * Update a monster's energy based on its speed
 *
 * Energy accumulates each game turn based on the monster's speed.
 * When energy reaches the threshold (100), the monster can act.
 *
 * Speed values:
 * - 100 = slow (gains 100 energy per turn, acts every turn at threshold)
 * - 110 = normal (gains 110 energy per turn)
 * - 120 = fast (gains 120 energy per turn, sometimes acts twice)
 *
 * @param monster - The monster to update
 * @returns True if the monster has enough energy to act
 */
export function updateMonsterEnergy(monster: Monster): boolean {
  monster.energy += monster.template.speed

  if (monster.energy >= ENERGY_THRESHOLD) {
    monster.energy -= ENERGY_THRESHOLD
    return true
  }

  return false
}

/**
 * Reset a monster's energy (e.g., after spawning or special effects)
 *
 * @param monster - The monster to reset
 */
export function resetMonsterEnergy(monster: Monster): void {
  monster.energy = 0
}

/**
 * Check if a monster can currently act (has enough energy)
 *
 * @param monster - The monster to check
 * @returns True if the monster has enough energy
 */
export function canMonsterAct(monster: Monster): boolean {
  return monster.energy >= ENERGY_THRESHOLD
}
