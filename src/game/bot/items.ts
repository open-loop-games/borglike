/**
 * Item Evaluation and Equipment Logic
 *
 * Handles item pickup decisions, equipment comparison, and value scoring.
 * Determines when to pick up items and whether to equip them.
 */

import type { Item, GroundItem, Character, EquipSlot, ItemTemplate } from '../types'
import type { PersonalityConfig } from './types'

// ============================================================================
// TYPES
// ============================================================================

/** Item evaluation result */
export interface ItemEvaluation {
  /** Overall value score (higher = more valuable) */
  score: number
  /** Is this item useful for us? */
  isUseful: boolean
  /** Reason for the evaluation */
  reason: string
  /** If equipment, the slot it would go in */
  slot: EquipSlot | null
  /** If equipment, is it an upgrade over current? */
  isUpgrade: boolean
}

/** Equipment comparison result */
export interface EquipmentComparison {
  /** Should we equip the new item? */
  shouldEquip: boolean
  /** Score difference (positive = new is better) */
  scoreDiff: number
  /** Reason for decision */
  reason: string
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Base values by item tier */
const TIER_BASE_VALUE: Record<number, number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 100,
}

/** Slot importance for scoring (higher = more important slot) */
const SLOT_IMPORTANCE: Record<EquipSlot, number> = {
  weapon: 100,
  armor: 80,
  shield: 60,
  helm: 40,
  gloves: 30,
  boots: 30,
  ring1: 50,
  ring2: 50,
  amulet: 50,
  light: 20,
  bow: 40,
}

// ============================================================================
// ITEM EVALUATION
// ============================================================================

/**
 * Evaluate an item's overall value
 */
export function evaluateItem(item: Item, character: Character): ItemEvaluation {
  const template = item.template

  // Gold items have simple value
  if (item.goldValue !== undefined) {
    return {
      score: item.goldValue,
      isUseful: true,
      reason: 'Gold',
      slot: null,
      isUpgrade: false,
    }
  }

  // Consumables
  if (template.type === 'potion' || template.type === 'scroll') {
    return evaluateConsumable(item, character)
  }

  // Equipment
  if (template.slot) {
    return evaluateEquipment(item, character)
  }

  // Unknown item type
  return {
    score: TIER_BASE_VALUE[template.tier] ?? 10,
    isUseful: false,
    reason: 'Unknown item type',
    slot: null,
    isUpgrade: false,
  }
}

/**
 * Evaluate a consumable item (potion/scroll)
 */
function evaluateConsumable(item: Item, character: Character): ItemEvaluation {
  const template = item.template
  const baseValue = TIER_BASE_VALUE[template.tier] ?? 10
  let score = baseValue
  let isUseful = true
  let reason = template.type === 'potion' ? 'Potion' : 'Scroll'

  // Healing potions are very valuable when HP is low
  if (template.name.toLowerCase().includes('cure') || template.name.toLowerCase().includes('healing')) {
    const hpRatio = character.hp / character.maxHp
    if (hpRatio < 0.5) {
      score *= 2
      reason = 'Healing (HP low)'
    } else {
      reason = 'Healing'
    }
  }

  // Speed potions are always valuable
  if (template.name.toLowerCase().includes('speed')) {
    score *= 1.5
    reason = 'Speed buff'
  }

  // Teleport scrolls are valuable for escape
  if (template.name.toLowerCase().includes('teleport') || template.name.toLowerCase().includes('phase')) {
    score *= 1.3
    reason = 'Escape option'
  }

  return {
    score,
    isUseful,
    reason,
    slot: null,
    isUpgrade: false,
  }
}

/**
 * Evaluate an equipment item
 */
function evaluateEquipment(item: Item, character: Character): ItemEvaluation {
  const template = item.template
  const slot = getEquipSlot(template)

  if (!slot) {
    return {
      score: 0,
      isUseful: false,
      reason: 'No valid slot',
      slot: null,
      isUpgrade: false,
    }
  }

  // Calculate equipment score
  const itemScore = calculateEquipmentScore(item)
  const currentItem = getEquippedItem(character, slot)
  const currentScore = currentItem ? calculateEquipmentScore(currentItem) : 0
  const isUpgrade = itemScore > currentScore

  // Base value from tier
  let score = TIER_BASE_VALUE[template.tier] ?? 10

  // Add slot importance
  score += SLOT_IMPORTANCE[slot] ?? 0

  // Big bonus if it's an upgrade
  if (isUpgrade) {
    score += (itemScore - currentScore) * 2
  }

  // Artifact bonus
  if (item.artifact) {
    score += 50
  }

  const reason = isUpgrade
    ? `Upgrade for ${slot} (+${Math.floor(itemScore - currentScore)})`
    : currentItem
      ? `${slot} (current is better)`
      : `${slot} (new slot)`

  return {
    score,
    isUseful: true,
    reason,
    slot,
    isUpgrade,
  }
}

// ============================================================================
// PICKUP DECISIONS
// ============================================================================

/**
 * Decide whether to pick up an item
 */
export function shouldPickup(
  item: GroundItem,
  character: Character,
  config: PersonalityConfig
): boolean {
  const evaluation = evaluateItem(item, character)

  // Always pick up gold
  if (item.goldValue !== undefined) {
    return true
  }

  // Greedy personalities pick up more
  const greedThreshold = Math.max(5, 15 - config.greed / 10)

  // Always pick up upgrades
  if (evaluation.isUpgrade) {
    return true
  }

  // Pick up consumables based on usefulness
  if (item.template.type === 'potion' || item.template.type === 'scroll') {
    // Check inventory space (simple heuristic: < 10 items)
    if (character.inventory.length < 10) {
      return evaluation.score >= greedThreshold
    }
  }

  // Pick up equipment if it's an upgrade or we have empty slot
  if (item.template.slot) {
    const slot = getEquipSlot(item.template)
    if (slot) {
      const currentItem = getEquippedItem(character, slot)
      if (!currentItem || evaluation.isUpgrade) {
        return true
      }
    }
  }

  // Otherwise use greed threshold
  return evaluation.score >= greedThreshold * 2
}

// ============================================================================
// EQUIPMENT COMPARISON
// ============================================================================

/**
 * Compare two equipment items for the same slot
 */
export function compareEquipment(newItem: Item, currentItem: Item | null): EquipmentComparison {
  const newScore = calculateEquipmentScore(newItem)
  const currentScore = currentItem ? calculateEquipmentScore(currentItem) : 0
  const scoreDiff = newScore - currentScore

  if (!currentItem) {
    return {
      shouldEquip: true,
      scoreDiff: newScore,
      reason: 'Empty slot',
    }
  }

  if (scoreDiff > 0) {
    return {
      shouldEquip: true,
      scoreDiff,
      reason: `Better by ${Math.floor(scoreDiff)} points`,
    }
  }

  return {
    shouldEquip: false,
    scoreDiff,
    reason: `Current is better by ${Math.floor(-scoreDiff)} points`,
  }
}

/**
 * Decide whether to equip an item from inventory
 */
export function shouldEquip(item: Item, character: Character): boolean {
  const slot = getEquipSlot(item.template)
  if (!slot) return false

  const currentItem = getEquippedItem(character, slot)
  const comparison = compareEquipment(item, currentItem)

  return comparison.shouldEquip
}

/**
 * Calculate a score for equipment based on its stats
 */
export function calculateEquipmentScore(item: Item): number {
  const template = item.template
  let score = 0

  // Weapon: damage is primary
  if (template.type === 'weapon' && template.damage) {
    const avgDamage = parseDiceAverage(template.damage)
    score += avgDamage * 10
  }

  // Armor/protection
  if (template.protection !== undefined) {
    score += template.protection * 3
  }

  // Enchantment bonus
  score += item.enchantment * 5

  // Tier bonus
  score += (template.tier - 1) * 10

  // Artifact bonus
  if (item.artifact) {
    score += 30
  }

  // Effect bonus (simple heuristic)
  if (template.effect) {
    score += 15
  }

  return score
}

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Find best equipment to equip from inventory
 * Returns items that should be equipped
 */
export function findEquipmentUpgrades(character: Character): Item[] {
  const upgrades: Item[] = []

  for (const item of character.inventory) {
    if (!item.template.slot) continue

    if (shouldEquip(item, character)) {
      upgrades.push(item)
    }
  }

  return upgrades
}

/**
 * Get prioritized list of items to pick up from visible items
 */
export function prioritizeItems(
  items: GroundItem[],
  character: Character,
  config: PersonalityConfig
): GroundItem[] {
  // Evaluate all items
  const evaluated = items.map(item => ({
    item,
    evaluation: evaluateItem(item, character),
    shouldPickup: shouldPickup(item, character, config),
  }))

  // Filter to only items we want
  const wanted = evaluated.filter(e => e.shouldPickup)

  // Sort by score (highest first)
  wanted.sort((a, b) => b.evaluation.score - a.evaluation.score)

  return wanted.map(e => e.item)
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map ItemTemplate slot to EquipSlot
 */
function getEquipSlot(template: ItemTemplate): EquipSlot | null {
  switch (template.slot) {
    case 'weapon': return 'weapon'
    case 'body': return 'armor'
    case 'shield': return 'shield'
    case 'helm': return 'helm'
    case 'gloves': return 'gloves'
    case 'boots': return 'boots'
    case 'ring': return 'ring1' // Default to first ring slot
    case 'amulet': return 'amulet'
    case 'light': return 'light'
    default: return null
  }
}

/**
 * Get the best ring slot for a new ring
 * Prefers empty slot, then weaker ring
 */
export function getBestRingSlot(character: Character, newRing: Item): EquipSlot {
  const ring1 = character.equipment.ring1
  const ring2 = character.equipment.ring2

  // Prefer empty slot
  if (!ring1) return 'ring1'
  if (!ring2) return 'ring2'

  // Compare scores and replace weaker one
  const score1 = calculateEquipmentScore(ring1)
  const score2 = calculateEquipmentScore(ring2)
  const newScore = calculateEquipmentScore(newRing)

  // Only replace if new is better than one of them
  if (newScore > score1 && score1 <= score2) return 'ring1'
  if (newScore > score2) return 'ring2'

  // Neither should be replaced
  return 'ring1' // Default, comparison will reject
}

/**
 * Get equipped item for a slot
 */
function getEquippedItem(character: Character, slot: EquipSlot): Item | null {
  return character.equipment[slot] ?? null
}

/**
 * Parse dice notation and return average value
 * e.g. "2d6" => 7, "3d4" => 7.5
 */
function parseDiceAverage(dice: string): number {
  const match = dice.match(/(\d+)d(\d+)/)
  if (!match) return 0

  const count = parseInt(match[1]!, 10)
  const sides = parseInt(match[2]!, 10)

  // Average of a die is (1 + sides) / 2
  return count * ((1 + sides) / 2)
}

/**
 * Check if an item is a consumable
 */
export function isConsumable(item: Item): boolean {
  return item.template.type === 'potion' || item.template.type === 'scroll'
}

/**
 * Check if an item is equipment
 */
export function isEquipment(item: Item): boolean {
  return item.template.slot !== undefined
}

/**
 * Get display name for an item
 */
export function getItemDisplayName(item: Item): string {
  let name = item.template.name

  if (item.enchantment !== 0) {
    const sign = item.enchantment > 0 ? '+' : ''
    name = `${name} (${sign}${item.enchantment})`
  }

  if (item.artifact) {
    name = item.artifact.name
  }

  return name
}

/**
 * Find a healing potion in inventory
 * Optionally specify minimum tier (1-4) for stronger potions
 */
export function findHealingPotion(character: Character, minTier: number = 1): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'potion') return false
    if (item.template.tier < minTier) return false
    const name = item.template.name.toLowerCase()
    return name.includes('cure') || name.includes('healing')
  }) ?? null
}

/**
 * Find an escape scroll (teleport/phase door) in inventory
 */
export function findEscapeScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    return name.includes('teleport') || name.includes('phase')
  }) ?? null
}

/**
 * Find a phase door scroll (short-range teleport, up to 10 squares)
 * Requires safety check before use
 */
export function findPhaseDoorScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    return name.includes('phase door')
  }) ?? null
}

/**
 * Find a full teleport scroll (random location on level)
 * Always "safe" since destination is random/far
 */
export function findFullTeleportScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    // Match "teleportation" but not "phase door" or "teleport level"
    return name.includes('teleportation')
  }) ?? null
}

/**
 * Find a speed potion in inventory
 */
export function findSpeedPotion(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'potion') return false
    const name = item.template.name.toLowerCase()
    return name.includes('speed')
  }) ?? null
}

/**
 * Find a buff potion (heroism or berserk) in inventory
 */
export function findBuffPotion(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'potion') return false
    const name = item.template.name.toLowerCase()
    return name.includes('heroism') || name.includes('berserk')
  }) ?? null
}

/**
 * Find a resistance potion matching a damage type
 */
export function findResistancePotion(character: Character, damageType?: string): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'potion') return false
    const name = item.template.name.toLowerCase()
    const effect = (item.template.effect || '').toLowerCase()

    // If specific type requested, match it
    if (damageType) {
      const type = damageType.toLowerCase()
      if (type === 'fire' && (name.includes('heat') || effect.includes('fire'))) return true
      if (type === 'cold' && (name.includes('cold') || effect.includes('cold'))) return true
      if (type === 'poison' && name.includes('poison')) return true
      return false
    }

    // Any resistance potion
    return name.includes('resist') && (
      name.includes('heat') ||
      name.includes('cold') ||
      name.includes('poison')
    )
  }) ?? null
}

/**
 * Find a neutralize poison potion
 */
export function findNeutralizePoison(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'potion') return false
    const name = item.template.name.toLowerCase()
    return name.includes('neutralize') ||
           (name.includes('poison') && !name.includes('resist'))
  }) ?? null
}

/**
 * Find a blessing scroll
 */
export function findBlessingScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    return name.includes('blessing')
  }) ?? null
}

/**
 * Find a protection from evil scroll
 */
export function findProtectionScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    return name.includes('protection from evil')
  }) ?? null
}

/**
 * Find a mapping scroll (magic mapping or light)
 */
export function findMappingScroll(character: Character): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    return name.includes('magic mapping') || name.includes('light')
  }) ?? null
}

/**
 * Find an enchant scroll (weapon or armour)
 */
export function findEnchantScroll(character: Character, type?: 'weapon' | 'armor'): Item | null {
  return character.inventory.find(item => {
    if (item.template.type !== 'scroll') return false
    const name = item.template.name.toLowerCase()
    if (type === 'weapon') return name.includes('enchant weapon')
    if (type === 'armor') return name.includes('enchant armour') || name.includes('enchant armor')
    return name.includes('enchant')
  }) ?? null
}

/**
 * Check if character has active status effect of given type
 */
export function hasStatusEffect(character: Character, type: string): boolean {
  return character.statusEffects.some(e => e.type === type)
}

/**
 * Check if character has active temp resistance of given type
 */
export function hasTempResistance(character: Character, type: string): boolean {
  return character.tempResistances.some(r => r.type === type)
}
