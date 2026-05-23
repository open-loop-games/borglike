<script setup lang="ts">
import { computed } from 'vue'
import type { ActiveRun } from '@/stores/runs'
import { isRunEnded } from '@/stores/runs'
import { PERSONALITY_DISPLAY } from '@/types/events'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { useRunDuration } from '@/ui/composables/use-run-duration'
import { useKillHoldButton } from '@/ui/composables/use-kill-hold'
import { Icons } from '@/ui/icons'
import DungeonGrid from '../DungeonGridCanvas.vue'
import RunSummary from '../analytics/RunSummary.vue'
import RunStatsAside from './RunStatsAside.vue'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  run: ActiveRun
}>()

const emit = defineEmits<{
  collapse: []
  back: []
  restart: []
  dismiss: []
  kill: []
}>()

const runs = useRunsStore()
const progression = useProgressionStore()

const isVictory = computed(() => props.run.state === 'victory')
const runEnded = computed(() => isRunEnded(props.run.state))

const personalityDisplay = computed(
  () => PERSONALITY_DISPLAY[props.run.config.personality ?? 'cautious']
)

const personalBest = computed(() => {
  if (!props.run.finalStats) return undefined
  const best = progression.bestRunByDepth
  if (!best || best.id === props.run.finalStats.id) return undefined
  return best
})

const runDuration = useRunDuration(() => props.run.startTime)

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

const killHold = useKillHoldButton({
  duration: 1000,
  onComplete: () => emit('kill'),
})

function startKillHold() {
  if (runEnded.value) return
  killHold.start()
}
</script>

<template>
  <div class="run-expanded" :class="{ dead: run.state === 'dead', victory: isVictory }">
    <!-- Header -->
    <header class="expanded-header">
      <div class="header-left">
        <button class="collapse-btn" title="Return to grid view" @click="handleCollapse">
          <Icon :name="Icons.close" />
        </button>
        <div class="run-identity">
          <span class="run-class">{{ run.config.class }}</span>
          <span class="run-race">{{ run.config.race }}</span>
          <span class="run-personality" :style="{ color: personalityDisplay.color }">{{
            personalityDisplay.label
          }}</span>
        </div>
      </div>

      <div class="header-center">
        <span class="slot-badge">Slot {{ run.slot + 1 }}</span>
        <span class="run-time">{{ runDuration }}</span>
        <span class="run-turns">T {{ run.turns.toLocaleString() }}</span>
      </div>

      <div class="header-right">
        <button class="turbo-btn" :class="{ active: run.turbo }" @click="handleToggleTurbo">
          <Icon class="turbo-icon" :name="Icons.turbo" />
          Turbo
        </button>
        <button
          class="kill-btn"
          :class="{ holding: killHold.progress.value > 0, disabled: runEnded }"
          :disabled="runEnded"
          title="Hold to end run"
          @mousedown="startKillHold"
          @mouseup="killHold.cancel"
          @mouseleave="killHold.cancel"
          @touchstart.prevent="startKillHold"
          @touchend="killHold.cancel"
          @touchcancel="killHold.cancel"
        >
          <Icon class="kill-icon" :name="Icons.killRun" />
          Kill
          <span
            v-if="killHold.progress.value > 0"
            class="kill-progress"
            :style="{ width: killHold.progress.value + '%' }"
          />
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="expanded-content">
      <RunStatsAside :run="run" />

      <div class="dungeon-container">
        <DungeonGrid
          :grid="run.grid"
          :cursor-x="run.cursorX"
          :cursor-y="run.cursorY"
          class="expanded-grid"
        />
      </div>
    </div>

    <!-- Death/Victory Overlay -->
    <div
      v-if="runEnded"
      class="death-overlay"
      :class="{ 'victory-overlay': isVictory, 'flash-in': isVictory }"
    >
      <RunSummary
        v-if="run.finalStats"
        :run="run.finalStats"
        :personal-best="personalBest"
        @close="handleCollapse"
        @restart="handleRestart"
      />
      <div v-else class="death-content">
        <Icon class="death-icon" :name="Icons.death" />
        <span class="death-text">DEFEATED</span>
        <div class="death-stats">
          <span>Reached Depth {{ run.depth }}</span>
          <span>{{ run.kills }} Kills</span>
          <span>{{ run.gold }} Gold</span>
        </div>
        <div class="death-actions">
          <button class="action-btn primary" @click="handleRestart">
            <Icon :name="Icons.restart" /> Restart Run
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
  background: var(--bg);
}

.run-expanded.dead {
  opacity: 0.9;
}

.run-expanded.victory {
  opacity: 0.95;
}

/* Header */
.expanded-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.collapse-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-3xl);
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
}

.run-identity {
  display: flex;
  gap: var(--space-3);
  font-size: var(--text-lg);
}

.run-class {
  color: var(--success);
}

.run-race {
  color: var(--info);
}

.run-personality {
  font-size: var(--text-base);
  opacity: 0.7;
}

.header-center {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.slot-badge {
  font-size: var(--text-base);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.run-time {
  font-size: var(--text-lg);
  color: var(--text-dim);
}

.run-turns {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.turbo-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 14px;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.turbo-btn:hover {
  border-color: var(--warning);
  color: var(--warning);
}

.turbo-btn.active {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border-color: var(--warning);
  color: var(--warning);
  text-shadow: 0 0 6px color-mix(in srgb, var(--warning) 50%, transparent);
}

.turbo-icon {
  font-size: var(--text-base);
}

.kill-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 14px;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.kill-btn:hover:not(.disabled) {
  border-color: var(--danger);
  color: var(--danger);
}

.kill-btn.holding {
  border-color: var(--danger);
  color: var(--danger);
}

.kill-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.kill-btn .kill-icon {
  position: relative;
  z-index: 1;
}

.kill-btn .kill-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: color-mix(in srgb, var(--danger) 30%, transparent);
  transition: width 0.05s linear;
}

/* Content */
.expanded-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Dungeon */
.dungeon-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  overflow: hidden;
}

.expanded-grid {
  font-size: var(--text-xl);
}

/* Death Overlay */
.death-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  z-index: 10;
}

.death-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  text-align: center;
}

.death-icon {
  font-size: 48px;
  opacity: 0.8;
}

.death-text {
  font-size: var(--text-5xl);
  font-weight: bold;
  color: var(--danger);
  text-shadow: 0 0 24px color-mix(in srgb, var(--danger) 60%, transparent);
  letter-spacing: 6px;
}

.death-stats {
  display: flex;
  gap: var(--space-6);
  font-size: var(--text-lg);
  color: var(--text-secondary);
}

.death-actions {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-5);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-md);
  font-size: var(--text-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: white;
  font-weight: bold;
}

.action-btn.primary:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
}

.action-btn.secondary {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: var(--border);
  color: var(--text-primary);
  border-color: var(--accent);
}

/* Victory overlay */
.victory-overlay {
  background: color-mix(in srgb, var(--bg) 92%, transparent) !important;
}

@keyframes flash-in {
  0% {
    background: color-mix(in srgb, var(--warning) 50%, transparent);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    background: color-mix(in srgb, var(--bg) 92%, transparent);
  }
}

.flash-in {
  animation: flash-in 0.8s ease-out;
}
</style>
