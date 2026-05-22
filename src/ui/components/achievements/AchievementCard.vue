<script setup lang="ts">
import { computed } from 'vue'
import type { Achievement } from '@game/data/achievements'

interface Props {
  achievement: Achievement
  isUnlocked: boolean
  isCollected: boolean
  progress?: number // For cumulative achievements
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
  claim: []
}>()

// Can claim if unlocked but not yet collected
const canClaim = computed(() => props.isUnlocked && !props.isCollected)

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
      return 'var(--rare)'
    case 'challenge':
      return 'var(--warning)'
    case 'cumulative':
      return 'var(--essence)'
    case 'mastery':
      return 'var(--legendary)'
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
      collected: isCollected,
      claimable: canClaim,
      locked: !isUnlocked,
      hidden: isHidden,
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
        <span class="reward-icon">◆</span>
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

    <!-- Claim button overlay for uncollected achievements -->
    <div v-if="canClaim" class="claim-overlay" @click.stop="emit('claim')">
      <button class="claim-btn">
        <span class="claim-icon">◆</span>
        Claim {{ achievement.reward }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.achievement-card {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
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

.achievement-card.unlocked.collected {
  border-color: var(--success);
  opacity: 0.7;
}

.achievement-card.claimable {
  border-color: var(--essence);
  box-shadow: 0 0 12px color-mix(in srgb, var(--essence) 40%, transparent);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 8px color-mix(in srgb, var(--essence) 30%, transparent);
  }
  50% {
    box-shadow: 0 0 16px color-mix(in srgb, var(--essence) 60%, transparent);
  }
}

.card-content {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.achievement-icon {
  font-size: var(--text-4xl);
  font-weight: bold;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: var(--radius-md);
  color: var(--text-dim);
}

.achievement-icon.unlocked {
  color: var(--success);
  text-shadow: 0 0 8px color-mix(in srgb, var(--success) 70%, transparent);
  background: color-mix(in srgb, var(--success) 10%, transparent);
}

.achievement-info {
  flex: 1;
  min-width: 0;
}

.achievement-name {
  font-size: var(--text-md);
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
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.achievement-reward {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: color-mix(in srgb, var(--essence) 15%, transparent);
  border-radius: var(--radius-md);
}

.reward-icon {
  font-size: var(--text-base);
  color: var(--essence);
}

.reward-value {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--essence);
}

.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--bg);
}

.progress-fill {
  height: 100%;
  background: var(--essence);
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  bottom: 6px;
  right: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.category-badge {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  font-size: var(--text-2xs);
  font-weight: 600;
  text-transform: uppercase;
  color: white;
  opacity: 0.8;
}

.claim-overlay {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: var(--space-3);
  background: linear-gradient(
    90deg,
    transparent 40%,
    color-mix(in srgb, var(--essence) 15%, transparent) 100%
  );
}

.claim-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--essence);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--essence) 40%, transparent);
}

.claim-btn:hover {
  background: var(--essence-light);
  transform: scale(1.05);
}

.claim-icon {
  font-size: var(--text-lg);
}
</style>
