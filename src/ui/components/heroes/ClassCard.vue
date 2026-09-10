<script setup lang="ts">
import { computed } from 'vue'
import type { GameClass } from '@game/data/classes'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import { classSymbols, heroCategory, heroCategoryLabel } from './hero-symbols'

interface Props {
  gameClass: GameClass
  unlocked: boolean
  wins: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

// Badge: `category` drives the CSS hook, the label is display-only.
const category = computed(() => heroCategory(props.gameClass))
const categoryLabel = computed(() => heroCategoryLabel(category.value).toUpperCase())

// Iconify ID for the class symbol when unlocked, or null to fall back to a plaintext glyph.
const symbolIcon = computed<string | null>(() => {
  if (!props.unlocked) return Icons.classUnknown
  return classSymbols[props.gameClass.id] ?? null
})

const symbolFallback = computed(() => {
  if (!props.unlocked || symbolIcon.value) return null
  return props.gameClass.name.charAt(0).toUpperCase()
})

// Get color based on category and magic
const color = computed(() => {
  if (!props.unlocked) return '#4b5563'
  if (props.gameClass.mythic) return '#f59e0b' // Amber for mythic
  if (props.gameClass.starting) return '#22c55e' // Green for starter
  return '#3b82f6' // Blue for unlockable
})

// Short unlock hint for locked classes
const unlockHint = computed(() => {
  if (props.unlocked || !props.gameClass.unlockCondition) return null
  const condition = props.gameClass.unlockCondition
  // Shorten common patterns
  if (condition.includes('Win a run with')) {
    return condition.replace('Win a run with ', 'Win ')
  }
  if (condition.includes(' total')) {
    return condition.replace(' total', '')
  }
  return condition.length > 15 ? condition.substring(0, 12) + '...' : condition
})

// Primary stat display
const primaryStat = computed(() => {
  if (!props.unlocked) return null
  const statNames: Record<string, string> = {
    str: 'STR',
    int: 'INT',
    wis: 'WIS',
    dex: 'DEX',
    con: 'CON',
  }
  return statNames[props.gameClass.primaryStat] ?? props.gameClass.primaryStat.toUpperCase()
})
</script>

<template>
  <div
    class="class-card"
    :class="{
      locked: !unlocked,
      mythic: gameClass.mythic,
      starter: gameClass.starting,
      magic: gameClass.usesMagic,
    }"
    @click="emit('click')"
  >
    <div class="category-badge" :class="category">
      {{ categoryLabel }}
    </div>

    <div class="card-content">
      <div class="class-symbol" :style="{ color }">
        <Icon v-if="symbolIcon" :name="symbolIcon" />
        <template v-else>{{ symbolFallback }}</template>
      </div>
      <div class="class-name">
        {{ gameClass.name }}
      </div>

      <!-- Magic indicator and primary stat -->
      <div v-if="unlocked" class="class-info">
        <span v-if="gameClass.usesMagic" class="magic-badge">Magic</span>
        <span v-if="primaryStat" class="primary-stat">{{ primaryStat }}</span>
      </div>
      <div v-else-if="unlockHint" class="unlock-hint">
        {{ unlockHint }}
      </div>

      <!-- Win count -->
      <div v-if="unlocked && wins > 0" class="win-count">
        {{ wins }} win{{ wins !== 1 ? 's' : '' }}
      </div>
    </div>

    <!-- Unlocked badge -->
    <div v-if="unlocked" class="unlocked-badge">
      <Icon :name="Icons.check" />
    </div>

    <!-- Lock icon for locked -->
    <div v-if="!unlocked" class="lock-icon">
      <Icon :name="Icons.lock" />
    </div>
  </div>
</template>

<style scoped>
.class-card {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.class-card:hover {
  background: var(--border);
  transform: translateY(-2px);
}

.class-card.locked {
  filter: grayscale(0.5);
  opacity: 0.7;
}

.class-card.mythic {
  border-color: color-mix(in srgb, var(--warning) 50%, transparent);
}

.class-card.mythic:not(.locked) {
  box-shadow: 0 0 8px color-mix(in srgb, var(--warning) 20%, transparent);
}

.category-badge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  font-size: var(--text-2xs);
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 2px 0;
  text-align: center;
  background: var(--bg);
  color: var(--text-dim);
}

.category-badge.starter {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.category-badge.unlockable {
  color: var(--rare);
  background: color-mix(in srgb, var(--rare) 10%, transparent);
}

.category-badge.mythic {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 10%, transparent);
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.class-symbol {
  font-size: 28px;
  line-height: 1;
  text-shadow: 0 0 8px currentColor;
}

.class-name {
  font-size: var(--text-base);
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.class-card.locked .class-name {
  color: var(--text-dim);
}

.class-info {
  display: flex;
  gap: var(--space-1);
  margin-top: 2px;
}

.magic-badge {
  font-size: var(--text-2xs);
  color: var(--essence-light);
  background: color-mix(in srgb, var(--essence-light) 15%, transparent);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
}

.primary-stat {
  font-size: var(--text-2xs);
  color: var(--text-secondary);
  background: var(--bg);
  padding: 1px var(--space-1);
  border-radius: var(--radius-sm);
}

.unlock-hint {
  font-size: var(--text-sm);
  color: var(--text-dim);
  font-style: italic;
  margin-top: 2px;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.win-count {
  font-size: var(--text-base);
  color: var(--success);
  margin-top: var(--space-1);
  padding: 2px var(--space-2);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border-radius: var(--radius-md);
}

.unlocked-badge {
  position: absolute;
  top: 14px;
  right: var(--space-1);
  width: 16px;
  height: 16px;
  background: var(--success);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: white;
}

.class-card.mythic .unlocked-badge {
  background: var(--warning);
}

.lock-icon {
  position: absolute;
  top: 14px;
  right: var(--space-1);
  font-size: var(--text-base);
  opacity: 0.5;
}
</style>
