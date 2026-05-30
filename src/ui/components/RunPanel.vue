<script setup lang="ts">
import { ref, onUnmounted, computed } from 'vue'
import type { ActiveRun } from '@/stores/runs'
import { isRunEnded } from '@/stores/runs'
import { PERSONALITY_DISPLAY } from '@/types/events'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { getBoosterById, type BoosterEffect } from '@game/data/boosters'
import { Icons } from '@/ui/icons'
import DungeonGrid from './DungeonGridCanvas.vue'
import ProgressBar from './common/ProgressBar.vue'
import GameTooltip from './common/GameTooltip.vue'
import Icon from './common/Icon.vue'

const props = defineProps<{
  run: ActiveRun
}>()

const progression = useProgressionStore()

// Get active boosters from progression store
const activeBoosters = computed(() => {
  const ids = progression.getActiveBoosterIds()
  return ids.map((id) => getBoosterById(id)).filter((b) => b !== undefined)
})

const personalityDisplay = computed(
  () => PERSONALITY_DISPLAY[props.run.config.personality ?? 'cautious']
)

function formatBoosterEffect(effect: BoosterEffect): string {
  switch (effect.type) {
    case 'stat_bonus':
      return `+${effect.value} ${effect.stat.toUpperCase()}`
    case 'equipment_bonus':
      return `+${effect.value} ${effect.slot} enchantment`
    case 'multiplier':
      return `+${effect.percent}% ${effect.stat}`
    case 'special':
      return effect.effect
  }
}

const emit = defineEmits<{
  expand: []
  restart: []
  dismiss: []
  kill: []
  configure: []
}>()

// Victory/death computed values
const isVictory = computed(() => props.run.state === 'victory')
const runEnded = computed(() => isRunEnded(props.run.state))
const isFirstVictory = computed(() => isVictory.value && progression.totalVictories === 1)

const deathCause = computed(() => {
  return props.run.finalStats?.deathCause || 'Unknown causes'
})

const duration = computed(() => {
  const endTime = props.run.finalStats?.endTime || Date.now()
  const ms = endTime - props.run.startTime
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}:${secs.toString().padStart(2, '0')}`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
})

const essenceEarned = computed(() => {
  return props.run.finalStats?.essenceEarned || 0
})

const isNewBest = computed(() => {
  const best = progression.bestRunByDepth
  if (!best) return true // First run is always a best
  return props.run.depth > best.maxDepth
})

const killerMonster = computed(() => {
  return props.run.finalStats?.killerMonster?.name
})

// Kill button hold state using requestAnimationFrame for smoother animation
const KILL_HOLD_DURATION = 1000 // 1 second hold required
const killHoldProgress = ref(0)
let killHoldStart: number | null = null
let killHoldRafId: number | null = null

function updateKillProgress() {
  if (killHoldStart === null) return

  const elapsed = Date.now() - killHoldStart
  killHoldProgress.value = Math.min(100, (elapsed / KILL_HOLD_DURATION) * 100)

  if (elapsed >= KILL_HOLD_DURATION) {
    emit('kill')
    cancelKillHold()
  } else {
    killHoldRafId = requestAnimationFrame(updateKillProgress)
  }
}

function startKillHold() {
  if (runEnded.value) return
  killHoldStart = Date.now()
  killHoldRafId = requestAnimationFrame(updateKillProgress)
}

function cancelKillHold() {
  killHoldStart = null
  killHoldProgress.value = 0
  if (killHoldRafId !== null) {
    cancelAnimationFrame(killHoldRafId)
    killHoldRafId = null
  }
}

onUnmounted(() => {
  cancelKillHold()
})

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
  <div class="run-panel" :class="{ dead: run.state === 'dead', victory: isVictory }">
    <header class="run-header">
      <div class="run-info">
        <span class="run-class">{{ run.config.class }}</span>
        <span class="run-race">{{ run.config.race }}</span>
        <GameTooltip
          tag="span"
          class="run-personality"
          :style="{ color: personalityDisplay.color }"
          :text="`${personalityDisplay.name} — ${personalityDisplay.desc}`"
        >
          {{ personalityDisplay.label }}
        </GameTooltip>
      </div>
      <div v-if="activeBoosters.length > 0" class="run-boosters">
        <GameTooltip
          v-for="b in activeBoosters"
          :key="b!.id"
          tag="span"
          class="booster-badge"
          :text="`${b!.name} — ${b!.description}`"
        >
          <Icon :name="b!.icon" />
          <template #extended>
            <div class="tt-row">
              <span class="tt-label">Effect</span>
              <span class="tt-val">{{ formatBoosterEffect(b!.effect) }}</span>
            </div>
            <div class="tt-row">
              <span class="tt-label">Category</span>
              <span class="tt-val">{{ b!.category }}</span>
            </div>
          </template>
        </GameTooltip>
      </div>
      <div class="run-depth">
        <span class="depth-label">D:</span>
        <span class="depth-value">{{ run.depth }}</span>
      </div>
      <div class="run-controls">
        <GameTooltip
          tag="button"
          class="control-btn turbo"
          :class="{ active: run.turbo }"
          :text="run.turbo ? 'Turbo: ON — Key: T' : 'Turbo: OFF — Key: T'"
          position="bottom"
          @click="handleToggleTurbo"
        >
          <Icon :name="Icons.turbo" />
          <template #extended>
            <span class="tt-muted">Fast-forwards this run. Uses more CPU.</span>
          </template>
        </GameTooltip>
        <GameTooltip
          tag="button"
          class="control-btn expand"
          text="Expand to full view — Key: 1-4"
          position="bottom"
          @click="handleExpand"
        >
          <Icon :name="Icons.expand" />
        </GameTooltip>
        <GameTooltip
          v-if="!runEnded"
          tag="button"
          class="control-btn configure"
          text="Edit loadout — applies to next auto-restart"
          position="bottom"
          @click="emit('configure')"
        >
          <Icon :name="Icons.configure" />
        </GameTooltip>
        <GameTooltip
          tag="button"
          class="control-btn kill"
          :class="{ holding: killHoldProgress > 0, disabled: runEnded }"
          :disabled="runEnded"
          text="Hold to kill run"
          position="bottom"
          @mousedown="startKillHold"
          @mouseup="cancelKillHold"
          @mouseleave="cancelKillHold"
          @touchstart.prevent="startKillHold"
          @touchend="cancelKillHold"
          @touchcancel="cancelKillHold"
        >
          <Icon class="kill-icon" :name="Icons.killRun" />
          <span
            v-if="killHoldProgress > 0"
            class="kill-progress"
            :style="{ width: killHoldProgress + '%' }"
          />
        </GameTooltip>
      </div>
    </header>

    <div class="run-stats-bar">
      <div class="stat-group bars-group">
        <div class="bar-row">
          <span class="stat-label">HP</span>
          <ProgressBar
            :current="run.hp"
            :max="run.maxHp"
            variant="hp"
            :show-text="true"
            size="md"
            class="resource-bar"
          />
        </div>
        <div v-if="run.maxMp > 0" class="bar-row">
          <span class="stat-label">MP</span>
          <ProgressBar
            :current="run.mp"
            :max="run.maxMp"
            variant="mp"
            :show-text="true"
            size="md"
            class="resource-bar"
          />
        </div>
      </div>
      <div class="stat-group">
        <span class="stat kills">
          <Icon class="stat-icon" :name="Icons.kills" />
          {{ run.kills }}
        </span>
        <span class="stat gold">
          <Icon class="stat-icon" :name="Icons.gold" />
          {{ run.gold }}
        </span>
        <span class="stat xp">
          <Icon class="stat-icon" :name="Icons.xp" />
          {{ run.xp }}
        </span>
      </div>
    </div>

    <DungeonGrid :grid="run.grid" :cursor-x="run.cursorX" :cursor-y="run.cursorY" />

    <div
      v-if="runEnded"
      class="death-overlay"
      :class="{ 'victory-overlay': isVictory, 'flash-in': isVictory }"
    >
      <span v-if="isFirstVictory" class="first-victory-badge">FIRST VICTORY!</span>
      <span v-if="isNewBest" class="new-best-badge">NEW BEST!</span>
      <span class="death-text" :class="{ 'victory-text': isVictory }">{{
        isVictory ? 'VICTORIOUS' : 'DEFEATED'
      }}</span>
      <div class="death-character">
        <span class="char-race">{{ run.config.race }}</span>
        <span class="char-class">{{ run.config.class }}</span>
        <span class="char-personality" :style="{ color: personalityDisplay.color }">{{
          personalityDisplay.label
        }}</span>
      </div>
      <span class="death-cause">{{
        isVictory
          ? 'Morgoth, Lord of Darkness has been slain!'
          : killerMonster
            ? `Slain by ${killerMonster}`
            : deathCause
      }}</span>
      <div class="death-metrics">
        <div class="metric">
          <span class="metric-value depth">{{ run.depth }}</span>
          <span class="metric-label">Depth</span>
        </div>
        <div class="metric">
          <span class="metric-value level">{{ run.level }}</span>
          <span class="metric-label">Level</span>
        </div>
        <div class="metric">
          <span class="metric-value kills">{{ run.kills }}</span>
          <span class="metric-label">Kills</span>
        </div>
        <div class="metric">
          <span class="metric-value gold">{{ run.gold }}</span>
          <span class="metric-label">Gold</span>
        </div>
        <div class="metric">
          <span class="metric-value time">{{ duration }}</span>
          <span class="metric-label">Time</span>
        </div>
      </div>
      <div v-if="essenceEarned > 0" class="essence-earned">
        <Icon class="essence-icon" :name="Icons.essence" />
        <span class="essence-value">+{{ essenceEarned }}</span>
        <span class="essence-label">essence</span>
      </div>
      <div class="death-actions">
        <button class="death-btn expand" title="View full stats" @click="emit('expand')">
          <Icon :name="Icons.expand" /> Details
        </button>
        <button class="death-btn configure" title="Change loadout" @click="emit('configure')">
          <Icon :name="Icons.configure" /> Config
        </button>
        <button class="death-btn restart" @click="handleRestart">
          <Icon :name="Icons.restart" /> Restart
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

.run-panel.victory {
  opacity: 0.85;
}

.run-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-base);
}

.run-info {
  display: flex;
  gap: var(--space-2);
}

.run-class {
  color: var(--success);
}

.run-race {
  color: var(--info);
}

.run-personality {
  font-size: var(--text-base);
  padding: 1px var(--space-1);
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
}

.run-boosters {
  display: flex;
  gap: var(--space-1);
}

.booster-badge {
  font-size: var(--text-base);
  padding: 2px var(--space-1);
  background: color-mix(in srgb, var(--essence) 15%, transparent);
  border: 1px solid var(--essence);
  border-radius: var(--radius-md);
  color: var(--essence);
  cursor: default;
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
  color: var(--essence);
  font-weight: bold;
}

.run-controls {
  display: flex;
  gap: var(--space-1);
}

.control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: var(--text-2xl);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s;
}

.control-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.control-btn.turbo.active {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border-color: var(--warning);
  color: var(--warning);
  text-shadow: 0 0 6px color-mix(in srgb, var(--warning) 50%, transparent);
}

.control-btn.expand:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.control-btn.configure:hover {
  border-color: var(--info);
  color: var(--info);
}

.control-btn.kill {
  position: relative;
  overflow: hidden;
}

.control-btn.kill:hover:not(.disabled) {
  border-color: var(--danger);
  color: var(--danger);
}

.control-btn.kill.holding {
  border-color: var(--danger);
  color: var(--danger);
}

.control-btn.kill.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.kill-icon {
  position: relative;
  z-index: 1;
}

.kill-progress {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: color-mix(in srgb, var(--danger) 30%, transparent);
  transition: width 0.05s linear;
}

.run-stats-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  font-size: var(--text-base);
}

.stat-group {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.bars-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  max-width: 220px;
  gap: var(--space-1);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.stat-label {
  color: var(--text-dim);
  font-size: var(--text-base);
  width: 20px;
  flex-shrink: 0;
}

.resource-bar {
  flex: 1;
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.stat-icon {
  font-size: var(--text-base);
}

.stat.kills {
  color: var(--danger);
}

.stat.gold {
  color: var(--warning);
}

.stat.xp {
  color: var(--info);
}

.death-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background: color-mix(in srgb, var(--bg) 90%, transparent);
}

.new-best-badge {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border: 1px solid var(--warning);
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  letter-spacing: 1px;
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 60%, transparent);
  animation: pulse-best 1.5s ease-in-out infinite;
}

@keyframes pulse-best {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 8px color-mix(in srgb, var(--warning) 40%, transparent);
  }
  50% {
    opacity: 0.8;
    box-shadow: 0 0 16px color-mix(in srgb, var(--warning) 60%, transparent);
  }
}

.death-text {
  font-size: var(--text-2xl);
  font-weight: bold;
  color: var(--danger);
  text-shadow: 0 0 20px color-mix(in srgb, var(--danger) 80%, transparent);
  letter-spacing: 2px;
}

.death-character {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-base);
}

.char-race {
  color: var(--info);
}

.char-class {
  color: var(--success);
}

.char-personality {
  font-size: var(--text-sm);
  padding: 1px var(--space-1);
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-sm);
}

.death-cause {
  font-size: var(--text-base);
  color: var(--text-dim);
  margin-bottom: var(--space-1);
}

.death-metrics {
  display: flex;
  gap: var(--space-4);
}

.metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.metric-value {
  font-size: var(--text-lg);
  font-weight: bold;
}

.metric-value.depth {
  color: var(--essence);
  text-shadow: 0 0 8px color-mix(in srgb, var(--essence) 50%, transparent);
}

.metric-value.level {
  color: var(--info);
  text-shadow: 0 0 8px color-mix(in srgb, var(--info) 50%, transparent);
}

.metric-value.kills {
  color: var(--danger);
  text-shadow: 0 0 8px color-mix(in srgb, var(--danger) 40%, transparent);
}

.metric-value.gold {
  color: var(--warning);
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 50%, transparent);
}

.metric-value.time {
  color: var(--text-secondary);
}

.metric-label {
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.essence-earned {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: color-mix(in srgb, var(--essence) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--essence) 30%, transparent);
  border-radius: var(--radius-md);
  margin-top: 2px;
}

.essence-icon {
  color: var(--essence);
  text-shadow: 0 0 8px color-mix(in srgb, var(--essence) 60%, transparent);
}

.essence-value {
  font-size: var(--text-md);
  font-weight: bold;
  color: var(--essence);
}

.essence-label {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.death-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.death-btn {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.death-btn.expand {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.death-btn.expand:hover {
  border-color: var(--essence);
  color: var(--essence);
}

.death-btn.configure {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.death-btn.configure:hover {
  border-color: var(--info);
  color: var(--info);
}

.death-btn.restart {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: white;
}

.death-btn.restart:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 40%, transparent);
}

.death-btn.dismiss {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.death-btn.dismiss:hover {
  background: var(--border);
  color: var(--text-primary);
}

/* Victory styles */
.victory-overlay {
  background: color-mix(in srgb, var(--bg) 92%, transparent) !important;
}

.victory-text {
  color: var(--warning) !important;
  text-shadow:
    0 0 20px color-mix(in srgb, var(--warning) 80%, transparent),
    0 0 40px color-mix(in srgb, var(--warning) 40%, transparent) !important;
}

.first-victory-badge {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 20%, transparent);
  border: 1px solid var(--warning);
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  letter-spacing: 1px;
  text-shadow: 0 0 8px color-mix(in srgb, var(--warning) 60%, transparent);
  animation: pulse-best 1.5s ease-in-out infinite;
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
