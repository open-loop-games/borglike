<script setup lang="ts">
import { computed } from 'vue'
import type { Race } from '@game/data/races'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'

interface Props {
  race: Race
  unlocked: boolean
  wins: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

// Get category badge
const category = computed(() => {
  if (props.race.prestige) return 'prestige'
  if (props.race.starting) return 'starter'
  return 'unlockable'
})

// Display-only: the prestige-flagged row reads "Mythic" — "prestige" names
// the reset loop now (studio/borglike#3). Class hooks stay on `category`.
const categoryLabel = computed(() =>
  category.value === 'prestige' ? 'MYTHIC' : category.value.toUpperCase()
)

// Get display symbol for race (first letter, styled)
const symbol = computed(() => {
  if (!props.unlocked) return '?'
  return props.race.name.charAt(0).toUpperCase()
})

// Get color based on category
const color = computed(() => {
  if (!props.unlocked) return '#4b5563'
  if (props.race.prestige) return '#f59e0b' // Amber for prestige
  if (props.race.starting) return '#22c55e' // Green for starter
  return '#3b82f6' // Blue for unlockable
})

// Short unlock hint for locked races
const unlockHint = computed(() => {
  if (props.unlocked || !props.race.unlockCondition) return null
  const condition = props.race.unlockCondition
  // Shorten common patterns
  if (condition.includes('Win a run with')) {
    return condition.replace('Win a run with ', 'Win ')
  }
  if (condition.includes('total')) {
    return condition.replace(' total', '')
  }
  return condition.length > 15 ? condition.substring(0, 12) + '...' : condition
})

// Format stat preview (show non-zero stats)
const statPreview = computed(() => {
  if (!props.unlocked) return null
  const stats = props.race.stats
  const parts: string[] = []
  if (stats.str !== 0) parts.push(`STR${stats.str > 0 ? '+' : ''}${stats.str}`)
  if (stats.int !== 0) parts.push(`INT${stats.int > 0 ? '+' : ''}${stats.int}`)
  if (stats.dex !== 0) parts.push(`DEX${stats.dex > 0 ? '+' : ''}${stats.dex}`)
  if (parts.length === 0) return 'Balanced'
  return parts.slice(0, 2).join(' ')
})
</script>

<template>
  <div
    class="race-card"
    :class="{ locked: !unlocked, prestige: race.prestige, starter: race.starting }"
    @click="emit('click')"
  >
    <div class="category-badge" :class="category">
      {{ categoryLabel }}
    </div>

    <div class="card-content">
      <div class="race-symbol" :style="{ color }">
        {{ symbol }}
      </div>
      <div class="race-name">
        {{ unlocked ? race.name : race.name }}
      </div>

      <!-- Stat preview or unlock hint -->
      <div v-if="unlocked && statPreview" class="stat-preview">
        {{ statPreview }}
      </div>
      <div v-else-if="!unlocked && unlockHint" class="unlock-hint">
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
.race-card {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.race-card:hover {
  background: var(--border);
  transform: translateY(-2px);
}

.race-card.locked {
  filter: grayscale(0.5);
  opacity: 0.7;
}

.race-card.prestige {
  border-color: color-mix(in srgb, var(--warning) 50%, transparent);
}

.race-card.prestige:not(.locked) {
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

.category-badge.prestige {
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

.race-symbol {
  font-size: var(--text-5xl);
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 8px currentColor;
}

.race-name {
  font-size: var(--text-base);
  color: var(--text-primary);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.race-card.locked .race-name {
  color: var(--text-dim);
}

.stat-preview {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: 2px;
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

.race-card.prestige .unlocked-badge {
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
