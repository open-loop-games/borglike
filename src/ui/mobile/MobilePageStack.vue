<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { useOrientationLock } from '@/ui/composables/use-orientation-lock'

export interface PageEntry {
  component: Component
  props?: Record<string, unknown>
  landscape?: boolean
}

const props = defineProps<{
  stack: PageEntry[]
}>()

const emit = defineEmits<{
  pop: []
}>()

const { lockLandscape, unlock } = useOrientationLock()

const topPage = computed(() => props.stack[props.stack.length - 1] ?? null)

// Handle orientation lock when the top page changes
watch(
  () => topPage.value?.landscape,
  (wantsLandscape) => {
    if (wantsLandscape) {
      lockLandscape()
    } else {
      unlock()
    }
  }
)

function handleBack() {
  if (topPage.value?.landscape) {
    unlock()
  }
  emit('pop')
}

function handleClose() {
  handleBack()
}
</script>

<template>
  <Transition name="slide">
    <div v-if="topPage" class="page-stack">
      <div class="page-header">
        <button class="back-btn" @click="handleBack">
          <span class="back-arrow">&larr;</span>
          <span>Back</span>
        </button>
      </div>
      <div class="page-content">
        <component
          :is="topPage.component"
          v-bind="topPage.props"
          @close="handleClose"
          @collapse="handleClose"
          @back="handleClose"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.page-stack {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: var(--void);
  display: flex;
  flex-direction: column;
}

.page-header {
  display: flex;
  align-items: center;
  padding: 0 var(--space-3);
  height: 44px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  color: var(--purple);
  font-size: var(--text-base);
  cursor: pointer;
  padding: var(--space-2);
}

.back-arrow {
  font-size: var(--text-xl);
}

.page-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}

.slide-enter-from {
  transform: translateX(100%);
}

.slide-leave-to {
  transform: translateX(100%);
}
</style>
