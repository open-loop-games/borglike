<script setup lang="ts">
import type { Toast } from '@/stores/notifications'

defineProps<{ toast: Toast }>()
defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="toast" :class="`toast--${toast.kind}`" role="status" aria-live="polite">
    <div class="toast-accent" />
    <div class="toast-content">
      <div class="toast-title" :class="`glow-${toast.kind}`">{{ toast.title }}</div>
      <div v-if="toast.body" class="toast-text">{{ toast.body }}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss" @click="$emit('dismiss')">×</button>
  </div>
</template>

<style scoped>
.toast {
  --toast-color: var(--info);
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  gap: var(--space-3);
  min-width: 240px;
  max-width: 360px;
  padding: var(--space-3) var(--space-3) var(--space-3) 0;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-left: 3px solid var(--toast-color);
  border-radius: var(--radius-md);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 4px 16px rgba(0, 0, 0, 0.45);
}

.toast--essence {
  --toast-color: var(--essence);
}
.toast--info {
  --toast-color: var(--info);
}
.toast--success {
  --toast-color: var(--success);
}
.toast--warning {
  --toast-color: var(--warning);
}
.toast--danger {
  --toast-color: var(--danger);
}
.toast--accent {
  --toast-color: var(--accent);
}

.toast-accent {
  flex-shrink: 0;
  width: var(--space-3);
}

.toast-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.toast-title {
  font-size: var(--text-lg);
  font-weight: bold;
  color: var(--text-primary);
}

.toast-text {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.4;
}

.toast-close {
  flex-shrink: 0;
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: var(--text-xl);
  line-height: 1;
  cursor: pointer;
  padding: 0 var(--space-1);
  transition: color 0.2s;
}

.toast-close:hover {
  color: var(--text-primary);
}
</style>
