<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import UnlockItem from './UnlockItem.vue'

const progression = useProgressionStore()

type Tab = 'races' | 'classes'

const activeTab = ref<Tab>('races')

const currentUnlocks = computed(() => {
  if (activeTab.value === 'races') {
    return progression.raceUnlocks.map((r) => ({
      ...r,
      canAfford: progression.currency.essence >= r.cost,
      type: 'race' as const,
    }))
  } else {
    return progression.classUnlocks.map((c) => ({
      ...c,
      canAfford: progression.currency.essence >= c.cost,
      type: 'class' as const,
    }))
  }
})

const unlockedCount = computed(() => {
  if (activeTab.value === 'races') {
    return progression.availableRaces.length
  }
  return progression.availableClasses.length
})

const totalCount = computed(() => {
  if (activeTab.value === 'races') {
    return progression.raceUnlocks.length + 3 // +3 for starting races
  }
  return progression.classUnlocks.length + 3 // +3 for starting classes
})

function handleUnlock(name: string, type: 'race' | 'class') {
  const item = currentUnlocks.value.find((u) => u.name === name)
  if (!item) return

  if (type === 'race') {
    progression.unlockRace(name, item.cost)
  } else {
    progression.unlockClass(name, item.cost)
  }
}
</script>

<template>
  <div class="unlock-list">
    <div class="unlock-tabs">
      <button
        class="unlock-tab"
        :class="{ active: activeTab === 'races' }"
        @click="activeTab = 'races'"
      >
        <span class="tab-label">Races</span>
        <span class="tab-count">{{ progression.availableRaces.length }}</span>
      </button>
      <button
        class="unlock-tab"
        :class="{ active: activeTab === 'classes' }"
        @click="activeTab = 'classes'"
      >
        <span class="tab-label">Classes</span>
        <span class="tab-count">{{ progression.availableClasses.length }}</span>
      </button>
    </div>

    <div class="unlock-header">
      <span class="header-text">{{ unlockedCount }} / {{ totalCount }} Unlocked</span>
    </div>

    <div class="unlocks-scroll">
      <UnlockItem
        v-for="item in currentUnlocks"
        :id="item.id"
        :key="item.id"
        :name="item.name"
        :description="item.description"
        :is-unlocked="item.isUnlocked"
        :cost="item.cost"
        :can-afford="item.canAfford"
        :unlock-condition="item.unlockCondition"
        :prestige="item.prestige"
        :type="item.type"
        @unlock="handleUnlock"
      />

      <div v-if="currentUnlocks.length === 0" class="no-unlocks">All {{ activeTab }} unlocked!</div>
    </div>
  </div>
</template>

<style scoped>
.unlock-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.unlock-tabs {
  display: flex;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.unlock-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-tab:hover {
  background: var(--highlight);
}

.unlock-tab.active {
  border-bottom-color: var(--cyan);
}

.tab-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.unlock-tab.active .tab-label {
  color: var(--cyan);
}

.tab-count {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 6px;
  background: var(--highlight);
  border-radius: 10px;
  color: var(--text-dim);
}

.unlock-tab.active .tab-count {
  background: rgba(6, 182, 212, 0.2);
  color: var(--cyan);
}

.unlock-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.header-text {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.unlocks-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.no-unlocks {
  text-align: center;
  padding: 24px;
  color: var(--green);
  font-style: italic;
  font-size: 12px;
}
</style>
