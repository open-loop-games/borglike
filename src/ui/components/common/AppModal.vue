<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from 'reka-ui'

withDefaults(
  defineProps<{
    open: boolean
    /** Used for the visually-hidden DialogTitle that satisfies reka's a11y contract. */
    title: string
    description?: string
    size?: 'md' | 'lg'
  }>(),
  { size: 'md', description: undefined }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="app-modal-overlay" />
      <DialogContent class="app-modal-content" :class="`app-modal-${size}`">
        <VisuallyHidden>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription v-if="description">{{ description }}</DialogDescription>
        </VisuallyHidden>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.app-modal-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  z-index: 1000;
}

.app-modal-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(100% - var(--space-5) * 2);
  max-width: 600px;
  max-height: calc(100vh - var(--space-5) * 2);
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.app-modal-content.app-modal-lg {
  max-width: 800px;
}

.app-modal-content:focus-visible {
  outline: none;
}
</style>
