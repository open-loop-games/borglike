<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  current: number
  max: number
  variant?: 'hp' | 'mp' | 'xp' | 'upgrade' | 'essence'
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()

const percentage = computed(() => {
  if (props.max <= 0) return 0
  return Math.min(100, Math.max(0, (props.current / props.max) * 100))
})

const hpState = computed(() => {
  if (props.variant !== 'hp') return ''
  const pct = percentage.value
  if (pct <= 25) return 'hp-low'
  if (pct <= 50) return 'hp-mid'
  return 'hp-full'
})

const variantClass = computed(() => {
  if (props.variant === 'hp') return hpState.value
  return props.variant || 'hp-full'
})
</script>

<template>
  <div class="progress-bar" :class="[variantClass, size || 'md']">
    <div class="progress-fill" :style="{ width: percentage + '%' }" />
    <template v-if="showText">
      <span class="progress-text outside">{{ current }}/{{ max }}</span>
      <span
        class="progress-text inside"
        :style="{ clipPath: `inset(0 ${100 - percentage}% 0 0)` }"
        >{{ current }}/{{ max }}</span
      >
    </template>
  </div>
</template>

<style scoped>
.progress-bar {
  position: relative;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-bar.sm {
  height: 8px;
}
.progress-bar.md {
  height: 12px;
}
.progress-bar.lg {
  height: 16px;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.hp-full .progress-fill {
  background: var(--success);
  box-shadow: 0 0 4px color-mix(in srgb, var(--success) 40%, transparent);
}

.hp-mid .progress-fill {
  background: var(--warning);
  box-shadow: 0 0 4px color-mix(in srgb, var(--warning) 40%, transparent);
}

.hp-low .progress-fill {
  background: var(--danger);
  box-shadow: 0 0 4px color-mix(in srgb, var(--danger) 40%, transparent);
}

.mp .progress-fill {
  background: var(--accent);
  box-shadow: 0 0 4px color-mix(in srgb, var(--accent) 40%, transparent);
}

.xp .progress-fill {
  background: var(--info);
  box-shadow: 0 0 4px color-mix(in srgb, var(--info) 40%, transparent);
}

.upgrade .progress-fill {
  background: var(--essence);
  box-shadow: 0 0 4px color-mix(in srgb, var(--essence) 40%, transparent);
}

.essence .progress-fill {
  background: linear-gradient(90deg, var(--essence), var(--accent));
  box-shadow: 0 0 4px color-mix(in srgb, var(--essence) 40%, transparent);
}

.progress-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
  pointer-events: none;
}

.progress-text.outside {
  color: var(--text-primary);
}

/* Clipped to the filled portion; uses page bg color so it reads against
   saturated bar fills the same way the fill reads against the panel. */
.progress-text.inside {
  color: var(--bg);
  font-weight: 600;
}
</style>
