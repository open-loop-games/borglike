<script setup lang="ts" generic="T extends string">
import { computed } from 'vue'
import {
  SelectRoot,
  SelectTrigger,
  SelectPortal,
  SelectContent,
  SelectViewport,
  SelectItem,
  SelectItemText,
  SelectIcon,
} from 'reka-ui'
import Icon from './Icon.vue'
import { Icons } from '@/ui/icons'

interface Option {
  value: T | null
  label: string
  icon?: string
  disabled?: boolean
}

const props = defineProps<{
  modelValue: T | null
  options: Option[]
  placeholder?: string
  ariaLabel?: string
  /** Size trigger to content instead of filling the parent. For inline filter bars. */
  inline?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: T | null] }>()

// reka-ui rejects empty-string values; use a sentinel for the null/"None" option.
const NONE = '__none__'

const internal = computed({
  get: () => (props.modelValue === null ? NONE : props.modelValue),
  set: (v: string) => emit('update:modelValue', v === NONE ? null : (v as T)),
})

const selectedOption = computed(() =>
  props.options.find((o) => (o.value ?? NONE) === (props.modelValue ?? NONE))
)
</script>

<template>
  <SelectRoot v-model="internal">
    <SelectTrigger
      class="icon-select-trigger"
      :class="{ 'icon-select-inline': inline }"
      :aria-label="ariaLabel"
    >
      <Icon v-if="selectedOption?.icon" class="trigger-icon" :name="selectedOption.icon" />
      <span class="trigger-label">{{ selectedOption?.label ?? placeholder ?? 'Select…' }}</span>
      <SelectIcon class="trigger-caret">
        <Icon :name="Icons.caretDown" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="icon-select-content" position="popper" :side-offset="4">
        <SelectViewport class="icon-select-viewport">
          <SelectItem
            v-for="opt in options"
            :key="opt.value ?? NONE"
            :value="opt.value ?? NONE"
            :disabled="opt.disabled"
            class="icon-select-item"
          >
            <Icon v-if="opt.icon" class="item-icon" :name="opt.icon" />
            <SelectItemText>{{ opt.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style scoped>
.icon-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  width: 100%;
  text-align: left;
}

.icon-select-trigger.icon-select-inline {
  width: auto;
}

.icon-select-trigger:hover {
  border-color: var(--essence);
}

.icon-select-trigger:focus-visible,
.icon-select-trigger[data-state='open'] {
  outline: none;
  border-color: var(--essence);
  box-shadow: 0 0 8px color-mix(in srgb, var(--essence) 30%, transparent);
}

.trigger-icon {
  font-size: 1.2em;
  color: var(--essence);
  flex-shrink: 0;
}

.trigger-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-caret {
  display: inline-flex;
  color: var(--text-dim);
  flex-shrink: 0;
}
</style>

<!-- Portal content lives outside the component tree; scoped attrs don't reach it. -->
<style>
.icon-select-content {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  /* Must stack above AppModal (z-index 1001) since both are body-portaled. */
  z-index: 1100;
  min-width: var(--reka-select-trigger-width);
  max-height: var(--reka-select-content-available-height);
}

.icon-select-viewport {
  padding: var(--space-1);
}

.icon-select-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  outline: none;
}

.icon-select-item[data-highlighted] {
  background: var(--bg-highlight);
  color: var(--essence);
}

.icon-select-item[data-state='checked'] {
  color: var(--essence);
}

.icon-select-item[data-disabled] {
  color: var(--text-dim);
  cursor: not-allowed;
  opacity: 0.55;
}

.icon-select-item .item-icon {
  font-size: 1.2em;
  color: var(--essence);
  flex-shrink: 0;
}

.icon-select-item[data-disabled] .item-icon {
  color: var(--text-dim);
}
</style>
