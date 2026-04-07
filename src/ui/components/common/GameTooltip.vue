<script setup lang="ts">
import { ref, useSlots, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { useShiftHeld } from '@/ui/composables/use-shift-held'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Simple text content (alternative to #content slot) */
    text?: string // eslint-disable-line vue/require-default-prop
    /** Preferred tooltip position */
    position?: 'top' | 'right' | 'bottom' | 'left'
    /** Show delay in ms */
    delay?: number
    /** Hide delay in ms */
    hideDelay?: number
    /** Wrapper element tag */
    tag?: string
    /** Disable tooltip display */
    disabled?: boolean
    /** Max width of tooltip */
    maxWidth?: number
  }>(),
  {
    position: 'top',
    delay: 300,
    hideDelay: 100,
    tag: 'div',
    maxWidth: 280,
  }
)

const slots = useSlots()
const hasContent = computed(() => !!props.text || !!slots.content)
const hasExtendedSlot = computed(() => !!slots.extended)
const shiftHeld = useShiftHeld()
const extended = computed(() => shiftHeld.value && visible.value && hasExtendedSlot.value)

const triggerRef = ref<HTMLElement>()
const tooltipRef = ref<HTMLElement>()
const visible = ref(false)
const pos = ref({ x: 0, y: 0 })

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

const GAP = 8
const EDGE_PADDING = 8

function clearTimers() {
  if (showTimer !== null) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function onMouseEnter() {
  if (props.disabled || !hasContent.value) return
  // Cancel pending hide
  if (hideTimer !== null) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (visible.value) return
  showTimer = setTimeout(async () => {
    showTimer = null
    visible.value = true
    await nextTick()
    updatePosition()
  }, props.delay)
}

function onMouseLeave() {
  if (showTimer !== null) {
    clearTimeout(showTimer)
    showTimer = null
  }
  hideTimer = setTimeout(() => {
    hideTimer = null
    visible.value = false
  }, props.hideDelay)
}

function updatePosition() {
  const trigger = triggerRef.value
  const tooltip = tooltipRef.value
  if (!trigger || !tooltip) return

  const tr = trigger.getBoundingClientRect()
  const tt = tooltip.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let x: number
  let y: number

  switch (props.position) {
    case 'top':
      x = tr.left + (tr.width - tt.width) / 2
      y = tr.top - tt.height - GAP
      if (y < EDGE_PADDING) y = tr.bottom + GAP
      break
    case 'bottom':
      x = tr.left + (tr.width - tt.width) / 2
      y = tr.bottom + GAP
      if (y + tt.height > vh - EDGE_PADDING) y = tr.top - tt.height - GAP
      break
    case 'right':
      x = tr.right + GAP
      y = tr.top + (tr.height - tt.height) / 2
      if (x + tt.width > vw - EDGE_PADDING) x = tr.left - tt.width - GAP
      break
    case 'left':
      x = tr.left - tt.width - GAP
      y = tr.top + (tr.height - tt.height) / 2
      if (x < EDGE_PADDING) x = tr.right + GAP
      break
  }

  // Clamp to viewport
  x = Math.max(EDGE_PADDING, Math.min(x, vw - tt.width - EDGE_PADDING))
  y = Math.max(EDGE_PADDING, Math.min(y, vh - tt.height - EDGE_PADDING))

  pos.value = { x, y }
}

// Reposition when extended content appears/disappears (size changes)
watch(extended, async () => {
  if (visible.value) {
    await nextTick()
    updatePosition()
  }
})

onBeforeUnmount(clearTimers)

const tooltipStyle = computed(() => ({
  left: `${pos.value.x}px`,
  top: `${pos.value.y}px`,
  maxWidth: `${props.maxWidth}px`,
}))
</script>

<template>
  <component
    :is="tag"
    ref="triggerRef"
    v-bind="$attrs"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
    <slot />
    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div
          v-if="visible"
          ref="tooltipRef"
          class="game-tooltip"
          :class="{ 'game-tooltip--extended': extended }"
          :style="tooltipStyle"
          @mouseenter="extended ? onMouseEnter() : undefined"
          @mouseleave="extended ? onMouseLeave() : undefined"
        >
          <slot name="content">
            <span class="game-tooltip-text">{{ text }}</span>
          </slot>
          <template v-if="extended">
            <div class="tt-section">
              <slot name="extended" />
            </div>
          </template>
          <div v-else-if="hasExtendedSlot" class="tt-shift-hint">
            <span class="tt-shift-key">⇧</span> Shift
          </div>
        </div>
      </Transition>
    </Teleport>
  </component>
</template>

<style>
/* Global (not scoped) — tooltip is teleported to body */
.game-tooltip {
  position: fixed;
  z-index: 9999;
  padding: var(--space-2) var(--space-3);
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(15, 15, 26, 0.99) 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  pointer-events: none;
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text-primary);
  line-height: 1.4;
}

.game-tooltip--extended {
  pointer-events: auto;
  border-color: var(--purple);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.5),
    0 0 8px rgba(139, 92, 246, 0.15);
}

.game-tooltip-text {
  color: var(--text-secondary);
}

/* Tooltip content helpers — usable by consumers inside #content slot */
.game-tooltip .tt-header {
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border);
}

.game-tooltip .tt-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 1px 0;
}

.game-tooltip .tt-label {
  color: var(--text-dim);
}

.game-tooltip .tt-val {
  color: var(--text-primary);
  font-weight: bold;
}

.game-tooltip .tt-section {
  margin-top: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--border);
}

.game-tooltip .tt-muted {
  color: var(--text-dim);
  font-size: var(--text-sm);
}

.game-tooltip .tt-shift-hint {
  margin-top: var(--space-1);
  font-size: var(--text-xs);
  color: var(--text-dim);
  opacity: 0.6;
  text-align: right;
}

.game-tooltip .tt-shift-key {
  color: var(--purple);
  opacity: 1;
}

.tooltip-fade-enter-active {
  transition: opacity 0.15s ease;
}

.tooltip-fade-leave-active {
  transition: opacity 0.1s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
