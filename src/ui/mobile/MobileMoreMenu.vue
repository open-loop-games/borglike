<script setup lang="ts">
const emit = defineEmits<{
  navigate: [target: string]
}>()

const items = [
  { id: 'achievements', icon: '\uD83C\uDFC6', label: 'Achievements' },
  { id: 'bestiary', icon: '\uD83D\uDCD6', label: 'Bestiary' },
  { id: 'armory', icon: '\uD83D\uDCE6', label: 'Armory' },
  { id: 'codex', icon: '\uD83D\uDCDC', label: 'Codex' },
  { id: 'history', icon: '\u2261', label: 'History' },
  { id: 'settings', icon: '\u2699', label: 'Settings' },
  { id: 'help', icon: '?', label: 'Help' },
]
</script>

<template>
  <div class="more-menu">
    <button
      v-for="item in items"
      :key="item.id"
      class="menu-item"
      @click="emit('navigate', item.id)"
    >
      <span class="menu-icon">{{ item.icon }}</span>
      <span class="menu-label">{{ item.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.more-menu {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  padding: var(--space-4);
}

.menu-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-2);
  background: var(--elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:active {
  background: var(--highlight);
  border-color: var(--indigo);
  color: var(--text-primary);
}

.menu-icon {
  font-size: var(--text-3xl);
}

.menu-label {
  font-size: var(--text-sm);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
