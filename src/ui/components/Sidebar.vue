<script setup lang="ts">
import { ref } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import UpgradeList from './meta/UpgradeList.vue'
import UnlockList from './meta/UnlockList.vue'
import StatsView from './StatsView.vue'

type Tab = 'stats' | 'upgrades' | 'unlocks'
const activeTab = ref<Tab>('upgrades')

const progression = useProgressionStore()

function selectTab(tab: Tab, pipKey?: string) {
  activeTab.value = tab
  if (pipKey) progression.markRevealSeen(pipKey)
}
</script>

<template>
  <div class="sidebar-container">
    <div class="sidebar-tabs">
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'upgrades' }"
        @click="selectTab('upgrades')"
      >
        Upgrades
      </button>
      <button
        v-if="progression.reveal.selectable"
        class="sidebar-tab"
        :class="{ active: activeTab === 'unlocks' }"
        @click="selectTab('unlocks', 'tab-unlocks')"
      >
        Unlocks
        <span v-if="progression.pendingPips.has('tab-unlocks')" class="tab-pip"></span>
      </button>
      <button
        v-if="progression.reveal.selectable"
        class="sidebar-tab"
        :class="{ active: activeTab === 'stats' }"
        @click="selectTab('stats', 'tab-stats')"
      >
        Statistics
        <span v-if="progression.pendingPips.has('tab-stats')" class="tab-pip"></span>
      </button>
    </div>

    <div class="sidebar-content">
      <!-- Stats Tab -->
      <div v-if="activeTab === 'stats'" class="tab-content">
        <StatsView />
      </div>

      <!-- Upgrades Tab -->
      <div v-else-if="activeTab === 'upgrades'" class="tab-content full-height">
        <UpgradeList />
      </div>

      <!-- Unlocks Tab -->
      <div v-else-if="activeTab === 'unlocks'" class="tab-content full-height">
        <UnlockList />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-tabs {
  display: flex;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-tab {
  position: relative;
  flex: 1;
  padding: var(--space-3) var(--space-2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

/* "New" pip — mirrors AppHeader's notification-dot. */
.tab-pip {
  position: absolute;
  top: 6px;
  right: 6px;
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

.sidebar-tab:hover {
  background: var(--bg-highlight);
  color: var(--text-primary);
}

.sidebar-tab.active {
  color: var(--essence);
  border-bottom-color: var(--essence);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
}

.tab-content.full-height {
  display: flex;
  flex-direction: column;
}

.tab-content:not(.full-height) {
  padding: 0;
}
</style>
