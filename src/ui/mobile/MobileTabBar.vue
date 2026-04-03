<script setup lang="ts">
export type MobileTab = 'runs' | 'upgrades' | 'unlocks' | 'stats' | 'more'

defineProps<{
  activeTab: MobileTab
}>()

const emit = defineEmits<{
  'tab-change': [tab: MobileTab]
}>()

const tabs: Array<{ id: MobileTab; icon: string; label: string }> = [
  { id: 'runs', icon: '\u2694', label: 'Runs' },
  { id: 'upgrades', icon: '\u2B06', label: 'Upgrades' },
  { id: 'unlocks', icon: '\uD83D\uDD13', label: 'Unlocks' },
  { id: 'stats', icon: '\uD83D\uDCCA', label: 'Stats' },
  { id: 'more', icon: '\u2630', label: 'More' },
]
</script>

<template>
  <nav class="tab-bar">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ active: activeTab === tab.id }"
      @click="emit('tab-change', tab.id)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--panel);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom);
  flex-shrink: 0;
}

.tab-item {
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

.tab-item.active {
  color: var(--purple);
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
