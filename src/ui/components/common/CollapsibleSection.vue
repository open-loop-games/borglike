<script setup lang="ts">
import Icon from './Icon.vue'
import { Icons } from '@/ui/icons'

defineProps<{
  title: string
  expanded: boolean
  badge?: string | number
}>()

defineEmits<{
  toggle: []
}>()
</script>

<template>
  <div class="collapsible-section" :class="{ collapsed: !expanded }">
    <button class="section-header" type="button" :aria-expanded="expanded" @click="$emit('toggle')">
      <Icon class="chevron" :class="{ open: expanded }" :name="Icons.caretRight" />
      <span class="title">{{ title }}</span>
      <span v-if="badge !== undefined" class="badge">{{ badge }}</span>
    </button>
    <div v-if="expanded" class="section-content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.collapsible-section {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%,
    color-mix(in srgb, var(--bg-panel) 98%, transparent) 100%
  );
  border: 1px solid var(--border);
  border-top-color: var(--border-light);
  border-left-color: var(--border-light);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 2px 6px rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.collapsible-section.collapsed {
  opacity: 0.8;
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--text-base);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s;
}

.section-header:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
}

.chevron {
  width: 10px;
  color: var(--text-muted);
  transition:
    color 0.15s,
    transform 0.15s;
}

.chevron.open {
  transform: rotate(90deg);
}

.section-header:hover .chevron {
  color: var(--accent);
}

.title {
  flex: 1;
  text-align: left;
}

.badge {
  font-size: var(--text-sm);
  padding: 1px 5px;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.section-content {
  padding: var(--space-2) var(--space-2) var(--space-2);
  border-top: 1px solid var(--border);
}
</style>
