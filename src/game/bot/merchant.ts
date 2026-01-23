/**
 * Bot Merchant Interaction
 *
 * Handles bot selling and buying at merchants (town or traveling).
 */

import type { GameState } from '../types'
import type { BotGoal, BotContext } from './types'
import { findAdjacentMerchant, sellToMerchant, buyFromMerchant } from '../features'
import { countHealingPotions } from './preparation'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get slot priority multiplier for gear buying decisions
 * Higher priority slots = more willing to spend gold
 */
function getSlotPriority(slot: string): number {
  switch (slot) {
    case 'weapon': return 1.0   // Weapons are highest priority
    case 'armor': return 0.95   // Body armor second
    case 'shield': return 0.85  // Shield important for defense
    case 'helm': return 0.8
    case 'gloves': return 0.75
    case 'boots': return 0.75
    case 'ring': return 0.7
    case 'amulet': return 0.7
    default: return 0.6
  }
}

// countHealingPotions moved to preparation.ts (deduplicated)

// ============================================================================
// BOT MERCHANT ACTIONS
// ============================================================================

/**
 * Bot sells all sellable items to adjacent merchant
 *
 * Sells equipment (weapons, armor, accessories) but NOT consumables (potions, scrolls).
 * Returns number of items sold.
 */
export function botSellItems(game: GameState): number {
  const merchant = findAdjacentMerchant(game)
  if (!merchant) return 0

  const merchantIndex = game.merchants.indexOf(merchant)
  if (merchantIndex < 0) return 0

  // Find sellable items: equipment only, NOT consumables
  const sellableIndices: number[] = []
  for (let i = 0; i < game.character.inventory.length; i++) {
    const item = game.character.inventory[i]
    if (!item) continue

    // Only sell equipment (has a slot), skip consumables
    const isEquipment = item.template.slot !== undefined
    const isConsumable = item.template.type === 'potion' || item.template.type === 'scroll'

    if (isEquipment && !isConsumable) {
      sellableIndices.push(i)
    }
  }

  if (sellableIndices.length === 0) return 0

  // Sell items in reverse order to preserve indices
  let soldCount = 0
  for (let i = sellableIndices.length - 1; i >= 0; i--) {
    const invIndex = sellableIndices[i]!
    const success = sellToMerchant(game, merchantIndex, invIndex)
    if (success) soldCount++
  }

  return soldCount
}

/**
 * Bot buys supplies from adjacent merchant
 *
 * Priority:
 * 1. Town Portal Scrolls (want 1-2)
 * 2. Healing potions (want 2-3)
 * 3. Phase Door / Teleport scrolls (want 2-3)
 * 4. Gear upgrades (if merchant sells equipment)
 *
 * Returns number of items bought.
 */
export function botBuySupplies(game: GameState): number {
  const merchant = findAdjacentMerchant(game)
  if (!merchant) return 0

  const merchantIndex = game.merchants.indexOf(merchant)
  if (merchantIndex < 0) return 0

  // Analyze current inventory
  const inventory = game.character.inventory
  const char = game.character
  let tpScrollCount = 0
  let healingPotionCount = 0
  let escapeScrollCount = 0

  for (const item of inventory) {
    const effect = item.template.effect || ''
    const name = item.template.name

    if (name.includes('Town Portal')) {
      tpScrollCount++
    } else if (item.template.type === 'potion' && (effect.includes('Cure') || effect.includes('Heal'))) {
      healingPotionCount++
    } else if (item.template.type === 'scroll' && (effect.includes('Teleport') || name.includes('Phase Door'))) {
      escapeScrollCount++
    }
  }

  // Dynamic consumable targets - scale with gold but cap to avoid inventory bloat
  const baseTP = 2
  const baseHealing = 3
  const baseEscape = 2
  const goldBonus = Math.min(2, Math.floor(char.gold / 3000))

  const wantedTP = Math.max(0, (baseTP + goldBonus) - tpScrollCount)              // max 4
  const wantedHealing = Math.max(0, (baseHealing + goldBonus) - healingPotionCount) // max 5
  const wantedEscape = Math.max(0, (baseEscape + Math.floor(goldBonus / 2)) - escapeScrollCount) // max 3

  // Build priority buy list
  interface BuyCandidate {
    index: number
    category: 'tp' | 'healing' | 'escape' | 'gear'
    priority: number
    price: number
    name: string
  }

  const candidates: BuyCandidate[] = []

  for (let i = 0; i < merchant.inventory.length; i++) {
    const item = merchant.inventory[i]
    if (!item) continue

    const price = item.shopPrice ?? 0
    const effect = item.template.effect || ''
    const name = item.template.name
    const template = item.template

    // Town Portal Scrolls - highest priority
    if (name.includes('Town Portal')) {
      if (wantedTP > 0) {
        candidates.push({ index: i, category: 'tp', priority: 1, price, name })
      }
    }
    // Healing potions - second priority
    // Higher tier = lower priority number = bought FIRST (T4 Healing > T1 Cure Light)
    else if (template.type === 'potion' && (effect.includes('Cure') || effect.includes('Heal'))) {
      if (wantedHealing > 0) {
        // T4 gets priority 1.4, T1 gets 1.85 - prefer high-tier potions
        const tierBonus = template.tier * 0.15
        candidates.push({ index: i, category: 'healing', priority: 2 - tierBonus, price, name })
      }
    }
    // Phase Door / Escape scrolls - third priority
    else if (template.type === 'scroll' && (effect.includes('Teleport') || name.includes('Phase Door'))) {
      if (wantedEscape > 0) {
        const phaseDoorBonus = name.includes('Phase Door') ? 0.1 : 0
        candidates.push({ index: i, category: 'escape', priority: 3 - phaseDoorBonus, price, name })
      }
    }
    // Gear upgrades - aggressive buying at 60% threshold with slot priority
    else if (template.slot) {
      const slotKey = template.slot as keyof typeof char.equipment
      const currentGear = char.equipment[slotKey]
      const currentValue = currentGear
        ? (currentGear.template.tier * 10 + currentGear.enchantment * 5)
        : 0
      const newValue = template.tier * 10 + item.enchantment * 5

      // Slot priority: weapon/armor most important
      const slotPriority = getSlotPriority(template.slot)
      const gearBudget = char.gold * 0.6 * slotPriority

      if (newValue > currentValue && price <= gearBudget) {
        const upgradeValue = newValue - currentValue
        // Lower priority = bought sooner; better upgrades and better slots get lower priority
        candidates.push({
          index: i,
          category: 'gear',
          priority: 4 - (upgradeValue * 0.1) - ((1 - slotPriority) * 0.5),
          price,
          name,
        })
      }
    }
  }

  // Sort by priority, then price
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return a.price - b.price
  })

  // Buy items
  let boughtCount = 0
  const maxInventory = 20
  let boughtTP = 0
  let boughtHealing = 0
  let boughtEscape = 0

  for (const candidate of candidates) {
    if (candidate.category !== 'gear' && game.character.inventory.length >= maxInventory) continue
    if (game.character.gold < candidate.price) continue

    if (candidate.category === 'tp' && boughtTP >= wantedTP) continue
    if (candidate.category === 'healing' && boughtHealing >= wantedHealing) continue
    if (candidate.category === 'escape' && boughtEscape >= wantedEscape) continue

    // Find current index (may have shifted)
    const currentIndex = merchant.inventory.findIndex(
      (item) => item && item.template.name === candidate.name && (item.shopPrice ?? 0) === candidate.price
    )
    if (currentIndex < 0) continue

    const success = buyFromMerchant(game, merchantIndex, currentIndex)
    if (success) {
      boughtCount++
      switch (candidate.category) {
        case 'tp': boughtTP++; break
        case 'healing': boughtHealing++; break
        case 'escape': boughtEscape++; break
      }
    }
  }

  return boughtCount
}

// ============================================================================
// GOAL CREATION (merchant domain)
// ============================================================================

/** Minimum gold buffer to keep for emergencies (potions, escapes) */
const ALTAR_GOLD_BUFFER = 300

/**
 * Get USE_ALTAR goal - use dungeon altars for benefits.
 *
 * Priority order:
 * 1. Enchantment Altar (200g) - +1 to weapon, best gold sink
 * 2. Blessing Altar (50g) - Full heal + mana restore
 * 3. Knowledge Altar (25g) - Identify all items
 */
export function getUseAltarGoal(
  context: BotContext,
  dangerThreshold: number,
  localDanger: number
): BotGoal | null {
  const { game, visibleAltars, visibleMonsters } = context
  const character = game.character

  // Don't use altars if monsters are visible
  if (visibleMonsters.length > 0) return null

  // Don't use altars if in danger
  if (localDanger > dangerThreshold * 0.3) return null

  // No altars visible
  if (visibleAltars.length === 0) return null

  // Evaluate each visible altar
  let bestAltar = null
  let bestPriority = -1
  let bestReason = ''

  for (const altar of visibleAltars) {
    const template = altar.template
    const cost = template.cost

    // Can we afford this altar while keeping buffer?
    if (character.gold < cost + ALTAR_GOLD_BUFFER) continue

    // Evaluate based on altar type
    let priority = 0
    let reason = ''

    switch (template.effect) {
      case 'enchant': {
        // Enchantment altar: +1 to weapon
        // Highest priority gold sink - always use if affordable
        const weapon = character.equipment.weapon
        if (weapon) {
          // Higher priority for lower enchantment (bigger relative gain)
          priority = 100 - weapon.enchantment * 5
          reason = `Enchanting ${weapon.template.name} (+${weapon.enchantment} → +${weapon.enchantment + 1})`
        }
        break
      }

      case 'bless': {
        // Blessing altar: Full heal + mana
        // Use if HP < 70% or MP < 50%
        const hpRatio = character.hp / character.maxHp
        const mpRatio = character.maxMp > 0 ? character.mp / character.maxMp : 1
        if (hpRatio < 0.7 || mpRatio < 0.5) {
          priority = 50
          reason = `Blessing (HP: ${Math.round(hpRatio * 100)}%, MP: ${Math.round(mpRatio * 100)}%)`
        }
        break
      }

      case 'identify': {
        // Knowledge altar: Identify all items
        // Use if we have 3+ unidentified items
        const unidentifiedCount = character.inventory.filter(item => !item.identified).length
        if (unidentifiedCount >= 3) {
          priority = 20
          reason = `Identifying ${unidentifiedCount} items`
        }
        break
      }

      case 'curse_remove': {
        // Purification altar: Remove curses
        // Skip for now - curses not implemented
        break
      }
    }

    if (priority > bestPriority) {
      bestPriority = priority
      bestAltar = altar
      bestReason = reason
    }
  }

  if (!bestAltar || bestPriority <= 0) return null

  return {
    type: 'USE_ALTAR',
    target: bestAltar.position,
    targetId: bestAltar.template.id,
    reason: bestReason,
    startTurn: game.turn,
  }
}

/**
 * Get VISIT_MERCHANT goal - visit dungeon merchants for supplies/gear.
 *
 * Priority scoring:
 * - Shady Dealer (black market) - highest priority for T3-4 gear
 * - Alchemist - high priority if low on healing potions
 * - Weapon/Armor dealers - moderate priority if gold available
 * - General/Mixed - low priority for general supplies
 */
export function getVisitMerchantGoal(
  context: BotContext,
  dangerThreshold: number,
  localDanger: number
): BotGoal | null {
  const { game, visibleMerchants, visibleMonsters } = context
  const character = game.character

  // Safety checks
  if (visibleMonsters.length > 0) return null
  if (localDanger > dangerThreshold * 0.3) return null
  if (visibleMerchants.length === 0) return null
  if (game.character.depth === 0) return null  // Town handled separately

  // Score each merchant
  let bestMerchant = null
  let bestScore = 0
  let bestReason = ''

  for (const merchant of visibleMerchants) {
    let score = 0
    let reason = ''

    // Shady Dealer (black market) - highest priority for late-game gear
    if (merchant.template.id === 'black_market') {
      // High priority if we have gold for T3-4 gear
      if (character.gold > 500) {
        score = 100
        reason = 'Black market (T3-4 gear)'
      }
    }
    // Alchemist - if low on healing
    else if (merchant.template.shopType === 'potion') {
      const healingCount = countHealingPotions(character.inventory)
      if (healingCount < 3) {
        score = 60
        reason = 'Need healing potions'
      } else if (character.gold > 300) {
        score = 20
        reason = 'Checking potion supplies'
      }
    }
    // Weapon/Armor dealers - if gold available
    else if (merchant.template.shopType === 'weapon' || merchant.template.shopType === 'armor') {
      if (character.gold > 500) {
        score = 40
        reason = `Checking ${merchant.template.shopType} upgrades`
      }
    }
    // Scroll merchant - if need escape/utility scrolls
    else if (merchant.template.shopType === 'scroll') {
      if (character.gold > 200) {
        score = 35
        reason = 'Checking scroll supplies'
      }
    }
    // Mixed/general - moderate priority
    else {
      if (character.gold > 200) {
        score = 20
        reason = 'General supplies'
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMerchant = merchant
      bestReason = reason
    }
  }

  if (!bestMerchant || bestScore <= 0) return null

  return {
    type: 'VISIT_MERCHANT',
    target: bestMerchant.position,
    targetId: bestMerchant.template.id,
    reason: bestReason,
    startTurn: game.turn,
  }
}
