<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'
import { useEngineStateStore } from '@/stores/engine-state'
import { togglePause } from '@/engine/instance-manager'
import { Icons } from '@/ui/icons'
import GameTooltip from '../common/GameTooltip.vue'
import Icon from '../common/Icon.vue'

const progression = useProgressionStore()
const settings = useSettingsStore()
const engineState = useEngineStateStore()

// Auto-restart state
const hasAutoRestartUpgrade = computed(() => progression.getUpgradeLevel('auto_restart') > 0)

function toggleAutoRestart() {
  if (!hasAutoRestartUpgrade.value) return
  settings.updateSetting('autoRestart', !settings.settings.autoRestart)
}

// Animation state - CSS transition handles the timing, we just toggle the class
const isAnimating = ref(false)
let animationTimeout: ReturnType<typeof setTimeout> | null = null

// Watch for essence gains and trigger animation
watch(
  () => progression.currency.essence,
  (newVal, oldVal) => {
    if (newVal > oldVal) {
      // Clear any existing timeout to allow rapid gains
      if (animationTimeout) clearTimeout(animationTimeout)
      isAnimating.value = true
      animationTimeout = setTimeout(() => {
        isAnimating.value = false
        animationTimeout = null
      }, 500)
    }
  }
)

const emit = defineEmits<{
  openSettings: []
  openHelp: []
  openRunHistory: []
  openBestiary: []
  openArmory: []
  openCodex: []
  openAchievements: []
}>()
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="logo">Borglike</h1>
      <span class="tagline">Idle Angband Inspired Incremental</span>
    </div>

    <div class="header-center">
      <div class="essence-display" :class="{ animating: isAnimating }">
        <Icon class="essence-icon" :name="Icons.essence" />
        <span class="essence-value">{{ progression.currency.essence.toLocaleString() }}</span>
        <span class="essence-label">Essence</span>
      </div>
      <button
        v-if="settings.settings.cheatMode"
        class="cheat-btn"
        title="Cheat: +100 Essence"
        @click="progression.addEssence(100)"
      >
        +100
      </button>
    </div>

    <div class="header-right">
      <GameTooltip
        tag="button"
        class="pause-toggle"
        :class="{ active: engineState.isPaused }"
        :disabled="engineState.isCatchingUp"
        :text="engineState.isPaused ? 'Resume — Key: P' : 'Pause — Key: P'"
        position="bottom"
        @click="togglePause()"
      >
        <Icon class="toggle-icon" :name="engineState.isPaused ? Icons.play : Icons.pause" />
        <span class="toggle-label">{{ engineState.isPaused ? 'Play' : 'Pause' }}</span>
        <template #extended>
          <span class="tt-muted">Pauses all runs. Offline progress still accumulates.</span>
        </template>
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="auto-run-toggle"
        :class="{
          active: settings.settings.autoRestart,
          locked: !hasAutoRestartUpgrade,
        }"
        :text="
          hasAutoRestartUpgrade
            ? settings.settings.autoRestart
              ? 'Auto-Run: ON'
              : 'Auto-Run: OFF'
            : 'Requires Auto Restart upgrade'
        "
        position="bottom"
        @click="toggleAutoRestart"
      >
        <Icon class="toggle-icon" :name="Icons.autoRestart" />
        <span class="toggle-label">Auto</span>
        <template #extended>
          <span class="tt-muted">Automatically starts new runs when slots empty.</span>
        </template>
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="header-btn"
        text="Run History"
        position="bottom"
        @click="emit('openRunHistory')"
      >
        <Icon :name="Icons.history" />
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="header-btn"
        :class="{ 'has-notification': progression.hasNewAchievements }"
        position="bottom"
        @click="emit('openAchievements')"
      >
        <Icon :name="Icons.achievements" />
        <span v-if="progression.hasNewAchievements" class="notification-dot"></span>
        <template #content>
          <span class="game-tooltip-text"
            >Achievements — {{ progression.achievementStats.unlocked }}/{{
              progression.achievementStats.total
            }}</span
          >
        </template>
      </GameTooltip>
      <GameTooltip tag="button" class="header-btn" position="bottom" @click="emit('openBestiary')">
        <Icon :name="Icons.bestiary" />
        <template #content>
          <span class="game-tooltip-text"
            >Bestiary — {{ progression.bestiaryStats.discovered }} discovered</span
          >
        </template>
      </GameTooltip>
      <GameTooltip tag="button" class="header-btn" position="bottom" @click="emit('openArmory')">
        <Icon :name="Icons.armory" />
        <template #content>
          <span class="game-tooltip-text"
            >Armory — {{ progression.armoryStats.discovered }} discovered</span
          >
        </template>
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="header-btn"
        text="Codex — Races &amp; Classes"
        position="bottom"
        @click="emit('openCodex')"
      >
        <Icon :name="Icons.codex" />
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="header-btn"
        text="Settings"
        position="bottom"
        @click="emit('openSettings')"
      >
        <Icon :name="Icons.settings" />
      </GameTooltip>
      <GameTooltip
        tag="button"
        class="header-btn"
        text="Help"
        position="bottom"
        @click="emit('openHelp')"
      >
        <Icon :name="Icons.help" />
      </GameTooltip>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-4);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.logo {
  font-size: var(--text-3xl);
  font-weight: bold;
  margin: 0;
  color: var(--essence);
}

.tagline {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.header-center {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.essence-display {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--essence) 15%, transparent) 0%,
    color-mix(in srgb, var(--accent) 10%, transparent) 100%
  );
  border: 1px solid color-mix(in srgb, var(--essence) 30%, transparent);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
}

.essence-display.animating {
  transform: scale(1.05);
  border-color: var(--essence);
  box-shadow: 0 0 20px color-mix(in srgb, var(--essence) 50%, transparent);
}

.essence-icon {
  font-size: var(--text-xl);
  color: var(--essence);
}

.essence-display.animating .essence-icon {
  animation: pulse 0.5s ease;
}

.essence-value {
  font-size: var(--text-xl);
  font-weight: bold;
  color: var(--essence);
}

.essence-display.animating .essence-value {
  color: #fff;
  text-shadow: 0 0 12px color-mix(in srgb, var(--essence) 80%, transparent);
}

.essence-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.cheat-btn {
  padding: var(--space-1) var(--space-3);
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border: 1px solid var(--warning);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--warning);
  cursor: pointer;
  transition: all 0.2s;
}

.cheat-btn:hover {
  background: color-mix(in srgb, var(--warning) 30%, transparent);
}

.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.auto-run-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.auto-run-toggle:hover:not(.locked) {
  background: var(--border);
  color: var(--text-primary);
}

.auto-run-toggle.active {
  background: color-mix(in srgb, var(--success) 15%, transparent);
  border-color: var(--success);
  color: var(--success);
}

.auto-run-toggle.active .toggle-icon {
  animation: spin 2s linear infinite;
}

.auto-run-toggle.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.pause-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.pause-toggle:hover:not(:disabled) {
  background: var(--border);
  color: var(--text-primary);
}

.pause-toggle.active {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  border-color: var(--warning);
  color: var(--warning);
}

.pause-toggle:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toggle-icon {
  font-size: var(--text-2xl);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}

.header-btn {
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

.header-btn:hover {
  background: var(--border);
  color: var(--text-primary);
  border-color: var(--accent);
}

.header-btn.has-notification {
  position: relative;
}

.notification-dot {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background: var(--success);
  border-radius: 50%;
  animation: notification-pulse 1.5s infinite;
}

@keyframes notification-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 70%, transparent);
  }
  70% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--success) 0%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--success) 0%, transparent);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
</style>
