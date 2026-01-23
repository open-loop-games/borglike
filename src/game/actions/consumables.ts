/**
 * Consumable Action Handlers for Borglike
 *
 * Handles item use (potions, scrolls, etc.) with an effect registry pattern.
 */

import type { GameState, ActionResult, Item } from '../types'
import { randomInt } from '../rng'
import { calculateLightRadius } from '../lighting'
import { getTile, isWalkable, findOpenPosition, computeFOV } from '../dungeon'
import {
  addStatusEffect,
  addTempResistance,
  clearPoison,
  removeStatusEffect,
  removeAllDebuffs,
  hasStatusEffect,
} from '../status-effects'
import { createTownPortal, enterTown, isInTown } from '../town'
import { addMessage, BASE_ENERGY_COST, getHealAmount } from './helpers'
import { handleAscend } from './movement'

// ============================================================================
// TYPES
// ============================================================================

/** Effect handler for consumables */
type ConsumableEffect = (game: GameState, item: Item) => EffectResult

/** Result of applying an effect */
interface EffectResult {
  success: boolean
  message?: string
  /** If true, don't consume the item */
  preventConsume?: boolean
}

// ============================================================================
// POTION EFFECTS
// ============================================================================

/** Registry of potion effects by keyword in effect description */
const POTION_EFFECTS: Array<{
  match: (effect: string) => boolean
  apply: ConsumableEffect
}> = [
  // Free Action - cure paralysis and slow
  {
    match: (e) => e.toLowerCase().includes('cure paralysis') || e.toLowerCase().includes('free action'),
    apply: (game) => {
      const curedParalyzed = hasStatusEffect(game.character, 'paralyzed')
      const curedSlowed = hasStatusEffect(game.character, 'slowed')
      removeStatusEffect(game.character, 'paralyzed')
      removeStatusEffect(game.character, 'slowed')
      let message = 'You feel free to move!'
      if (curedParalyzed) message = 'The paralysis wears off! You feel free to move!'
      if (curedSlowed) message = 'You feel quick again!'
      return { success: true, message }
    },
  },
  // Clarity - cure confusion and blind
  {
    match: (e) => e.toLowerCase().includes('cure confusion') || e.toLowerCase().includes('clarity'),
    apply: (game) => {
      const curedConfused = hasStatusEffect(game.character, 'confused')
      const curedBlind = hasStatusEffect(game.character, 'blind')
      removeStatusEffect(game.character, 'confused')
      removeStatusEffect(game.character, 'blind')
      let message = 'Your mind clears!'
      if (curedBlind) message = 'Your sight returns!'
      if (curedConfused) message = 'Your confusion fades!'
      return { success: true, message }
    },
  },
  // Restoration - cure drain, restore stats
  {
    match: (e) => e.toLowerCase().includes('cure drain') || e.toLowerCase().includes('restoration'),
    apply: (game) => {
      const curedDrained = hasStatusEffect(game.character, 'drained')
      removeStatusEffect(game.character, 'drained')
      const message = curedDrained
        ? 'You feel your strength return!'
        : 'You feel restored!'
      return { success: true, message }
    },
  },
  // Healing potions - cure status based on tier + heal
  {
    match: (e) => e.includes('Cure') || e.includes('Heal'),
    apply: (game, item) => {
      const effect = item.template.effect || ''
      const healAmount = getHealAmount(effect, game.character.level)
      game.character.hp = Math.min(game.character.hp + healAmount, game.character.maxHp)

      // Cure status effects based on potion type (from cure matrix)
      // Cure Light: cure blind
      // Cure Serious: cure blind, confusion
      // Cure Critical / Healing: cure all status
      if (effect.toLowerCase().includes('cure all status') || effect.toLowerCase().includes('healing')) {
        // Full healing potions cure all debuffs
        const removed = removeAllDebuffs(game.character)
        clearPoison(game.character)
        if (removed.length > 0) {
          return {
            success: true,
            message: `You drink the ${item.template.name}. You feel much better!`,
          }
        }
      } else if (effect.toLowerCase().includes('critical')) {
        // Cure Critical cures all debuffs
        const removed = removeAllDebuffs(game.character)
        clearPoison(game.character)
        if (removed.length > 0) {
          return {
            success: true,
            message: `You drink the ${item.template.name}. Your ailments fade!`,
          }
        }
      } else if (effect.toLowerCase().includes('serious')) {
        // Cure Serious cures blind and confusion
        removeStatusEffect(game.character, 'blind')
        removeStatusEffect(game.character, 'confused')
      } else if (effect.toLowerCase().includes('light')) {
        // Cure Light only cures blind
        removeStatusEffect(game.character, 'blind')
      }

      return {
        success: true,
        message: `You drink the ${item.template.name}. You feel better!`,
      }
    },
  },

  // Restore mana
  {
    match: (e) => e.includes('Restore'),
    apply: (game, item) => {
      game.character.mp = game.character.maxMp
      return {
        success: true,
        message: `You drink the ${item.template.name}. You feel restored!`,
      }
    },
  },

  // Speed potion (Haste)
  {
    match: (e) => e.includes('Haste') || e.includes('+10 speed'),
    apply: (game) => {
      const duration = randomInt(20, 39)
      addStatusEffect(game.character, { type: 'speed', turnsRemaining: duration, value: 10 })
      return { success: true, message: 'You feel yourself moving faster!' }
    },
  },

  // Heroism potion (+12 to hit, cure fear)
  {
    match: (e) => e.includes('+12 to hit'),
    apply: (game, item) => {
      const effect = item.template.effect || ''
      const duration = randomInt(25, 49)
      addStatusEffect(game.character, { type: 'heroism', turnsRemaining: duration, value: 12 })
      // Heroism cures fear/terrified
      removeStatusEffect(game.character, 'terrified')
      // Small heal from heroism
      if (effect.includes('Heal 10')) {
        game.character.hp = Math.min(game.character.hp + 10, game.character.maxHp)
      }
      return { success: true, message: 'You feel like a hero!' }
    },
  },

  // Berserk Strength potion (cure fear)
  {
    match: (e) => e.includes('berserk'),
    apply: (game, item) => {
      const effect = item.template.effect || ''
      const duration = randomInt(25, 49)
      addStatusEffect(game.character, { type: 'berserk', turnsRemaining: duration, value: 24 })
      // Berserk cures fear/terrified
      removeStatusEffect(game.character, 'terrified')
      // Berserk also heals 30 HP
      if (effect.includes('Heal 30')) {
        game.character.hp = Math.min(game.character.hp + 30, game.character.maxHp)
      }
      return { success: true, message: 'You feel a berserker rage!' }
    },
  },

  // Resist Heat (fire resistance)
  {
    match: (e) => e.includes('fire resistance'),
    apply: (game) => {
      addTempResistance(game.character, { type: 'FIRE', turnsRemaining: 40, value: 50 })
      return { success: true, message: 'You feel resistant to fire!' }
    },
  },

  // Resist Cold
  {
    match: (e) => e.includes('cold resistance'),
    apply: (game) => {
      addTempResistance(game.character, { type: 'COLD', turnsRemaining: 40, value: 50 })
      return { success: true, message: 'You feel resistant to cold!' }
    },
  },

  // Resist/Neutralize Poison
  {
    match: (e) => e.includes('poison'),
    apply: (game, item) => {
      const effect = item.template.effect || ''
      clearPoison(game.character)
      let message = 'The poison is purged!'
      if (effect.includes('resistance')) {
        addTempResistance(game.character, { type: 'POISON', turnsRemaining: 40, value: 50 })
        message += ' You feel resistant to poison!'
      }
      return { success: true, message }
    },
  },
]

// ============================================================================
// SCROLL EFFECTS
// ============================================================================

/** Registry of scroll effects by keyword in effect description */
const SCROLL_EFFECTS: Array<{
  match: (effect: string) => boolean
  apply: ConsumableEffect
}> = [
  // Town Portal scroll
  {
    match: (e) => e.includes('Opens portal to town'),
    apply: (game) => {
      // Cannot use in town
      if (isInTown(game)) {
        return { success: false, message: 'Cannot use Town Portal in town', preventConsume: true }
      }
      // Cannot use if portal already active
      if (game.townPortal) {
        return { success: false, message: 'A portal is already active', preventConsume: true }
      }
      // Create portal and enter town
      game.townPortal = createTownPortal(game)
      enterTown(game)
      return { success: true, message: 'You open a portal to town!' }
    },
  },

  // Teleport Level - go UP one level (escape scroll)
  // Changed from going down to going up - makes it useful as an emergency escape
  {
    match: (e) => e.includes('Teleport') && e.includes('adjacent dungeon level'),
    apply: (game) => {
      const newDepth = game.character.depth - 1
      if (newDepth >= 1) {
        handleAscend(game)
        return { success: true, message: 'You feel yourself yanked upward!' }
      } else {
        // Already at depth 1, can't go higher
        return { success: true, message: 'You read the scroll, but nothing happens.' }
      }
    },
  },

  // Phase Door - short range teleport (10 squares)
  {
    match: (e) => e.includes('Teleport') && e.includes('10 squares'),
    apply: (game, item) => {
      const attempts = 20
      let newPos = { ...game.character.position }
      for (let i = 0; i < attempts; i++) {
        const dx = randomInt(-10, 10)
        const dy = randomInt(-10, 10)
        const testX = game.character.position.x + dx
        const testY = game.character.position.y + dy
        const tile = getTile(game.currentLevel, testX, testY)
        if (tile && isWalkable(tile)) {
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= 10 && dist > 0) {
            newPos = { x: testX, y: testY }
            break
          }
        }
      }
      game.character.position = newPos
      const lightRadius = calculateLightRadius(game.character, game.character.depth)
      computeFOV(game.currentLevel, newPos, lightRadius)
      return { success: true, message: `You read the ${item.template.name}. You blink!` }
    },
  },

  // Full teleport - random location
  {
    match: (e) => e.includes('Teleport') && e.includes('random location'),
    apply: (game, item) => {
      const newPos = findOpenPosition(game.currentLevel)
      game.character.position = newPos
      const lightRadius = calculateLightRadius(game.character, game.character.depth)
      computeFOV(game.currentLevel, newPos, lightRadius)
      return { success: true, message: `You read the ${item.template.name}. You teleport!` }
    },
  },

  // Default teleport (fallback)
  {
    match: (e) => e.includes('Teleport') && !e.includes('adjacent'),
    apply: (game, item) => {
      const newPos = findOpenPosition(game.currentLevel)
      game.character.position = newPos
      const lightRadius = calculateLightRadius(game.character, game.character.depth)
      computeFOV(game.currentLevel, newPos, lightRadius)
      return { success: true, message: `You read the ${item.template.name}. You teleport!` }
    },
  },

  // Detect Stairs - reveals only the stairs location
  {
    match: (e) => e.includes('Reveals stairs'),
    apply: (game, item) => {
      const stairs = game.currentLevel.stairsDown
      if (stairs) {
        const tile = getTile(game.currentLevel, stairs.x, stairs.y)
        if (tile) tile.explored = true
      }
      return {
        success: true,
        message: `You read the ${item.template.name}. You sense the way down!`,
      }
    },
  },

  // Magic Mapping
  {
    match: (e) => e.includes('Magic Mapping') || e.includes('reveal level'),
    apply: (game, item) => {
      for (let y = 0; y < game.currentLevel.height; y++) {
        const row = game.currentLevel.tiles[y]
        if (row) {
          for (let x = 0; x < game.currentLevel.width; x++) {
            const tile = row[x]
            if (tile) tile.explored = true
          }
        }
      }
      return {
        success: true,
        message: `You read the ${item.template.name}. The level is revealed!`,
      }
    },
  },

  // Treasure Detection
  {
    match: (e) => e.includes('Detect') && e.includes('gold'),
    apply: (game) => {
      for (const groundItem of game.items) {
        const tile = getTile(game.currentLevel, groundItem.position.x, groundItem.position.y)
        if (tile) tile.explored = true
      }
      return { success: true, message: 'You sense treasures nearby!' }
    },
  },

  // Light scroll
  {
    match: (e) => e.includes('Light nearby'),
    apply: (game) => {
      const pos = game.character.position
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const tile = getTile(game.currentLevel, pos.x + dx, pos.y + dy)
          if (tile) tile.explored = true
        }
      }
      return { success: true, message: 'The area is illuminated!' }
    },
  },

  // Enchant Weapon
  {
    match: (e) => e.includes('+1') && e.includes('weapon'),
    apply: (game) => {
      const weapon = game.character.equipment.weapon
      if (weapon) {
        weapon.enchantment += 1
        return {
          success: true,
          message: `Your ${weapon.template.name} glows! (+${weapon.enchantment})`,
        }
      } else {
        return { success: false, message: 'You have no weapon equipped.', preventConsume: true }
      }
    },
  },

  // Enchant Armour
  {
    match: (e) => e.includes('+1') && e.includes('armor'),
    apply: (game) => {
      const armor = game.character.equipment.armor
      if (armor) {
        armor.enchantment += 1
        return {
          success: true,
          message: `Your ${armor.template.name} glows! (+${armor.enchantment})`,
        }
      } else {
        return { success: false, message: 'You have no armor equipped.', preventConsume: true }
      }
    },
  },

  // Blessing scroll (+5 to hit, +5 AC)
  {
    match: (e) => e.includes('+5 to hit') && e.includes('+5 AC'),
    apply: (game) => {
      const duration = randomInt(6, 17)
      addStatusEffect(game.character, { type: 'blessing', turnsRemaining: duration, value: 5 })
      return { success: true, message: 'You feel righteous!' }
    },
  },

  // Protection from Evil
  {
    match: (e) => e.includes('Protection from evil'),
    apply: (game) => {
      const duration = randomInt(24, 47)
      addStatusEffect(game.character, { type: 'protection', turnsRemaining: duration, value: 50 })
      return { success: true, message: 'You feel protected from evil!' }
    },
  },
]

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle item use (potions, scrolls, etc.)
 */
export function handleUse(game: GameState, itemId: string): ActionResult {
  const itemIndex = game.character.inventory.findIndex((i) => i.id === itemId)

  if (itemIndex < 0) {
    return { success: false, message: 'You do not have that item.', energyCost: 0 }
  }

  const item = game.character.inventory[itemIndex]!

  // Check if item is consumable
  if (item.template.type !== 'potion' && item.template.type !== 'scroll') {
    return { success: false, message: 'You cannot use that item.', energyCost: 0 }
  }

  const effect = item.template.effect || ''

  // Apply effect based on item type
  let result: EffectResult | null = null

  if (item.template.type === 'potion') {
    // Find matching potion effect
    for (const handler of POTION_EFFECTS) {
      if (handler.match(effect)) {
        result = handler.apply(game, item)
        break
      }
    }

    // Default potion message if no specific handler
    if (!result) {
      result = { success: true, message: `You drink the ${item.template.name}.` }
    }
  } else if (item.template.type === 'scroll') {
    // Find matching scroll effect
    for (const handler of SCROLL_EFFECTS) {
      if (handler.match(effect)) {
        result = handler.apply(game, item)
        break
      }
    }

    // Default scroll message if no specific handler
    if (!result) {
      result = { success: true, message: `You read the ${item.template.name}.` }
    }
  }

  // Handle result
  if (!result) {
    return { success: false, message: 'Unknown item effect.', energyCost: 0 }
  }

  if (!result.success && result.preventConsume) {
    if (result.message) {
      addMessage(game, result.message, 'info')
    }
    return { success: false, message: result.message, energyCost: 0 }
  }

  // Show message
  if (result.message) {
    addMessage(game, result.message, result.success ? 'good' : 'info')
  }

  // Remove item from inventory if consumed
  if (!result.preventConsume) {
    game.character.inventory.splice(itemIndex, 1)
  }

  return { success: true, energyCost: BASE_ENERGY_COST }
}
