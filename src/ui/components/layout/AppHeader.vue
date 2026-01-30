<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'

const progression = useProgressionStore()
const settings = useSettingsStore()

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

// Debug function to add essence
function debugAddEssence() {
  progression.debugAddEssence(100)
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="logo">Borglike</h1>
      <span class="tagline">Idle Angband Inspired Incremental</span>
    </div>

    <div class="header-center">
      <div class="essence-display" :class="{ animating: isAnimating }">
        <span class="essence-icon">&#x25C6;</span>
        <span class="essence-value">{{ progression.currency.essence.toLocaleString() }}</span>
        <span class="essence-label">Essence</span>
      </div>

      <!-- Debug button (remove in production) -->
      <button class="debug-btn" title="Debug: Add 100 Essence" @click="debugAddEssence">
        +100
      </button>
    </div>

    <div class="header-right">
      <button
        class="auto-run-toggle"
        :class="{
          active: settings.settings.autoRestart,
          locked: !hasAutoRestartUpgrade,
        }"
        :title="
          hasAutoRestartUpgrade
            ? settings.settings.autoRestart
              ? 'Auto-Run: ON'
              : 'Auto-Run: OFF'
            : 'Requires Auto Restart upgrade'
        "
        @click="toggleAutoRestart"
      >
        <span class="toggle-icon">&#x21BB;</span>
        <span class="toggle-label">Auto</span>
      </button>
      <button class="header-btn" title="Run History" @click="emit('openRunHistory')">
        <span>&#x2261;</span>
      </button>
      <button
        class="header-btn"
        :class="{ 'has-notification': progression.hasNewAchievements }"
        title="Achievements"
        @click="emit('openAchievements')"
      >
        <span>&#x1F3C6;</span>
        <span v-if="progression.hasNewAchievements" class="notification-dot"></span>
      </button>
      <button class="header-btn" title="Bestiary" @click="emit('openBestiary')">
        <span>&#x1F4D6;</span>
      </button>
      <button class="header-btn" title="Armory" @click="emit('openArmory')">
        <span>&#x1F4E6;</span>
      </button>
      <button class="header-btn" title="Codex" @click="emit('openCodex')">
        <span>&#x1F4DC;</span>
      </button>
      <button class="header-btn" title="Settings" @click="emit('openSettings')">
        <span>&#x2699;</span>
      </button>
      <button class="header-btn" title="Help" @click="emit('openHelp')">
        <span>?</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.logo {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: bold;
  margin: 0;
  color: var(--purple);
  text-shadow: 0 0 12px rgba(139, 92, 246, 0.5);
}

.tagline {
  font-size: 12px;
  color: var(--text-dim);
}

.header-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.essence-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  transition: all 0.3s ease;
}

.essence-display.animating {
  transform: scale(1.05);
  border-color: var(--purple);
  box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
}

.essence-icon {
  font-size: 16px;
  color: var(--purple);
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.7);
}

.essence-display.animating .essence-icon {
  animation: pulse 0.5s ease;
}

.essence-value {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: bold;
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.5);
}

.essence-display.animating .essence-value {
  color: #fff;
  text-shadow: 0 0 12px rgba(139, 92, 246, 0.8);
}

.essence-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.debug-btn {
  padding: 4px 8px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.2s;
}

.debug-btn:hover {
  background: var(--purple);
  border-color: var(--purple);
  color: white;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auto-run-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.auto-run-toggle:hover:not(.locked) {
  background: var(--border);
  color: var(--text-primary);
}

.auto-run-toggle.active {
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--green);
  color: var(--green);
}

.auto-run-toggle.active .toggle-icon {
  animation: spin 2s linear infinite;
}

.auto-run-toggle.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.toggle-icon {
  font-size: 14px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.header-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.header-btn:hover {
  background: var(--border);
  color: var(--text-primary);
  border-color: var(--indigo);
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
  background: var(--green);
  border-radius: 50%;
  animation: notification-pulse 1.5s infinite;
}

@keyframes notification-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
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
