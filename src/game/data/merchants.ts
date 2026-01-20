/**
 * Merchant templates for traveling traders and shops
 *
 * Merchants appear in special vault rooms and offer items for sale.
 */

export type ShopType = 'general' | 'weapon' | 'armor' | 'potion' | 'scroll' | 'mixed' | 'blackmarket'

export interface MerchantDialogue {
  greeting: string[]
  purchase: string[]
  sell: string[]
  farewell: string[]
  tooExpensive: string[]
  cantAfford: string[]
}

export interface MerchantTemplate {
  id: string
  name: string
  char: string
  color: number
  shopType: ShopType
  /** Buy price = item value * this */
  priceMultiplier: number
  /** Sell price = item value * this */
  sellMultiplier: number
  /** Inventory size range [min, max] */
  inventorySize: [number, number]
  /** Item tier range [min, max] */
  tierRange: [number, number]
  minDepth: number
  /** Base gold the merchant has for buying items */
  baseGold: number
  dialogue: MerchantDialogue
}

export const MERCHANTS: MerchantTemplate[] = [
  {
    id: 'wandering_trader',
    name: 'Wandering Trader',
    char: '@',
    color: 0x22c55e, // green
    shopType: 'mixed',
    priceMultiplier: 2.5,
    sellMultiplier: 0.3,
    inventorySize: [4, 8],
    tierRange: [1, 2],
    minDepth: 5,
    baseGold: 500,
    dialogue: {
      greeting: [
        'Welcome, traveler! Care to browse my wares?',
        'Ah, a customer! Take a look around.',
        'Greetings! I have just what you need.',
      ],
      purchase: ['A fine choice!', "You won't regret it!", 'Pleasure doing business!'],
      sell: ['I can work with this.', "Fair enough, it's a deal.", 'This will sell nicely.'],
      farewell: ['Safe travels!', 'Come back anytime!', 'May fortune favor you!'],
      tooExpensive: ['Come back when you have more gold.', 'Perhaps something cheaper?'],
      cantAfford: ["I can't afford that right now.", 'My purse is too light for that.'],
    },
  },
  {
    id: 'arms_dealer',
    name: 'Arms Dealer',
    char: '@',
    color: 0xef4444, // red
    shopType: 'weapon',
    priceMultiplier: 2.0,
    sellMultiplier: 0.4,
    inventorySize: [3, 6],
    tierRange: [1, 3],
    minDepth: 12,
    baseGold: 800,
    dialogue: {
      greeting: ['Looking for something with an edge?', 'The finest blades this side of the dungeon!'],
      purchase: ['May it serve you well in battle!', 'Strike true!'],
      sell: ["A warrior's blade deserves respect.", 'This has seen some action.'],
      farewell: ['Fight well!', 'May your enemies fall before you!'],
      tooExpensive: ['Quality costs gold, friend.', 'These are battle-tested weapons.'],
      cantAfford: ['I deal in weapons, not trinkets.', 'Bring me something of value.'],
    },
  },
  {
    id: 'armorer',
    name: 'Traveling Armorer',
    char: '@',
    color: 0x64748b, // slate
    shopType: 'armor',
    priceMultiplier: 2.0,
    sellMultiplier: 0.35,
    inventorySize: [3, 5],
    tierRange: [1, 3],
    minDepth: 10,
    baseGold: 700,
    dialogue: {
      greeting: ['Protection is priceless!', 'The best armor in the depths!'],
      purchase: ['May it turn aside many blows!', 'Wear it well!'],
      sell: ['Still has some life in it.', 'I can repair this.'],
      farewell: ['Stay safe down there!', 'Armor saves lives!'],
      tooExpensive: ['Good armor is worth every coin.', 'Your life is worth the price.'],
      cantAfford: ['Bring me armor, not junk.', 'I only deal in quality goods.'],
    },
  },
  {
    id: 'alchemist',
    name: 'Dungeon Alchemist',
    char: '@',
    color: 0x8b5cf6, // purple
    shopType: 'potion',
    priceMultiplier: 1.8,
    sellMultiplier: 0.25,
    inventorySize: [5, 10],
    tierRange: [1, 3],
    minDepth: 8,
    baseGold: 400,
    dialogue: {
      greeting: ['Potions! Elixirs! Brewed fresh!', 'What ails you? I have the cure!'],
      purchase: ['Drink responsibly!', 'One sip and you will feel the difference!'],
      sell: ['Hmm, I can recycle this.', 'The ingredients may be useful.'],
      farewell: ["Don't forget to hydrate!", 'May your flasks never run dry!'],
      tooExpensive: ["Quality ingredients aren't cheap!", 'Alchemy is an expensive art.'],
      cantAfford: ['I need potions or gold.', 'Empty flasks are worthless to me.'],
    },
  },
  {
    id: 'scroll_merchant',
    name: 'Mystic Scribe',
    char: '@',
    color: 0xfbbf24, // amber
    shopType: 'scroll',
    priceMultiplier: 2.2,
    sellMultiplier: 0.3,
    inventorySize: [4, 8],
    tierRange: [1, 3],
    minDepth: 10,
    baseGold: 600,
    dialogue: {
      greeting: ['Knowledge is power!', 'Ancient scrolls, arcane wisdom!'],
      purchase: ['Use it wisely!', 'The words hold great power!'],
      sell: ['Ah, more texts for my collection.', 'The ink is still legible.'],
      farewell: ['May the words guide you!', 'Knowledge protects!'],
      tooExpensive: ['Wisdom has its price.', 'These scrolls are quite rare.'],
      cantAfford: ['Bring me scrolls or gold.', 'I deal in knowledge, not junk.'],
    },
  },
  {
    id: 'black_market',
    name: 'Shady Dealer',
    char: '@',
    color: 0x6b21a8, // dark purple
    shopType: 'blackmarket',
    priceMultiplier: 4.0,
    sellMultiplier: 0.5, // Better sell prices
    inventorySize: [3, 5],
    tierRange: [3, 4], // High-tier items only
    minDepth: 30,
    baseGold: 2000,
    dialogue: {
      greeting: ["*whispers* You didn't see me here...", 'Looking for something... special?'],
      purchase: ['Pleasure doing business.', '*nods* Good choice.'],
      sell: ['No questions asked.', "*examines* I'll take it."],
      farewell: ['Forget we ever met.', '*disappears into shadows*'],
      tooExpensive: ['These are rare goods. The price is firm.', 'Take it or leave it.'],
      cantAfford: ["I don't deal in common goods.", 'Bring me something valuable.'],
    },
  },
]

/**
 * Get merchants available at a given depth
 */
export function getMerchantsForDepth(depth: number): MerchantTemplate[] {
  return MERCHANTS.filter((m) => m.minDepth <= depth)
}

/**
 * Select a random merchant for a depth
 */
export function selectMerchant(depth: number): MerchantTemplate | null {
  const available = getMerchantsForDepth(depth)
  if (available.length === 0) return null

  // Weight towards general merchants, rare for specialized
  const weights = available.map((m) => {
    if (m.shopType === 'mixed' || m.shopType === 'general') return 3
    if (m.shopType === 'blackmarket') return 1
    return 2
  })

  const totalWeight = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * totalWeight

  for (let i = 0; i < available.length; i++) {
    roll -= weights[i]!
    if (roll <= 0) return available[i]!
  }

  return available[0]!
}

/**
 * Get merchant by ID
 */
export function getMerchantById(id: string): MerchantTemplate | undefined {
  return MERCHANTS.find((m) => m.id === id)
}

/**
 * Get a random dialogue line
 */
export function getDialogue(
  template: MerchantTemplate,
  type: keyof MerchantDialogue
): string {
  const lines = template.dialogue[type]
  return lines[Math.floor(Math.random() * lines.length)] ?? ''
}
