/**
 * Spell Resolution System for Borglike
 *
 * Handles spell casting, damage calculation, and effect application.
 * Spells always succeed if you have mana (no failure chance).
 */

import type {
  GameState,
  Character,
  Monster,
  Point,
  StatusEffect,
  ActionResult,
  Minion,
  MinionType,
} from './types'
import { MINION_TEMPLATES } from './types'
import { randomInt, random } from './rng'
import { getSpellById, getSchoolStat, type SpellTemplate } from './data/spells'
import { getSpellIdsForLevel } from './data/class-spells'
import { applyDamage } from './combat'
import { handleMonsterKill } from './actions/combat'
import { getTile, findOpenPosition, isWalkable } from './dungeon'
import { addStatusEffect, addTempResistance } from './status-effects'
import { DEFAULT_BONUSES } from './upgrade-effects'

// SpellCastResult has been unified into ActionResult in types.ts

// ============================================================================
// SPELL AVAILABILITY
// ============================================================================

/**
 * Get all spells known by a character based on their class and level
 */
export function getKnownSpells(character: Character): string[] {
  return getSpellIdsForLevel(character.classId, character.level)
}

/**
 * Check if a character knows a specific spell
 */
export function knowsSpell(character: Character, spellId: string): boolean {
  const known = getKnownSpells(character)
  return known.includes(spellId)
}

/**
 * Check if a spell is on cooldown
 */
export function isOnCooldown(character: Character, spellId: string, currentTurn: number): boolean {
  const cooldownUntil = character.spellCooldowns[spellId]
  if (cooldownUntil === undefined) return false
  return currentTurn < cooldownUntil
}

/**
 * Get remaining cooldown turns for a spell
 */
export function getCooldownRemaining(
  character: Character,
  spellId: string,
  currentTurn: number
): number {
  const cooldownUntil = character.spellCooldowns[spellId]
  if (cooldownUntil === undefined) return 0
  return Math.max(0, cooldownUntil - currentTurn)
}

/**
 * Check if a character can cast a spell
 */
export function canCast(
  character: Character,
  spell: SpellTemplate,
  currentTurn: number
): { canCast: boolean; reason?: string } {
  // Check if character knows the spell
  if (!knowsSpell(character, spell.id)) {
    return { canCast: false, reason: 'You do not know this spell.' }
  }

  // Check mana
  if (character.mp < spell.manaCost) {
    return { canCast: false, reason: 'Not enough mana.' }
  }

  // Check cooldown
  if (isOnCooldown(character, spell.id, currentTurn)) {
    const remaining = getCooldownRemaining(character, spell.id, currentTurn)
    return { canCast: false, reason: `Spell on cooldown (${remaining} turns).` }
  }

  // Dark Pact special check - needs 10 HP to spare
  if (spell.id === 'dark_pact' && character.hp <= 10) {
    return { canCast: false, reason: 'Not enough HP to cast Dark Pact.' }
  }

  return { canCast: true }
}

/**
 * Get all spells a character can currently cast
 */
export function getAvailableSpells(
  character: Character,
  currentTurn: number
): { spell: SpellTemplate; canCast: boolean; reason?: string }[] {
  const known = getKnownSpells(character)
  return known.map((spellId) => {
    const spell = getSpellById(spellId)
    if (!spell) return { spell: undefined as unknown as SpellTemplate, canCast: false }
    const result = canCast(character, spell, currentTurn)
    return { spell, canCast: result.canCast, reason: result.reason }
  }).filter((entry) => entry.spell !== undefined)
}

// ============================================================================
// SPELL POWER CALCULATION
// ============================================================================

/**
 * Roll dice from notation like "2d6"
 */
function rollDice(notation: string): number {
  const match = notation.match(/(\d+)d(\d+)/)
  if (!match || !match[1] || !match[2]) return 0
  const numDice = parseInt(match[1], 10)
  const sides = parseInt(match[2], 10)
  let total = 0
  for (let i = 0; i < numDice; i++) {
    total += randomInt(1, sides)
  }
  return total
}

/**
 * Calculate spell power (damage or heal) based on character stats
 * Formula: basePower + (primaryStat - 10) * scaling + level * scaling/3
 */
export function calculateSpellPower(
  character: Character,
  spell: SpellTemplate,
  isHeal: boolean = false
): number {
  // Roll base damage/heal
  const baseNotation = isHeal ? spell.baseHeal : spell.baseDamage
  if (!baseNotation) return 0

  const basePower = rollDice(baseNotation)

  // Get scaling factor
  const scaling = isHeal ? (spell.healScaling ?? 1) : (spell.damageScaling ?? 1)

  // Get primary stat for this spell school
  const statKey = getSchoolStat(spell.school)
  const statValue = character.stats[statKey]

  // Calculate bonus from stat (every 2 points above 10)
  const statBonus = Math.floor((statValue - 10) / 2) * scaling

  // Calculate bonus from level (level / 3)
  const levelBonus = Math.floor(character.level / 3) * scaling

  return Math.max(1, basePower + statBonus + levelBonus)
}

// ============================================================================
// TARGET SELECTION
// ============================================================================

/**
 * Select up to N nearest visible monsters for AOE spells
 */
export function selectAOETargets(
  game: GameState,
  maxTargets: number
): Monster[] {
  const charPos = game.character.position

  // Get all visible monsters
  const visibleMonsters = game.monsters.filter((monster) => {
    const tile = getTile(game.currentLevel, monster.position.x, monster.position.y)
    return tile?.visible && monster.hp > 0
  })

  if (visibleMonsters.length === 0) return []

  // Sort by distance (nearest first)
  visibleMonsters.sort((a, b) => {
    const distA = Math.abs(a.position.x - charPos.x) + Math.abs(a.position.y - charPos.y)
    const distB = Math.abs(b.position.x - charPos.x) + Math.abs(b.position.y - charPos.y)
    return distA - distB
  })

  // Return up to maxTargets
  return visibleMonsters.slice(0, maxTargets)
}

/**
 * Find a valid target monster by ID
 */
export function findTarget(game: GameState, targetId: string): Monster | null {
  const monster = game.monsters.find((m) => m.id === targetId && m.hp > 0)
  if (!monster) return null

  // Check if visible
  const tile = getTile(game.currentLevel, monster.position.x, monster.position.y)
  if (!tile?.visible) return null

  return monster
}

/**
 * Get the nearest visible monster
 */
export function getNearestVisibleMonster(game: GameState): Monster | null {
  const charPos = game.character.position

  const visibleMonsters = game.monsters.filter((monster) => {
    const tile = getTile(game.currentLevel, monster.position.x, monster.position.y)
    return tile?.visible && monster.hp > 0
  })

  if (visibleMonsters.length === 0) return null

  let nearest: Monster | null = null
  let nearestDist = Infinity

  for (const monster of visibleMonsters) {
    const dist = Math.abs(monster.position.x - charPos.x) + Math.abs(monster.position.y - charPos.y)
    if (dist < nearestDist) {
      nearestDist = dist
      nearest = monster
    }
  }

  return nearest
}

// ============================================================================
// BEAM MECHANICS
// ============================================================================

/**
 * Calculate chance for a bolt spell to become a beam
 *
 * Angband-inspired formula:
 * - Base chance: (caster_level - spell_level + 5) * 2%
 * - Mages/Archmages get +20% bonus
 * - Capped at 75%
 *
 * @param characterLevel - Caster's level
 * @param spellLevel - Spell's required level
 * @param classId - Caster's class
 * @returns Beam chance as percentage (0-75)
 */
export function calculateBeamChance(
  characterLevel: number,
  spellLevel: number,
  classId: string
): number {
  const levelDiff = characterLevel - spellLevel + 5
  let chance = levelDiff * 2

  // Mages and Archmages get bonus beam chance
  if (classId === 'mage' || classId === 'archmage') {
    chance += 20
  }

  return Math.min(75, Math.max(0, chance))
}

/**
 * Find all monsters in a line from origin through target and beyond
 * Uses Bresenham's line algorithm
 *
 * @param game - Game state
 * @param origin - Starting point (caster position)
 * @param target - Target point (primary target position)
 * @returns Array of monsters hit by the beam, in order
 */
export function findMonstersInBeam(
  game: GameState,
  origin: Point,
  target: Point
): Monster[] {
  const hitMonsters: Monster[] = []

  // Calculate direction vector
  const dx = target.x - origin.x
  const dy = target.y - origin.y
  const distance = Math.max(Math.abs(dx), Math.abs(dy))

  if (distance === 0) return hitMonsters

  // Normalize direction
  const stepX = dx / distance
  const stepY = dy / distance

  // Trace beam for up to 12 tiles (typical spell range)
  const maxRange = 12
  for (let i = 1; i <= maxRange; i++) {
    const checkX = Math.round(origin.x + stepX * i)
    const checkY = Math.round(origin.y + stepY * i)

    // Check for wall (stops beam)
    const tile = getTile(game.currentLevel, checkX, checkY)
    if (!tile || tile.type === 'wall' || tile.type === 'door_closed') {
      break
    }

    // Check for monster at this position
    const monster = game.monsters.find(
      (m) => m.position.x === checkX && m.position.y === checkY && m.hp > 0
    )
    if (monster) {
      hitMonsters.push(monster)
    }
  }

  return hitMonsters
}

// ============================================================================
// TELEPORTATION
// ============================================================================

/**
 * Find a valid teleport destination
 */
export function findTeleportDestination(
  game: GameState,
  range: number
): Point {
  const charPos = game.character.position

  if (range === 0) {
    // Full teleport - anywhere on level
    return findOpenPosition(game.currentLevel)
  }

  // Phase door - limited range
  const attempts = 50
  for (let i = 0; i < attempts; i++) {
    const dx = randomInt(-range, range)
    const dy = randomInt(-range, range)
    const newX = charPos.x + dx
    const newY = charPos.y + dy

    const tile = getTile(game.currentLevel, newX, newY)
    if (tile && isWalkable(tile)) {
      const dist = Math.abs(dx) + Math.abs(dy)
      if (dist >= 2 && dist <= range) {
        // Check no monster at destination
        const monsterAtDest = game.monsters.find(
          (m) => m.position.x === newX && m.position.y === newY
        )
        if (!monsterAtDest) {
          return { x: newX, y: newY }
        }
      }
    }
  }

  // Fallback to random position
  return findOpenPosition(game.currentLevel)
}

// ============================================================================
// SPELL CASTING
// ============================================================================

/**
 * Cast a spell and apply its effects
 *
 * @param game - Current game state (mutated)
 * @param spellId - ID of spell to cast
 * @param targetId - Optional target monster ID (for single-target spells)
 * @returns Result of the spell cast
 */
export function castSpell(
  game: GameState,
  spellId: string,
  targetId?: string
): ActionResult {
  const spell = getSpellById(spellId)
  if (!spell) {
    return { success: false, message: 'Unknown spell.' }
  }

  const character = game.character

  // Check if can cast
  const castCheck = canCast(character, spell, game.turn)
  if (!castCheck.canCast) {
    return { success: false, message: castCheck.reason || 'Cannot cast spell.' }
  }

  // Deduct mana
  character.mp -= spell.manaCost

  // Apply cooldown
  if (spell.cooldown > 0) {
    character.spellCooldowns[spellId] = game.turn + spell.cooldown
  }

  // Handle Dark Pact HP cost
  if (spell.id === 'dark_pact') {
    character.hp -= 10
  }

  // Execute effect based on type
  switch (spell.effectType) {
    case 'damage':
      return castDamageSpell(game, spell, targetId)

    case 'aoe_damage':
      return castAOEDamageSpell(game, spell)

    case 'heal':
      return castHealSpell(game, spell)

    case 'buff':
      return castBuffSpell(game, spell)

    case 'debuff':
      return castDebuffSpell(game, spell, targetId)

    case 'lifedrain':
      return castLifedrainSpell(game, spell, targetId)

    case 'teleport':
      return castTeleportSpell(game, spell)

    case 'summon':
      return castSummonSpell(game, spell)

    default:
      return { success: false, message: 'Unknown spell effect.' }
  }
}

// ============================================================================
// SPELL EFFECT HANDLERS
// ============================================================================

/**
 * Cast a single-target damage spell (may become beam at higher levels)
 */
function castDamageSpell(
  game: GameState,
  spell: SpellTemplate,
  targetId?: string
): ActionResult {
  // Find primary target
  let target: Monster | null = null
  if (targetId) {
    target = findTarget(game, targetId)
  } else {
    target = getNearestVisibleMonster(game)
  }

  if (!target) {
    return { success: true, message: `You cast ${spell.name}, but there are no targets.` }
  }

  // Check if spell becomes a beam
  let isBeam = false
  let beamTargets: Monster[] = []

  if (spell.canBeam) {
    const beamChance = calculateBeamChance(
      game.character.level,
      spell.level,
      game.character.classId
    )
    if (random() * 100 < beamChance) {
      isBeam = true
      beamTargets = findMonstersInBeam(game, game.character.position, target.position)
    }
  }

  // Calculate base damage
  let baseDamage = calculateSpellPower(game.character, spell, false)

  // Apply Might upgrade bonus to spell damage
  const bonuses = game.character.upgradeBonuses ?? DEFAULT_BONUSES
  baseDamage = Math.floor(baseDamage * (1 + bonuses.damagePercent / 100))

  if (isBeam && beamTargets.length > 1) {
    // Beam hits multiple targets
    return castBeamSpell(game, spell, baseDamage, beamTargets)
  }

  // Single target (normal bolt or beam that only hit one target)
  let damage = baseDamage

  // Double vs evil if applicable
  if (spell.doubleVsEvil && target.template.flags.includes('EVIL')) {
    damage *= 2
  }

  // Apply debuff if spell has one
  if (spell.debuff) {
    applyMonsterDebuff(target, spell.debuff.type, spell.debuff.value, spell.debuff.duration)
  }

  // Apply damage
  const killed = applyDamage(target, damage)

  // Update stats
  game.stats.damageDealt += damage

  if (killed) {
    handleMonsterKill(game, target)
  }

  const killedStr = killed ? ' It dies!' : ''
  return {
    success: true,
    message: `You cast ${spell.name} at ${target.template.name} for ${damage} damage.${killedStr}`,
    damage,
    targets: [target.id],
    events: [{
      type: 'attack',
      attackerId: game.character.id,
      defenderId: target.id,
      damage,
      killed,
    }],
  }
}

/**
 * Apply beam spell damage to multiple targets in a line
 */
function castBeamSpell(
  game: GameState,
  spell: SpellTemplate,
  baseDamage: number,
  targets: Monster[]
): ActionResult {
  let totalDamage = 0
  let killedCount = 0
  const targetIds: string[] = []
  const targetNames: string[] = []
  const events: ActionResult['events'] = []

  for (const target of targets) {
    let damage = baseDamage

    // Double vs evil if applicable
    if (spell.doubleVsEvil && target.template.flags.includes('EVIL')) {
      damage *= 2
    }

    // Apply debuff if spell has one
    if (spell.debuff) {
      applyMonsterDebuff(target, spell.debuff.type, spell.debuff.value, spell.debuff.duration)
    }

    // Apply damage
    const killed = applyDamage(target, damage)
    totalDamage += damage
    targetIds.push(target.id)
    targetNames.push(target.template.name)

    events.push({
      type: 'attack',
      attackerId: game.character.id,
      defenderId: target.id,
      damage,
      killed,
    })

    if (killed) {
      handleMonsterKill(game, target)
      killedCount++
    }
  }

  game.stats.damageDealt += totalDamage

  const killedStr = killedCount > 0 ? ` ${killedCount} killed!` : ''
  return {
    success: true,
    message: `Your ${spell.name} beams through ${targets.length} enemies for ${totalDamage} total damage!${killedStr}`,
    damage: totalDamage,
    targets: targetIds,
    events,
  }
}

/**
 * Cast an AOE damage spell
 */
function castAOEDamageSpell(game: GameState, spell: SpellTemplate): ActionResult {
  const maxTargets = spell.maxTargets ?? 3
  const targets = selectAOETargets(game, maxTargets)

  if (targets.length === 0) {
    return { success: true, message: `You cast ${spell.name}, but there are no targets.` }
  }

  let totalDamage = 0
  let killedCount = 0
  const targetIds: string[] = []
  const targetNames: string[] = []
  const events: ActionResult['events'] = []

  // Calculate base damage (same for all targets)
  let baseDamage = calculateSpellPower(game.character, spell, false)

  // Apply Might upgrade bonus to spell damage
  const bonuses = game.character.upgradeBonuses ?? DEFAULT_BONUSES
  baseDamage = Math.floor(baseDamage * (1 + bonuses.damagePercent / 100))

  for (const target of targets) {
    let damage = baseDamage

    // Double vs evil if applicable
    if (spell.doubleVsEvil && target.template.flags.includes('EVIL')) {
      damage *= 2
    }

    // Apply damage
    const killed = applyDamage(target, damage)
    totalDamage += damage
    targetIds.push(target.id)
    targetNames.push(target.template.name)

    // Emit attack event for this target
    events.push({
      type: 'attack',
      attackerId: game.character.id,
      defenderId: target.id,
      damage,
      killed,
    })

    if (killed) {
      handleMonsterKill(game, target)
      killedCount++
    }
  }

  game.stats.damageDealt += totalDamage

  // If spell has drain, heal
  if (spell.drainPercent) {
    const healAmount = Math.floor(totalDamage * spell.drainPercent / 100)
    game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
  }

  const killedStr = killedCount > 0 ? ` ${killedCount} killed!` : ''
  return {
    success: true,
    message: `You cast ${spell.name} hitting ${targets.length} enemies for ${totalDamage} total damage.${killedStr}`,
    damage: totalDamage,
    targets: targetIds,
    events,
  }
}

/**
 * Cast a healing spell
 */
function castHealSpell(game: GameState, spell: SpellTemplate): ActionResult {
  const healAmount = calculateSpellPower(game.character, spell, true)
  const oldHp = game.character.hp

  game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
  const actualHeal = game.character.hp - oldHp

  // Cure poison if applicable
  if (spell.curesPoison && game.character.poison) {
    game.character.poison = null
  }

  const poisonStr = spell.curesPoison && game.character.poison === null ? ' Poison cured!' : ''
  return {
    success: true,
    message: `You cast ${spell.name} and heal ${actualHeal} HP.${poisonStr}`,
    healed: actualHeal,
  }
}

/**
 * Cast a buff spell
 */
function castBuffSpell(game: GameState, spell: SpellTemplate): ActionResult {
  if (!spell.buff) {
    return { success: true, message: `You cast ${spell.name}.` }
  }

  // Handle resist_elements specially
  if (spell.id === 'resist_elements') {
    // Grant fire and cold resistance
    addTempResistance(game.character, { type: 'FIRE', turnsRemaining: 30, value: 50 })
    addTempResistance(game.character, { type: 'COLD', turnsRemaining: 30, value: 50 })
    return {
      success: true,
      message: 'You cast Resist Elements. You feel protected from fire and cold!',
    }
  }

  // Standard buff
  const buffType = spell.buff.type as StatusEffect['type']
  addStatusEffect(game.character, {
    type: buffType,
    turnsRemaining: spell.buff.duration,
    value: spell.buff.value,
  })

  return {
    success: true,
    message: `You cast ${spell.name}. ${getBuffMessage(spell.buff.type)}`,
  }
}

/**
 * Cast a debuff spell
 */
function castDebuffSpell(
  game: GameState,
  spell: SpellTemplate,
  targetId?: string
): ActionResult {
  if (!spell.debuff) {
    return { success: true, message: `You cast ${spell.name}.` }
  }

  // Find target
  let target: Monster | null = null
  if (targetId) {
    target = findTarget(game, targetId)
  } else {
    target = getNearestVisibleMonster(game)
  }

  if (!target) {
    return { success: true, message: `You cast ${spell.name}, but there are no targets.` }
  }

  applyMonsterDebuff(target, spell.debuff.type, spell.debuff.value, spell.debuff.duration)

  return {
    success: true,
    message: `You cast ${spell.name} on ${target.template.name}. ${getDebuffMessage(spell.debuff.type)}`,
    targets: [target.id],
  }
}

/**
 * Cast a lifedrain spell
 */
function castLifedrainSpell(
  game: GameState,
  spell: SpellTemplate,
  targetId?: string
): ActionResult {
  // Find target
  let target: Monster | null = null
  if (targetId) {
    target = findTarget(game, targetId)
  } else {
    target = getNearestVisibleMonster(game)
  }

  if (!target) {
    return { success: true, message: `You cast ${spell.name}, but there are no targets.` }
  }

  // Calculate damage
  let damage = calculateSpellPower(game.character, spell, false)

  // Apply Might upgrade bonus to spell damage
  const bonuses = game.character.upgradeBonuses ?? DEFAULT_BONUSES
  damage = Math.floor(damage * (1 + bonuses.damagePercent / 100))

  // Apply damage
  const killed = applyDamage(target, damage)
  game.stats.damageDealt += damage

  // Heal based on drain percent
  const drainPercent = spell.drainPercent ?? 50
  const healAmount = Math.floor(damage * drainPercent / 100)
  const oldHp = game.character.hp
  game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)
  const actualHeal = game.character.hp - oldHp

  if (killed) {
    handleMonsterKill(game, target)
  }

  const killedStr = killed ? ' It dies!' : ''
  return {
    success: true,
    message: `You cast ${spell.name} on ${target.template.name} for ${damage} damage, healing ${actualHeal} HP.${killedStr}`,
    damage,
    healed: actualHeal,
    targets: [target.id],
    events: [{
      type: 'attack',
      attackerId: game.character.id,
      defenderId: target.id,
      damage,
      killed,
    }],
  }
}

/**
 * Cast a teleport spell
 */
function castTeleportSpell(game: GameState, spell: SpellTemplate): ActionResult {
  const range = spell.teleportRange ?? 0
  const destination = findTeleportDestination(game, range)

  game.character.position = destination

  const rangeStr = range === 0 ? '' : ' a short distance'
  return {
    success: true,
    message: `You cast ${spell.name} and teleport${rangeStr}!`,
  }
}

/**
 * Cast a summon spell to create a minion
 */
function castSummonSpell(game: GameState, spell: SpellTemplate): ActionResult {
  // Determine minion type from spell
  let minionType: MinionType
  if (spell.id === 'summon_wolf') {
    minionType = 'wolf'
  } else if (spell.id === 'summon_skeleton') {
    minionType = 'skeleton'
  } else {
    return { success: false, message: 'Unknown summon spell.' }
  }

  const template = MINION_TEMPLATES[minionType]

  // Calculate scaled HP for minions that scale with level
  // Wolf: 30 base + 2 per level (32 at L1, 70 at L20)
  // Skeleton: 20 base + 2 per level (22 at L1, 60 at L20)
  const scaledMaxHp = (minionType === 'wolf' || minionType === 'skeleton')
    ? template.maxHp + game.character.level * 2
    : template.maxHp

  // For permanent pets (wolf), check if one already exists
  if (template.permanent) {
    const existingPet = game.minions.find(m => m.type === minionType)
    if (existingPet && existingPet.hp > 0) {
      // Update maxHp in case character leveled up, then heal to full
      existingPet.maxHp = scaledMaxHp
      const oldHp = existingPet.hp
      existingPet.hp = existingPet.maxHp
      const healed = existingPet.hp - oldHp
      return {
        success: true,
        message: `Your ${template.name} is restored to full health! (+${healed} HP)`,
      }
    }
  }

  // For temporary summons, check limit (max 2)
  if (!template.permanent) {
    const existingSummons = game.minions.filter(m => !MINION_TEMPLATES[m.type].permanent)
    if (existingSummons.length >= 2) {
      // Replace oldest summon
      const oldest = existingSummons[0]
      if (oldest) {
        const idx = game.minions.indexOf(oldest)
        if (idx >= 0) game.minions.splice(idx, 1)
      }
    }
  }

  // Find spawn position (adjacent to player)
  const spawnPos = findMinionSpawnPosition(game)
  if (!spawnPos) {
    return { success: false, message: 'No room to summon!' }
  }

  // Create the minion with scaled HP
  const minion: Minion = {
    id: `minion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type: minionType,
    name: template.name,
    hp: scaledMaxHp,
    maxHp: scaledMaxHp,
    position: spawnPos,
    damage: template.damage,
    energy: 0,
    permanent: template.permanent,
    turnsRemaining: template.duration,
  }

  game.minions.push(minion)

  const durationStr = template.permanent ? '' : ` (${template.duration} turns)`
  return {
    success: true,
    message: `You summon a ${template.name}!${durationStr}`,
  }
}

/**
 * Find a valid spawn position for a minion (adjacent to player)
 */
function findMinionSpawnPosition(game: GameState): Point | null {
  const charPos = game.character.position
  const directions = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 }, { dx: -1, dy: -1 },
  ]

  for (const dir of directions) {
    const x = charPos.x + dir.dx
    const y = charPos.y + dir.dy

    const tile = getTile(game.currentLevel, x, y)
    if (!tile || !isWalkable(tile)) continue

    // Check no monster at position
    const hasMonster = game.monsters.some(m => m.position.x === x && m.position.y === y)
    if (hasMonster) continue

    // Check no minion at position
    const hasMinion = game.minions.some(m => m.position.x === x && m.position.y === y)
    if (hasMinion) continue

    return { x, y }
  }

  return null
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Apply a debuff to a monster
 * Replaces existing debuff of the same type
 */
function applyMonsterDebuff(
  monster: Monster,
  type: string,
  value: number,
  duration: number
): void {
  const debuffType = type as 'slow' | 'weaken' | 'blind'

  // Remove existing debuff of same type
  monster.debuffs = monster.debuffs.filter(d => d.type !== debuffType)

  // Add new debuff
  monster.debuffs.push({
    type: debuffType,
    turnsRemaining: duration,
    value,
  })
}

/**
 * Get flavor message for a buff type
 */
function getBuffMessage(buffType: string): string {
  switch (buffType) {
    case 'blessing':
      return 'You feel righteous!'
    case 'protection':
      return 'You feel protected!'
    case 'speed':
      return 'You feel fast!'
    case 'heroism':
      return 'You feel heroic!'
    case 'damage_bonus':
      return 'You feel powerful!'
    case 'ac_bonus':
      return 'You feel shielded!'
    default:
      return 'You feel enhanced!'
  }
}

/**
 * Get flavor message for a debuff type
 */
function getDebuffMessage(debuffType: string): string {
  switch (debuffType) {
    case 'slow':
      return 'It is slowed!'
    case 'weaken':
      return 'It is weakened!'
    case 'blind':
      return 'It is blinded!'
    default:
      return 'It is afflicted!'
  }
}
