<script setup lang="ts">
import type { ActiveRun } from '@/stores/runs'
import { useRunsStore } from '@/stores/runs'
import DungeonGrid from './DungeonGrid.vue'
import ProgressBar from './common/ProgressBar.vue'

const props = defineProps<{
  run: ActiveRun
}>()

const emit = defineEmits<{
  expand: []
  restart: []
  dismiss: []
}>()

const runs = useRunsStore()

function handleExpand() {
  emit('expand')
}

function handleToggleTurbo() {
  runs.toggleTurbo(props.run.id)
}

function handleRestart() {
  emit('restart')
}

function handleDismiss() {
  emit('dismiss')
}
</script>

<template>
  <div class="run-panel" :class="{ dead: run.state === 'dead' }">
    <header class="run-header">
      <div class="run-info">
        <span class="run-class">{{ run.config.class }}</span>
        <span class="run-race">{{ run.config.race }}</span>
      </div>
      <div class="run-depth">
        <span class="depth-label">D:</span>
        <span class="depth-value">{{ run.depth }}</span>
      </div>
      <div class="run-controls">
        <button
          class="control-btn turbo"
          :class="{ active: run.turbo }"
          title="Toggle turbo mode"
          @click="handleToggleTurbo"
        >
          &#x25B6;&#x25B6;
        </button>
        <button class="control-btn expand" title="Expand to full view" @click="handleExpand">
          &#x26F6;
        </button>
      </div>
    </header>

    <div class="run-stats-bar">
      <div class="stat-group hp-group">
        <span class="stat-label">HP</span>
        <ProgressBar
          :current="run.hp"
          :max="run.maxHp"
          variant="hp"
          :show-text="true"
          size="sm"
          class="hp-bar"
        />
      </div>
      <div class="stat-group">
        <span class="stat kills">
          <span class="stat-icon">&#x2694;</span>
          {{ run.kills }}
        </span>
        <span class="stat gold">
          <span class="stat-icon">$</span>
          {{ run.gold }}
        </span>
        <span class="stat xp">
          <span class="stat-icon">&#x2605;</span>
          {{ run.xp }}
        </span>
      </div>
    </div>

    <DungeonGrid :grid="run.grid" :cursor-x="run.cursorX" :cursor-y="run.cursorY" />

    <div v-if="run.state === 'dead'" class="death-overlay">
      <span class="death-text">DEFEATED</span>
      <div class="death-stats">
        <span>D:{{ run.depth }}</span>
        <span>{{ run.kills }} kills</span>
      </div>
      <div class="death-actions">
        <button class="death-btn restart" @click="handleRestart">
          <span>&#x21BB;</span> Restart
        </button>
        <button class="death-btn dismiss" @click="handleDismiss">Dismiss</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.run-panel.dead {
  opacity: 0.7;
}

.run-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--elevated);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 12px;
}

.run-info {
  display: flex;
  gap: 8px;
}

.run-class {
  color: var(--green);
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.run-race {
  color: var(--cyan);
  text-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
}

.run-depth {
  display: flex;
  align-items: center;
  gap: 2px;
}

.depth-label {
  color: var(--text-dim);
}

.depth-value {
  color: var(--purple);
  font-weight: bold;
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
}

.run-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 10px;
  font-family: var(--font-mono);
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.control-btn.turbo.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: var(--amber);
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

.control-btn.expand:hover {
  border-color: var(--indigo);
  color: var(--indigo);
}

.run-stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 11px;
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hp-group {
  flex: 1;
  max-width: 200px;
  gap: 8px;
}

.stat-label {
  color: var(--text-dim);
  font-size: 10px;
}

.hp-bar {
  flex: 1;
}

.stat {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-icon {
  font-size: 10px;
}

.stat.kills {
  color: var(--red);
}

.stat.gold {
  color: var(--amber);
}

.stat.xp {
  color: var(--cyan);
}

.death-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(10, 10, 18, 0.85);
}

.death-text {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: bold;
  color: var(--red);
  text-shadow: 0 0 20px rgba(239, 68, 68, 0.8);
  letter-spacing: 2px;
}

.death-stats {
  display: flex;
  gap: 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.death-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.death-btn {
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 11px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.death-btn.restart {
  background: var(--indigo);
  border: 1px solid var(--indigo);
  color: white;
}

.death-btn.restart:hover {
  background: #4f46e5;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
}

.death-btn.dismiss {
  background: var(--highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.death-btn.dismiss:hover {
  background: var(--border);
  color: var(--text-primary);
}
</style>
