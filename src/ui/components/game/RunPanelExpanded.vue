<script setup lang="ts">
import { computed } from 'vue'
import type { ActiveRun } from '@/stores/runs'
import { useRunsStore } from '@/stores/runs'
import DungeonGrid from '../DungeonGrid.vue'
import ProgressBar from '../common/ProgressBar.vue'
import PanelFrame from '../common/PanelFrame.vue'

const props = defineProps<{
  run: ActiveRun
}>()

const emit = defineEmits<{
  collapse: []
  restart: []
  dismiss: []
}>()

const runs = useRunsStore()

const runDuration = computed(() => {
  const seconds = Math.floor((Date.now() - props.run.startTime) / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
})

function handleCollapse() {
  emit('collapse')
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
  <div class="run-expanded" :class="{ dead: run.state === 'dead' }">
    <!-- Header -->
    <header class="expanded-header">
      <div class="header-left">
        <button class="collapse-btn" title="Return to grid view" @click="handleCollapse">
          <span>&#x2716;</span>
        </button>
        <div class="run-identity">
          <span class="run-class">{{ run.config.class }}</span>
          <span class="run-race">{{ run.config.race }}</span>
        </div>
      </div>

      <div class="header-center">
        <span class="slot-badge">Slot {{ run.slot + 1 }}</span>
        <span class="run-time">{{ runDuration }}</span>
      </div>

      <div class="header-right">
        <button class="turbo-btn" :class="{ active: run.turbo }" @click="handleToggleTurbo">
          <span class="turbo-icon">&#x25B6;&#x25B6;</span>
          Turbo
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="expanded-content">
      <!-- Stats Panel -->
      <aside class="stats-panel">
        <PanelFrame class="stat-section">
          <h3>Vitals</h3>
          <div class="stat-row">
            <span class="stat-label">HP</span>
            <ProgressBar
              :current="run.hp"
              :max="run.maxHp"
              variant="hp"
              :show-text="true"
              size="md"
              class="hp-bar"
            />
          </div>
          <div class="stat-row">
            <span class="stat-label">XP</span>
            <span class="stat-value xp">{{ run.xp.toLocaleString() }}</span>
          </div>
        </PanelFrame>

        <PanelFrame class="stat-section">
          <h3>Progress</h3>
          <div class="stat-row">
            <span class="stat-label">Depth</span>
            <span class="stat-value depth">{{ run.depth }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Turns</span>
            <span class="stat-value">{{ run.turns.toLocaleString() }}</span>
          </div>
        </PanelFrame>

        <PanelFrame class="stat-section">
          <h3>Combat</h3>
          <div class="stat-row">
            <span class="stat-label">Kills</span>
            <span class="stat-value kills">{{ run.kills }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Gold</span>
            <span class="stat-value gold">{{ run.gold.toLocaleString() }}</span>
          </div>
        </PanelFrame>

        <PanelFrame class="stat-section">
          <h3>Status</h3>
          <div class="status-badges">
            <span class="status-badge" :class="run.state">
              {{ run.state === 'dead' ? 'DEAD' : run.state === 'running' ? 'ACTIVE' : 'STARTING' }}
            </span>
            <span v-if="run.turbo" class="status-badge turbo">TURBO</span>
          </div>
        </PanelFrame>
      </aside>

      <!-- Dungeon View -->
      <div class="dungeon-container">
        <DungeonGrid
          :grid="run.grid"
          :cursor-x="run.cursorX"
          :cursor-y="run.cursorY"
          class="expanded-grid"
        />
      </div>
    </div>

    <!-- Death Overlay -->
    <div v-if="run.state === 'dead'" class="death-overlay">
      <div class="death-content">
        <span class="death-icon">&#x2620;</span>
        <span class="death-text">DEFEATED</span>
        <div class="death-stats">
          <span>Reached Depth {{ run.depth }}</span>
          <span>{{ run.kills }} Kills</span>
          <span>{{ run.gold }} Gold</span>
        </div>
        <div class="death-actions">
          <button class="action-btn primary" @click="handleRestart">
            <span>&#x21BB;</span> Restart Run
          </button>
          <button class="action-btn secondary" @click="handleDismiss">Dismiss</button>
          <button class="action-btn secondary" @click="handleCollapse">Return to Grid</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-expanded {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  background: var(--void);
}

.run-expanded.dead {
  opacity: 0.9;
}

/* Header */
.expanded-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  width: 32px;
  height: 32px;
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

.collapse-btn:hover {
  background: var(--red);
  border-color: var(--red);
  color: white;
}

.run-identity {
  display: flex;
  gap: 12px;
  font-family: var(--font-mono);
  font-size: 14px;
}

.run-class {
  color: var(--green);
  text-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}

.run-race {
  color: var(--cyan);
  text-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
}

.header-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

.slot-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 10px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.run-time {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-dim);
}

.header-right {
  display: flex;
  align-items: center;
}

.turbo-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.turbo-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.turbo-btn.active {
  background: rgba(245, 158, 11, 0.15);
  border-color: var(--amber);
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.5);
}

.turbo-icon {
  font-size: 10px;
}

/* Content */
.expanded-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Stats Panel */
.stats-panel {
  width: 220px;
  padding: 12px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-section {
  padding: 12px !important;
}

.stat-section h3 {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.stat-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.stat-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-value.depth {
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}

.stat-value.kills {
  color: var(--red);
}

.stat-value.gold {
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.stat-value.xp {
  color: var(--cyan);
}

.hp-bar {
  flex: 1;
  max-width: 120px;
}

.status-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.status-badge {
  font-family: var(--font-mono);
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.status-badge.running {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid var(--green);
  color: var(--green);
}

.status-badge.starting {
  background: rgba(6, 182, 212, 0.15);
  border: 1px solid var(--cyan);
  color: var(--cyan);
}

.status-badge.dead {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid var(--red);
  color: var(--red);
}

.status-badge.turbo {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid var(--amber);
  color: var(--amber);
}

/* Dungeon */
.dungeon-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  overflow: hidden;
}

.expanded-grid {
  font-size: 16px;
}

/* Death Overlay */
.death-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 18, 0.85);
  z-index: 10;
}

.death-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.death-icon {
  font-size: 48px;
  opacity: 0.8;
}

.death-text {
  font-family: var(--font-mono);
  font-size: 32px;
  font-weight: bold;
  color: var(--red);
  text-shadow: 0 0 24px rgba(239, 68, 68, 0.6);
  letter-spacing: 6px;
}

.death-stats {
  display: flex;
  gap: 24px;
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--text-secondary);
}

.death-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 24px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
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

.action-btn.secondary {
  background: var(--highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--border);
  color: var(--text-primary);
  border-color: var(--indigo);
}
</style>
