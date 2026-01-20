<script setup lang="ts">
import { computed } from 'vue'
import type { RunStats } from '@/types/progression'
import PanelFrame from '../common/PanelFrame.vue'
import ProgressBar from '../common/ProgressBar.vue'

const props = defineProps<{
  run: RunStats
  personalBest?: RunStats
}>()

const emit = defineEmits<{
  close: []
  restart: []
}>()

// Format duration
const duration = computed(() => {
  if (!props.run.endTime) return '--:--'
  const seconds = Math.floor((props.run.endTime - props.run.startTime) / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

// Compare with personal best
const comparison = computed(() => {
  if (!props.personalBest) return null

  return {
    depth: props.run.maxDepth - props.personalBest.maxDepth,
    kills: props.run.kills - props.personalBest.kills,
    gold: props.run.goldEarned - props.personalBest.goldEarned,
    essence: props.run.essenceEarned - props.personalBest.essenceEarned,
  }
})

const isNewBest = computed(() => {
  if (!props.personalBest) return true
  return props.run.maxDepth > props.personalBest.maxDepth
})

// Performance grades
const depthGrade = computed(() => {
  const depth = props.run.maxDepth
  if (depth >= 50) return { grade: 'S', color: 'var(--purple)' }
  if (depth >= 30) return { grade: 'A', color: 'var(--green)' }
  if (depth >= 20) return { grade: 'B', color: 'var(--cyan)' }
  if (depth >= 10) return { grade: 'C', color: 'var(--amber)' }
  return { grade: 'D', color: 'var(--red)' }
})

function formatDiff(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${value}`
  return '='
}

function getDiffClass(value: number): string {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}
</script>

<template>
  <div class="run-summary">
    <header class="summary-header">
      <div class="header-content">
        <h2>Run Complete</h2>
        <span v-if="isNewBest" class="new-best-badge">NEW BEST!</span>
      </div>
      <button class="close-btn" @click="emit('close')">&#x2715;</button>
    </header>

    <div class="summary-content">
      <!-- Character Info -->
      <div class="character-info">
        <span class="char-race">{{ run.race }}</span>
        <span class="char-class">{{ run.class }}</span>
        <span class="char-time">{{ duration }}</span>
      </div>

      <!-- Grade Display -->
      <div class="grade-section">
        <div class="grade-display" :style="{ color: depthGrade.color }">
          {{ depthGrade.grade }}
        </div>
        <div class="grade-label">Performance</div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <PanelFrame class="stat-card">
          <div class="stat-label">Max Depth</div>
          <div class="stat-value depth">{{ run.maxDepth }}</div>
          <div v-if="comparison" class="stat-diff" :class="getDiffClass(comparison.depth)">
            {{ formatDiff(comparison.depth) }}
          </div>
        </PanelFrame>

        <PanelFrame class="stat-card">
          <div class="stat-label">Kills</div>
          <div class="stat-value kills">{{ run.kills }}</div>
          <div v-if="comparison" class="stat-diff" :class="getDiffClass(comparison.kills)">
            {{ formatDiff(comparison.kills) }}
          </div>
        </PanelFrame>

        <PanelFrame class="stat-card">
          <div class="stat-label">Gold</div>
          <div class="stat-value gold">{{ run.goldEarned.toLocaleString() }}</div>
          <div v-if="comparison" class="stat-diff" :class="getDiffClass(comparison.gold)">
            {{ formatDiff(comparison.gold) }}
          </div>
        </PanelFrame>

        <PanelFrame class="stat-card">
          <div class="stat-label">XP</div>
          <div class="stat-value xp">{{ run.xpEarned.toLocaleString() }}</div>
        </PanelFrame>
      </div>

      <!-- Cause of Death -->
      <PanelFrame v-if="run.deathCause" class="death-cause">
        <div class="death-label">Cause of Death</div>
        <div class="death-text">{{ run.deathCause }}</div>
      </PanelFrame>

      <!-- Essence Earned -->
      <PanelFrame class="essence-section">
        <div class="essence-header">
          <span class="essence-label">Essence Earned</span>
          <span class="essence-icon">&#x25C6;</span>
        </div>
        <div class="essence-value">+{{ run.essenceEarned.toLocaleString() }}</div>
        <ProgressBar
          :current="run.essenceEarned"
          :max="Math.max(run.essenceEarned, 100)"
          variant="upgrade"
          size="md"
          class="essence-bar"
        />
        <div v-if="comparison" class="essence-diff" :class="getDiffClass(comparison.essence)">
          vs Personal Best: {{ formatDiff(comparison.essence) }}
        </div>
      </PanelFrame>
    </div>

    <footer class="summary-footer">
      <button class="action-btn secondary" @click="emit('close')">Return to Grid</button>
      <button class="action-btn primary" @click="emit('restart')">
        <span class="btn-icon">&#x25B6;</span>
        Start New Run
      </button>
    </footer>
  </div>
</template>

<style scoped>
.run-summary {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel);
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--elevated);
  border-bottom: 1px solid var(--border);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.summary-header h2 {
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
  margin: 0;
}

.new-best-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid var(--purple);
  border-radius: 3px;
  color: var(--purple);
  text-transform: uppercase;
  letter-spacing: 1px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--red);
  border-color: var(--red);
  color: white;
}

.summary-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.character-info {
  display: flex;
  align-items: center;
  gap: 16px;
  font-family: var(--font-mono);
  font-size: 14px;
}

.char-race {
  color: var(--cyan);
  text-shadow: 0 0 6px rgba(6, 182, 212, 0.4);
}

.char-class {
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.char-time {
  color: var(--text-dim);
}

.grade-section {
  text-align: center;
  margin: 10px 0;
}

.grade-display {
  font-family: var(--font-mono);
  font-size: 72px;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 30px currentColor;
}

.grade-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-top: 8px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  width: 100%;
  max-width: 400px;
}

.stat-card {
  padding: 16px !important;
  text-align: center;
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-value.depth {
  color: var(--purple);
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}

.stat-value.kills {
  color: var(--red);
}

.stat-value.gold {
  color: var(--amber);
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
}

.stat-value.xp {
  color: var(--cyan);
}

.stat-diff {
  font-family: var(--font-mono);
  font-size: 12px;
  margin-top: 6px;
}

.stat-diff.positive {
  color: var(--green);
}

.stat-diff.negative {
  color: var(--red);
}

.stat-diff.neutral {
  color: var(--text-dim);
}

.death-cause {
  width: 100%;
  max-width: 400px;
  padding: 16px !important;
  text-align: center;
}

.death-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.death-text {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--red);
}

.essence-section {
  width: 100%;
  max-width: 400px;
  padding: 20px !important;
  text-align: center;
}

.essence-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.essence-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.essence-icon {
  color: var(--purple);
  font-size: 14px;
}

.essence-value {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: bold;
  color: var(--purple);
  text-shadow: 0 0 12px rgba(139, 92, 246, 0.5);
  margin-bottom: 12px;
}

.essence-bar {
  margin-bottom: 8px;
}

.essence-diff {
  font-family: var(--font-mono);
  font-size: 11px;
}

.essence-diff.positive {
  color: var(--green);
}

.essence-diff.negative {
  color: var(--red);
}

.essence-diff.neutral {
  color: var(--text-dim);
}

.summary-footer {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: var(--elevated);
  border-top: 1px solid var(--border);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.secondary {
  background: var(--highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--border);
  color: var(--text-primary);
}

.action-btn.primary {
  background: var(--indigo);
  border: 1px solid var(--indigo);
  color: white;
  font-weight: bold;
}

.action-btn.primary:hover {
  background: #4f46e5;
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
}

.btn-icon {
  font-size: 12px;
}
</style>
