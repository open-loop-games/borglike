/**
 * Bot Merchant Interaction
 *
 * Handles bot selling and buying at merchants (town or traveling).
 */

import type { GameState } from '../types'
import { findAdjacentMerchant, sellToMerchant, buyFromMerchant } from '../features'

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

  // Define desired amounts
  const wantedTP = Math.max(0, 2 - tpScrollCount)
  const wantedHealing = Math.max(0, 3 - healingPotionCount)
  const wantedEscape = Math.max(0, 3 - escapeScrollCount)

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
    else if (template.type === 'potion' && (effect.includes('Cure') || effect.includes('Heal'))) {
      if (wantedHealing > 0) {
        const tierBonus = template.tier * 0.05
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
    // Gear upgrades
    else if (template.slot) {
      const slotKey = template.slot as keyof typeof char.equipment
      const currentGear = char.equipment[slotKey]
      const currentValue = currentGear
        ? (currentGear.template.tier * 10 + currentGear.enchantment * 5)
        : 0
      const newValue = template.tier * 10 + item.enchantment * 5

      if (newValue > currentValue && price <= char.gold * 0.4) {
        const upgradeValue = newValue - currentValue
        candidates.push({
          index: i,
          category: 'gear',
          priority: 4 - (upgradeValue * 0.1),
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
