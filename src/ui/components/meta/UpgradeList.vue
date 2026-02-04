<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import UpgradeItem from './UpgradeItem.vue'

const progression = useProgressionStore()

type Category = 'stats' | 'meta' | 'qol'

const activeCategory = ref<Category>('stats')

const categories: { id: Category; label: string; icon: string }[] = [
  { id: 'stats', label: 'Stats', icon: '♥' },
  { id: 'meta', label: 'Meta', icon: '◆' },
  { id: 'qol', label: 'QoL', icon: '▶' },
]

const currentUpgrades = computed(() => {
  return progression.upgradesByCategory[activeCategory.value]
})

function handlePurchase(upgradeId: string) {
  progression.purchaseUpgrade(upgradeId)
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
        @click="activeCategory = cat.id"
      >
        <span class="tab-icon">{{ cat.icon }}</span>
        <span class="tab-label">{{ cat.label }}</span>
      </button>
    </div>

    <div class="upgrades-scroll">
      <UpgradeItem
        v-for="upgrade in currentUpgrades"
        :key="upgrade.id"
        v-bind="upgrade"
        @purchase="handlePurchase"
      />

      <div v-if="currentUpgrades.length === 0" class="no-upgrades">
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
  padding: var(--space-2);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.category-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.category-tab:hover {
  background: var(--highlight);
}

.category-tab.active {
  background: var(--highlight);
  border-color: var(--purple);
}

.tab-icon {
  font-size: var(--text-lg);
  color: var(--text-dim);
}

.category-tab.active .tab-icon {
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
}

.tab-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
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
  gap: var(--space-2);
}

.no-upgrades {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-dim);
  font-style: italic;
  font-size: var(--text-base);
}
</style>
