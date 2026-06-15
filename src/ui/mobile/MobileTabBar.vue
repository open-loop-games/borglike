<script setup lang="ts">
import { computed } from 'vue'
import { Icons } from '@/ui/icons'
import Icon from '@/ui/components/common/Icon.vue'
import { useProgressionStore } from '@/stores/progression'

export type MobileTab = 'runs' | 'upgrades' | 'unlocks' | 'stats' | 'more'

defineProps<{
  activeTab: MobileTab
}>()

const emit = defineEmits<{
  'tab-change': [tab: MobileTab]
}>()

const progression = useProgressionStore()

// Unlocks/Stats are a "selectable"-phase reveal; the pip key drives the "new"
// dot until the tab is opened (studio/borglike#2).
const allTabs: Array<{ id: MobileTab; icon: string; label: string; pip?: string }> = [
  { id: 'runs', icon: Icons.runs, label: 'Runs' },
  { id: 'upgrades', icon: Icons.upgrades, label: 'Upgrades' },
  { id: 'unlocks', icon: Icons.unlocks, label: 'Unlocks', pip: 'tab-unlocks' },
  { id: 'stats', icon: Icons.stats, label: 'Stats', pip: 'tab-stats' },
  { id: 'more', icon: Icons.more, label: 'More' },
]

const tabs = computed(() =>
  allTabs.filter((t) => (t.id !== 'unlocks' && t.id !== 'stats') || progression.reveal.selectable)
)

function selectTab(tab: { id: MobileTab; pip?: string }) {
  emit('tab-change', tab.id)
  if (tab.pip) progression.markRevealSeen(tab.pip)
}
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: activeTab === tab.id }"
      @click="selectTab(tab)"
    >
      <Icon class="tab-icon" :name="tab.icon" />
      <span class="tab-label">{{ tab.label }}</span>
      <span v-if="tab.pip && progression.pendingPips.has(tab.pip)" class="tab-pip"></span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

.tab-item {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-2) 0;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  transition: color 0.2s;
}

/* "New" pip — mirrors AppHeader's notification-dot. */
.tab-pip {
  position: absolute;
  top: 4px;
  right: calc(50% - 18px);
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  animation: notification-pulse 1.5s infinite;
}

.tab-item.active {
  color: var(--essence);
}

.tab-icon {
  font-size: var(--text-xl);
}

.tab-label {
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
