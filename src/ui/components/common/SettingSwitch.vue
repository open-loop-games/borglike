<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{
  modelValue: boolean
  disabled?: boolean
  ariaLabel?: string
}>()

defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <SwitchRoot
    :model-value="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel"
    class="setting-switch"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <SwitchThumb class="setting-switch-thumb" />
  </SwitchRoot>
</template>

<style scoped>
.setting-switch {
  display: inline-flex;
  align-items: center;
  width: 44px;
  height: 24px;
  padding: 0;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, border-color 0.2s;
}

.setting-switch[data-state='checked'] {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-color: var(--accent);
}

.setting-switch:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.setting-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent);
}

.setting-switch-thumb {
  display: block;
  width: 18px;
  height: 18px;
  background: var(--text-secondary);
  border-radius: 50%;
  transform: translateX(2px);
  transition: transform 0.2s, background 0.2s;
  will-change: transform;
}

.setting-switch[data-state='checked'] .setting-switch-thumb {
  transform: translateX(22px);
  background: var(--accent);
}
</style>
