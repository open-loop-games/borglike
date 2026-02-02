<script setup lang="ts">
import { computed } from 'vue'
import type { Race } from '@/game/data/races'

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
      {{ category.toUpperCase() }}
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
      <span>✓</span>
    </div>

    <!-- Lock icon for locked -->
    <div v-if="!unlocked" class="lock-icon">
      <span>🔒</span>
    </div>
  </div>
</template>

<style scoped>
.race-card {
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
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
  border-color: rgba(245, 158, 11, 0.5);
}

.race-card.prestige:not(.locked) {
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.2);
}

.category-badge {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  font-size: 8px;
  font-weight: bold;
  letter-spacing: 0.5px;
  padding: 2px 0;
  text-align: center;
  background: var(--void);
  color: var(--text-dim);
}

.category-badge.starter {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.category-badge.unlockable {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
}

.category-badge.prestige {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
}

.race-symbol {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 8px currentColor;
}

.race-name {
  font-size: 11px;
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
  font-size: 9px;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  margin-top: 2px;
}

.unlock-hint {
  font-size: 9px;
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
  font-size: 10px;
  color: var(--green);
  margin-top: 4px;
  padding: 2px 6px;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 3px;
}

.unlocked-badge {
  position: absolute;
  top: 14px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: var(--green);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  color: white;
}

.race-card.prestige .unlocked-badge {
  background: #f59e0b;
}

.lock-icon {
  position: absolute;
  top: 14px;
  right: 4px;
  font-size: 12px;
  opacity: 0.5;
}
</style>
