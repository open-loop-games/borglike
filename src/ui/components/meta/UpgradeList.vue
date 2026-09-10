<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import {
  getBotUpgradeById,
  getNextGradedUpgrade,
  canPurchaseBotUpgrade,
  type BotUpgradeId,
  type GradedCapabilityField,
} from '@game/data/bot-upgrades'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import EssenceCard from './EssenceCard.vue'
import LevelPips from './LevelPips.vue'
import UpgradeItem from './UpgradeItem.vue'
import { STAR_UPGRADES, starUpgradeCost } from '@game/data/prestige'

const progression = useProgressionStore()

type Category = 'stats' | 'meta' | 'qol' | 'bot' | 'prestige'

// Default to the frontier (Bot), not Stats — progressive disclosure opens the
// player on the capability surface that drives early depth (studio/borglike#2).
const activeCategory = ref<Category>('bot')

const allCategories: { id: Category; label: string; icon: string }[] = [
  { id: 'stats', label: 'Stats', icon: Icons.categoryStats },
  { id: 'bot', label: 'Bot', icon: Icons.categoryBot },
  { id: 'meta', label: 'Meta', icon: Icons.categoryMeta },
  { id: 'qol', label: 'QoL', icon: Icons.categoryQol },
  { id: 'prestige', label: 'Prestige', icon: Icons.prestige },
]

// Meta is a "wide"-phase reveal; prestige is the deepest rung (depth-gated,
// studio/borglike#3). The rest are present from Boot.
const categories = computed(() =>
  allCategories.filter(
    (c) =>
      (c.id !== 'meta' || progression.reveal.wide) &&
      (c.id !== 'prestige' || progression.reveal.prestige)
  )
)

const categoryPips: Record<string, string> = {
  meta: 'chip-meta',
  prestige: 'chip-prestige',
}

function selectCategory(id: Category) {
  activeCategory.value = id
  const pip = categoryPips[id]
  if (pip) progression.markRevealSeen(pip)
}

const currentUpgrades = computed(() => {
  const list =
    progression.upgradesByCategory[activeCategory.value as 'stats' | 'meta' | 'qol'] ?? []
  // Run-slot cards reveal by phase; everything else is always shown.
  return list.filter((u) => progression.isUpgradeRevealed(u.id))
})

// Bot upgrade chains mapped to UpgradeItem shape (one card per capability).
// Ordered by value-density: value caps (town/preparedness/surf) lead; the cheap
// trap chains (tactics/targeting/retreat) sink to the bottom (studio/borglike#2).
// `summary` states the strategic "why" of the whole capability; the per-tier
// behaviour comes from each upgrade's own description in bot-upgrades.ts.
const gradedChains: {
  field: GradedCapabilityField
  name: string
  icon: string
  summary: string
}[] = [
  {
    field: 'town',
    name: 'Town',
    icon: Icons.capTown,
    summary:
      'Round-trips to town to heal, restock, and trade — turns a one-way dive into a sustainable loop.',
  },
  {
    field: 'preparedness',
    name: 'Preparedness',
    icon: Icons.capPreparedness,
    summary:
      "Gates descent on real readiness, so the bot stops diving into fights it can't survive.",
  },
  {
    field: 'surf',
    name: 'Surf Farming',
    icon: Icons.capSurf,
    summary:
      'Tethers farming to a safe radius around the stairs — grind without wandering into danger.',
  },
  {
    field: 'kiting',
    name: 'Kiting',
    icon: Icons.capKiting,
    summary: 'Keeps ranged fighters at distance instead of trading blows toe-to-toe.',
  },
  {
    field: 'tactics',
    name: 'Tactics',
    icon: Icons.capTactics,
    summary: 'Spends mana on debuffs and buffs instead of only swinging the weapon.',
  },
  {
    field: 'targeting',
    name: 'Targeting',
    icon: Icons.capTargeting,
    summary: 'Picks the highest-value target instead of just the nearest body.',
  },
  {
    field: 'retreat',
    name: 'Retreat',
    icon: Icons.capRetreat,
    summary: 'Recognizes a losing fight and flees before the bot dies in it.',
  },
]

const ROMAN = ['I', 'II', 'III'] as const

const botUpgradeItems = computed(() => {
  const caps = progression.botCapabilities
  const ess = progression.currency.essence
  type Tier = { label: string; desc: string; owned: boolean; isNext: boolean; cost: number | null }
  const items: {
    id: string
    name: string
    description: string
    icon: string
    currentLevel: number
    maxLevel: number
    cost: number
    canAfford: boolean
    isMaxed: boolean
    summary: string
    tiers: Tier[]
  }[] = []

  // Farming toggle — a single-tier capability (own it or not).
  const farmingUnlocked = caps.farming
  const farmingCost = getBotUpgradeById('farming')?.cost ?? 200
  items.push({
    id: 'farming',
    name: 'Resource Farming',
    description: 'Farms gold/XP when under-leveled for descent',
    icon: Icons.capFarming,
    currentLevel: farmingUnlocked ? 1 : 0,
    maxLevel: 1,
    cost: farmingUnlocked ? 0 : farmingCost,
    canAfford: !farmingUnlocked && canPurchaseBotUpgrade('farming', caps, ess),
    isMaxed: farmingUnlocked,
    summary:
      "Lets the bot grind gold and XP when it's under-leveled, instead of diving in unprepared.",
    tiers: [
      {
        label: '',
        desc: 'Farms gold/XP when under-leveled for descent',
        owned: farmingUnlocked,
        isNext: !farmingUnlocked,
        cost: farmingUnlocked ? null : farmingCost,
      },
    ],
  })

  // Graded chains: one card per field (surf requires farming). The card shows
  // the next action; the tooltip shows the full owned→next→ahead tier ladder.
  for (const chain of gradedChains) {
    if (chain.field === 'surf' && !farmingUnlocked) continue
    const currentLevel = caps[chain.field]
    const next = getNextGradedUpgrade(chain.field, caps)
    const nextId = next?.id
    const currentDesc =
      currentLevel > 0
        ? getBotUpgradeById(`${chain.field}_${currentLevel}` as BotUpgradeId)?.description
        : undefined
    const tiers: Tier[] = ROMAN.map((label, i) => {
      const level = i + 1
      const def = getBotUpgradeById(`${chain.field}_${level}` as BotUpgradeId)
      const isNext = currentLevel + 1 === level
      return {
        label,
        desc: def?.description ?? '',
        owned: currentLevel >= level,
        isNext,
        cost: isNext ? (def?.cost ?? null) : null,
      }
    })
    items.push({
      id: nextId ?? `${chain.field}_3`,
      name: chain.name,
      description: next?.description ?? currentDesc ?? '',
      icon: chain.icon,
      currentLevel,
      maxLevel: 3,
      cost: next?.cost ?? 0,
      canAfford: nextId ? canPurchaseBotUpgrade(nextId, caps, ess) : false,
      isMaxed: currentLevel >= 3,
      summary: chain.summary,
      tiers,
    })
  }

  return items
})

const displayedUpgrades = computed(() => {
  if (activeCategory.value === 'bot') return botUpgradeItems.value
  if (activeCategory.value === 'prestige') return []
  return currentUpgrades.value
})

function handlePurchase(upgradeId: string) {
  if (activeCategory.value === 'bot') {
    progression.purchaseBotUpgrade(upgradeId as BotUpgradeId)
  } else {
    progression.purchaseUpgrade(upgradeId)
  }
}

// Prestige section (studio/borglike#3): the reset action plus the permanent
// star tree. Stars are spent here, so costs read in stars, not essence.
const prestigePreview = computed(() => progression.getPrestigePreview())
const prestigeActionDescription = computed(() => {
  const p = prestigePreview.value
  const stars =
    p.starsGain > 0
      ? `Gain ${p.starsGain} star${p.starsGain === 1 ? '' : 's'}`
      : 'No new stars yet — deeper lifetime essence earns more'
  const floor = p.essenceFloor > 0 ? ` Essence restarts at ${p.essenceFloor}.` : ''
  const kept = p.keepsEssenceBoost ? ' Essence Boost survives.' : ''
  return `Reset upgrades and essence, keep bot caps. ${stars}. Income ×${p.newMultiplier}.${floor}${kept}`
})

const starItems = computed(() =>
  STAR_UPGRADES.map((def) => {
    const level = progression.starUpgradeLevels[def.id] || 0
    const cost = starUpgradeCost(def.id, level)
    return {
      ...def,
      currentLevel: level,
      cost,
      isMaxed: cost === null,
      canAfford: cost !== null && progression.starBalance >= cost,
    }
  })
)

function doPrestige() {
  progression.prestige()
}

function buyStar(id: string) {
  progression.purchaseStarUpgrade(id)
}
</script>

<template>
  <div class="upgrade-list">
    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="category-tab"
        :class="{ active: activeCategory === cat.id }"
        @click="selectCategory(cat.id)"
      >
        <Icon class="tab-icon" :name="cat.icon" />
        <span class="tab-label">{{ cat.label }}</span>
        <span
          v-if="categoryPips[cat.id] && progression.pendingPips.has(categoryPips[cat.id]!)"
          class="tab-pip"
        ></span>
      </button>
    </div>

    <div class="upgrades-scroll">
      <template v-if="activeCategory === 'prestige'">
        <div class="star-balance">
          <Icon :name="Icons.prestige" />
          <span
            >{{ progression.starBalance }} star{{
              progression.starBalance === 1 ? '' : 's'
            }}
            banked</span
          >
        </div>
        <EssenceCard
          :icon="Icons.prestige"
          name="Prestige Reset"
          :state="progression.canPrestige ? 'afford' : 'cantafford'"
          :description="prestigeActionDescription"
          :actionable="progression.canPrestige"
          @action="doPrestige"
        >
          <template #meta>
            <span class="prestige-level">Lv {{ progression.prestigeLevel }}</span>
          </template>
          <template #cost>
            <template v-if="prestigePreview.starsGain > 0">
              <Icon :name="Icons.prestige" />
              <span>+{{ prestigePreview.starsGain }}</span>
            </template>
            <template v-else><span>RESET</span></template>
          </template>
        </EssenceCard>
        <EssenceCard
          v-for="star in starItems"
          :key="star.id"
          :icon="Icons.prestige"
          :name="star.name"
          :state="star.isMaxed ? 'maxed' : star.canAfford ? 'afford' : 'cantafford'"
          :description="star.description"
          :actionable="star.canAfford && !star.isMaxed"
          @action="buyStar(star.id)"
        >
          <template #meta>
            <LevelPips :current="star.currentLevel" :max="star.maxLevel" :maxed="star.isMaxed" />
          </template>
          <template #cost>
            <template v-if="star.isMaxed">MAX</template>
            <template v-else>
              <Icon :name="Icons.prestige" />
              <span>{{ star.cost }}</span>
            </template>
          </template>
        </EssenceCard>
      </template>
      <template v-else>
        <UpgradeItem
          v-for="upgrade in displayedUpgrades"
          :key="upgrade.id"
          v-bind="upgrade"
          @purchase="handlePurchase"
        />

        <div v-if="displayedUpgrades.length === 0" class="no-upgrades">
          No upgrades in this category
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.upgrade-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.category-tabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}

.category-tab {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-1) var(--space-1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

/* "New" pip — mirrors AppHeader's notification-dot. */
.tab-pip {
  position: absolute;
  top: 2px;
  right: 4px;
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  animation: notification-pulse 1.5s infinite;
}

.category-tab:hover {
  background: var(--bg-highlight);
}

.category-tab.active {
  background: var(--bg-highlight);
  border-bottom: 2px solid var(--essence);
}

.tab-icon {
  font-size: var(--text-xl);
  color: var(--text-dim);
}

.category-tab.active .tab-icon {
  color: var(--essence);
  text-shadow: 0 0 6px color-mix(in srgb, var(--essence) 50%, transparent);
}

.tab-label {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.category-tab.active .tab-label {
  color: var(--text-secondary);
}

.upgrades-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.no-upgrades {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-dim);
  font-style: italic;
  font-size: var(--text-base);
}

.star-balance {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  font-weight: bold;
  color: var(--text-secondary);
}

.prestige-level {
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}
</style>
