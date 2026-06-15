<script setup lang="ts">
import { useNotificationsStore } from '@/stores/notifications'
import ToastItem from './ToastItem.vue'

// Mobile anchors above the tab bar (which sits in normal flow at the bottom of
// MobileApp's flex column); desktop anchors to the bottom-right corner.
withDefaults(defineProps<{ placement?: 'desktop' | 'mobile' }>(), {
  placement: 'desktop',
})

const notifications = useNotificationsStore()
</script>

<template>
  <div class="toast-container" :class="`toast-container--${placement}`">
    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <ToastItem
        v-for="toast in notifications.toasts"
        :key="toast.id"
        :toast="toast"
        @dismiss="notifications.dismiss(toast.id)"
      />
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  z-index: 1500;
  pointer-events: none;
}

.toast-container--desktop {
  right: var(--space-4);
  bottom: var(--space-4);
}

.toast-container--mobile {
  left: var(--space-3);
  right: var(--space-3);
  /* Clear the mobile tab bar (~48px) plus the home-indicator safe area. */
  bottom: calc(48px + env(safe-area-inset-bottom) + var(--space-3));
}

.toast-stack {
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: var(--space-2);
}

.toast-container--mobile .toast-stack {
  align-items: stretch;
}

/* Mirror AppFeed's slide+fade; toasts slide in from the right edge. */
.toast-enter-active {
  transition: all 0.3s ease;
}
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.toast-move {
  transition: transform 0.2s ease;
}
</style>
