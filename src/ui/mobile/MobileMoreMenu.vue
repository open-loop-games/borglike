<script setup lang="ts">
import { Icons } from '@/ui/icons'
import Icon from '@/ui/components/common/Icon.vue'

const emit = defineEmits<{
  navigate: [target: string]
}>()

const items = [
  { id: 'achievements', icon: Icons.achievements, label: 'Achievements' },
  { id: 'bestiary', icon: Icons.bestiary, label: 'Bestiary' },
  { id: 'armory', icon: Icons.armory, label: 'Armory' },
  { id: 'codex', icon: Icons.codex, label: 'Codex' },
  { id: 'history', icon: Icons.history, label: 'History' },
  { id: 'settings', icon: Icons.settings, label: 'Settings' },
  { id: 'help', icon: Icons.help, label: 'Help' },
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
      <Icon class="menu-icon" :name="item.icon" />
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
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.menu-item:active {
  background: var(--bg-highlight);
  border-color: var(--accent);
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
