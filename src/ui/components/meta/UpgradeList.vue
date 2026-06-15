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
import UpgradeItem from './UpgradeItem.vue'

const progression = useProgressionStore()

type Category = 'stats' | 'meta' | 'qol' | 'bot'

// Default to the frontier (Bot), not Stats — progressive disclosure opens the
// player on the capability surface that drives early depth (studio/borglike#2).
const activeCategory = ref<Category>('bot')

const allCategories: { id: Category; label: string; icon: string }[] = [
  { id: 'stats', label: 'Stats', icon: Icons.categoryStats },
  { id: 'bot', label: 'Bot', icon: Icons.categoryBot },
  { id: 'meta', label: 'Meta', icon: Icons.categoryMeta },
  { id: 'qol', label: 'QoL', icon: Icons.categoryQol },
]

// Meta is a "wide"-phase reveal; the rest are present from Boot.
const categories = computed(() =>
  allCategories.filter((c) => c.id !== 'meta' || progression.reveal.wide)
)

function selectCategory(id: Category) {
  activeCategory.value = id
  if (id === 'meta') progression.markRevealSeen('chip-meta')
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
const gradedChains: { field: GradedCapabilityField; name: string; icon: string }[] = [
  { field: 'town', name: 'Town', icon: Icons.capTown },
  { field: 'preparedness', name: 'Preparedness', icon: Icons.capPreparedness },
  { field: 'surf', name: 'Surf Farming', icon: Icons.capSurf },
  { field: 'kiting', name: 'Kiting', icon: Icons.capKiting },
  { field: 'tactics', name: 'Tactics', icon: Icons.capTactics },
  { field: 'targeting', name: 'Targeting', icon: Icons.capTargeting },
  { field: 'retreat', name: 'Retreat', icon: Icons.capRetreat },
]

const botUpgradeItems = computed(() => {
  const caps = progression.botCapabilities
  const ess = progression.currency.essence
  const items: {
    id: string
    name: string
    description: string
    icon: string
    currentLevel: number
    maxLevel: number
    cost: number
    costScaling: number
    canAfford: boolean
    isMaxed: boolean
    effectValue: number
    effect: { type: 'flat' | 'percent' | 'unlock'; baseValue: number; perLevel: number }
  }[] = []

  // Farming toggle as unlock-type card
  const farmingUnlocked = caps.farming
  items.push({
    id: 'farming',
    name: 'Resource Farming',
    description: 'Farms gold/XP when under-leveled for descent',
    icon: Icons.capFarming,
    currentLevel: farmingUnlocked ? 1 : 0,
    maxLevel: 1,
    cost: farmingUnlocked ? 0 : (getBotUpgradeById('farming')?.cost ?? 200),
    costScaling: 1,
    canAfford: !farmingUnlocked && canPurchaseBotUpgrade('farming', caps, ess),
    isMaxed: farmingUnlocked,
    effectValue: farmingUnlocked ? 1 : 0,
    effect: { type: 'unlock' as const, baseValue: 0, perLevel: 1 },
  })

  // Graded chains: one card per field (sweep/surf require farming)
  for (const chain of gradedChains) {
    if (chain.field === 'surf' && !farmingUnlocked) continue
    const currentLevel = caps[chain.field]
    const next = getNextGradedUpgrade(chain.field, caps)
    const nextId = next?.id
    const currentDesc =
      currentLevel > 0
        ? getBotUpgradeById(`${chain.field}_${currentLevel}` as BotUpgradeId)?.description
        : undefined
    items.push({
      id: nextId ?? `${chain.field}_3`,
      name: chain.name,
      description: next?.description ?? currentDesc ?? '',
      icon: chain.icon,
      currentLevel,
      maxLevel: 3,
      cost: next?.cost ?? 0,
      costScaling: 1,
      canAfford: nextId ? canPurchaseBotUpgrade(nextId, caps, ess) : false,
      isMaxed: currentLevel >= 3,
      effectValue: currentLevel,
      effect: { type: 'flat' as const, baseValue: 0, perLevel: 1 },
    })
  }

  return items
})

const displayedUpgrades = computed(() => {
  if (activeCategory.value === 'bot') return botUpgradeItems.value
  return currentUpgrades.value
})

function handlePurchase(upgradeId: string) {
  if (activeCategory.value === 'bot') {
    progression.purchaseBotUpgrade(upgradeId as BotUpgradeId)
  } else {
    progression.purchaseUpgrade(upgradeId)
  }
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
          v-if="cat.id === 'meta' && progression.pendingPips.has('chip-meta')"
          class="tab-pip"
        ></span>
      </button>
    </div>

    <div class="upgrades-scroll">
      <UpgradeItem
        v-for="upgrade in displayedUpgrades"
        :key="upgrade.id"
        v-bind="upgrade"
        @purchase="handlePurchase"
      />

      <div v-if="displayedUpgrades.length === 0" class="no-upgrades">
        No upgrades in this category
      </div>
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

@keyframes notification-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 70%, transparent);
  }
  70% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--success) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 0%, transparent);
  }
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
</style>
