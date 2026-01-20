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
  TempResistance,
} from './types'
import { getSpellById, getSchoolStat, type SpellTemplate } from './data/spells'
import { getSpellIdsForLevel } from './data/class-spells'
import { applyDamage } from './combat'
import { getTile, findOpenPosition, isWalkable } from './dungeon'

// ============================================================================
// TYPES
// ============================================================================

export interface SpellCastResult {
  success: boolean
  message: string
  damage?: number
  healed?: number
  targets?: string[] // monster IDs affected
}

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
    total += Math.floor(Math.random() * sides) + 1
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
    const dx = Math.floor(Math.random() * (range * 2 + 1)) - range
    const dy = Math.floor(Math.random() * (range * 2 + 1)) - range
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
): SpellCastResult {
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

    default:
      return { success: false, message: 'Unknown spell effect.' }
  }
}

// ============================================================================
// SPELL EFFECT HANDLERS
// ============================================================================

/**
 * Cast a single-target damage spell
 */
function castDamageSpell(
  game: GameState,
  spell: SpellTemplate,
  targetId?: string
): SpellCastResult {
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
    // Remove monster
    const idx = game.monsters.indexOf(target)
    if (idx >= 0) game.monsters.splice(idx, 1)
    game.stats.kills++

    // Track monster kill by name for bestiary
    const monsterName = target.template.name
    game.stats.monsterKills[monsterName] = (game.stats.monsterKills[monsterName] || 0) + 1
  }

  const killedStr = killed ? ' It dies!' : ''
  return {
    success: true,
    message: `You cast ${spell.name} at ${target.template.name} for ${damage} damage.${killedStr}`,
    damage,
    targets: [target.id],
  }
}

/**
 * Cast an AOE damage spell
 */
function castAOEDamageSpell(game: GameState, spell: SpellTemplate): SpellCastResult {
  const maxTargets = spell.maxTargets ?? 3
  const targets = selectAOETargets(game, maxTargets)

  if (targets.length === 0) {
    return { success: true, message: `You cast ${spell.name}, but there are no targets.` }
  }

  let totalDamage = 0
  let killedCount = 0
  const targetIds: string[] = []
  const targetNames: string[] = []

  // Calculate base damage (same for all targets)
  const baseDamage = calculateSpellPower(game.character, spell, false)

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

    if (killed) {
      const idx = game.monsters.indexOf(target)
      if (idx >= 0) game.monsters.splice(idx, 1)
      killedCount++
      game.stats.kills++

      // Track monster kill by name for bestiary
      const monsterName = target.template.name
      game.stats.monsterKills[monsterName] = (game.stats.monsterKills[monsterName] || 0) + 1
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
  }
}

/**
 * Cast a healing spell
 */
function castHealSpell(game: GameState, spell: SpellTemplate): SpellCastResult {
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
function castBuffSpell(game: GameState, spell: SpellTemplate): SpellCastResult {
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
): SpellCastResult {
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
): SpellCastResult {
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
  const damage = calculateSpellPower(game.character, spell, false)

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
    const idx = game.monsters.indexOf(target)
    if (idx >= 0) game.monsters.splice(idx, 1)
    game.stats.kills++

    // Track monster kill by name for bestiary
    const monsterName = target.template.name
    game.stats.monsterKills[monsterName] = (game.stats.monsterKills[monsterName] || 0) + 1
  }

  const killedStr = killed ? ' It dies!' : ''
  return {
    success: true,
    message: `You cast ${spell.name} on ${target.template.name} for ${damage} damage, healing ${actualHeal} HP.${killedStr}`,
    damage,
    healed: actualHeal,
    targets: [target.id],
  }
}

/**
 * Cast a teleport spell
 */
function castTeleportSpell(game: GameState, spell: SpellTemplate): SpellCastResult {
  const range = spell.teleportRange ?? 0
  const destination = findTeleportDestination(game, range)

  game.character.position = destination

  const rangeStr = range === 0 ? '' : ' a short distance'
  return {
    success: true,
    message: `You cast ${spell.name} and teleport${rangeStr}!`,
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add or replace a status effect on a character
 */
function addStatusEffect(character: Character, effect: StatusEffect): void {
  character.statusEffects = character.statusEffects.filter((e) => e.type !== effect.type)
  character.statusEffects.push(effect)
}

/**
 * Add or replace a temporary resistance on a character
 */
function addTempResistance(character: Character, resistance: TempResistance): void {
  character.tempResistances = character.tempResistances.filter((r) => r.type !== resistance.type)
  character.tempResistances.push(resistance)
}

/**
 * Apply a debuff to a monster (simplified - just tracks in memory for now)
 * In a full implementation, this would affect monster behavior/stats
 */
function applyMonsterDebuff(
  _monster: Monster,
  _type: string,
  _value: number,
  _duration: number
): void {
  // TODO: Implement monster debuffs properly
  // For now, debuffs are cosmetic (slow/weaken messages shown but not enforced)
  // This is intentional simplification for v1
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
