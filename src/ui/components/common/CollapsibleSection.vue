<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  expanded: boolean
  badge?: string | number
}>()

const emit = defineEmits<{
  toggle: []
}>()

const chevron = computed(() => props.expanded ? '\u25BE' : '\u25B8')
</script>

<template>
  <div class="collapsible-section" :class="{ collapsed: !expanded }">
    <button class="section-header" @click="emit('toggle')">
      <span class="chevron">{{ chevron }}</span>
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
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(18, 18, 31, 0.98) 100%);
  border: 1px solid var(--border);
  border-top-color: var(--border-light);
  border-left-color: var(--border-light);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 2px 6px rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.collapsible-section.collapsed {
  opacity: 0.8;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: all 0.15s;
}

.section-header:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-secondary);
}

.chevron {
  font-size: 8px;
  width: 10px;
  color: var(--text-dim);
  transition: color 0.15s;
}

.section-header:hover .chevron {
  color: var(--indigo);
}

.title {
  flex: 1;
  text-align: left;
}

.badge {
  font-size: 9px;
  padding: 1px 5px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
}

.section-content {
  padding: 6px 8px 8px;
  border-top: 1px solid var(--border);
}
</style>
