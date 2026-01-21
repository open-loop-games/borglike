<script setup lang="ts">
import { computed } from 'vue'
import type { Achievement } from '@/game/data/achievements'

interface Props {
  achievement: Achievement
  isUnlocked: boolean
  progress?: number // For cumulative achievements
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

// For hidden achievements, show locked state until unlocked
const isHidden = computed(() => props.achievement.hidden && !props.isUnlocked)

// Progress percentage for cumulative achievements
const progressPercent = computed(() => {
  if (props.isUnlocked) return 100
  if (props.progress === undefined) return 0
  return Math.min(100, (props.progress / props.achievement.target) * 100)
})

// Progress display text
const progressText = computed(() => {
  if (props.isUnlocked) return 'Complete'
  if (props.progress === undefined) return ''
  return `${props.progress}/${props.achievement.target}`
})

// Category badge color
const categoryColor = computed(() => {
  switch (props.achievement.category) {
    case 'progress':
      return 'var(--blue)'
    case 'challenge':
      return 'var(--orange)'
    case 'cumulative':
      return 'var(--purple)'
    default:
      return 'var(--text-dim)'
  }
})
</script>

<template>
  <div
    class="achievement-card"
    :class="{
      unlocked: isUnlocked,
      locked: !isUnlocked,
      hidden: isHidden
    }"
    @click="emit('click')"
  >
    <div class="card-content">
      <div class="achievement-icon" :class="{ unlocked: isUnlocked }">
        {{ isHidden ? '?' : achievement.icon }}
      </div>
      <div class="achievement-info">
        <div class="achievement-name">
          {{ isHidden ? '???' : achievement.name }}
        </div>
        <div class="achievement-desc">
          {{ isHidden ? 'Hidden achievement' : achievement.description }}
        </div>
      </div>
      <div v-if="!isHidden" class="achievement-reward">
        <span class="reward-icon">&#x25C6;</span>
        <span class="reward-value">{{ achievement.reward }}</span>
      </div>
    </div>

    <!-- Progress bar for non-hidden achievements -->
    <div v-if="!isHidden && !isUnlocked && progress !== undefined" class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      <span class="progress-text">{{ progressText }}</span>
    </div>

    <!-- Category badge -->
    <div v-if="!isHidden" class="category-badge" :style="{ backgroundColor: categoryColor }">
      {{ achievement.category }}
    </div>

    <!-- Completed checkmark -->
    <div v-if="isUnlocked" class="completed-badge">
      <span>&#x2713;</span>
    </div>
  </div>
</template>

<style scoped>
.achievement-card {
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.achievement-card:hover {
  background: var(--border);
  transform: translateY(-2px);
}

.achievement-card.locked {
  opacity: 0.7;
}

.achievement-card.hidden {
  filter: grayscale(0.8);
  opacity: 0.5;
}

.achievement-card.unlocked {
  border-color: var(--green);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.3);
}

.card-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.achievement-icon {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: bold;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--void);
  border-radius: 4px;
  color: var(--text-dim);
}

.achievement-icon.unlocked {
  color: var(--green);
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.7);
  background: rgba(34, 197, 94, 0.1);
}

.achievement-info {
  flex: 1;
  min-width: 0;
}

.achievement-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.achievement-card.hidden .achievement-name {
  font-style: italic;
  color: var(--text-dim);
}

.achievement-desc {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.achievement-reward {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 4px;
}

.reward-icon {
  font-size: 12px;
  color: var(--purple);
}

.reward-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--purple);
}

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--void);
}

.progress-fill {
  height: 100%;
  background: var(--purple);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 9px;
  color: var(--text-dim);
}

.category-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  color: white;
  opacity: 0.8;
}

.completed-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: var(--green);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: white;
}
</style>
