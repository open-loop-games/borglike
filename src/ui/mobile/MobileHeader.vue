<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { useSettingsStore } from '@/stores/settings'
import { useEngineStateStore } from '@/stores/engine-state'
import { togglePause } from '@/engine/instance-manager'

const progression = useProgressionStore()
const settings = useSettingsStore()
const engineState = useEngineStateStore()

const hasAutoRestartUpgrade = computed(() => progression.getUpgradeLevel('auto_restart') > 0)

function toggleAutoRestart() {
  if (!hasAutoRestartUpgrade.value) return
  settings.updateSetting('autoRestart', !settings.settings.autoRestart)
}

const isAnimating = ref(false)
let animationTimeout: ReturnType<typeof setTimeout> | null = null

watch(
  () => progression.currency.essence,
  (newVal, oldVal) => {
    if (newVal > oldVal) {
      if (animationTimeout) clearTimeout(animationTimeout)
      isAnimating.value = true
      animationTimeout = setTimeout(() => {
        isAnimating.value = false
        animationTimeout = null
      }, 500)
    }
  }
)
</script>

<template>
  <header class="mobile-header">
    <h1 class="logo">Borglike</h1>

    <div class="header-controls">
      <div class="essence-display" :class="{ animating: isAnimating }">
        <span class="essence-icon">&#9670;</span>
        <span class="essence-value">{{ progression.currency.essence.toLocaleString() }}</span>
      </div>
      <button
        v-if="settings.settings.cheatMode"
        class="cheat-btn"
        @click="progression.addEssence(100)"
      >
        +100
      </button>
      <button
        class="control-btn"
        :class="{ active: engineState.isPaused }"
        :disabled="engineState.isCatchingUp"
        @click="togglePause()"
      >
        {{ engineState.isPaused ? '&#9654;' : '&#9208;' }}
      </button>
      <button
        class="control-btn"
        :class="{
          active: settings.settings.autoRestart,
          locked: !hasAutoRestartUpgrade,
        }"
        @click="toggleAutoRestart"
      >
        &#8635;
      </button>
    </div>
  </header>
</template>

<style scoped>
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  height: 44px;
  flex-shrink: 0;
}

.logo {
  font-size: var(--text-xl);
  font-weight: bold;
  margin: 0;
  color: var(--purple);
  text-shadow: 0 0 12px rgba(139, 92, 246, 0.5);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.essence-display {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: var(--radius-md);
  transition: all 0.3s ease;
}

.essence-display.animating {
  transform: scale(1.05);
  border-color: var(--purple);
  box-shadow: 0 0 12px rgba(139, 92, 246, 0.5);
}

.essence-icon {
  font-size: var(--text-base);
  color: var(--purple);
}

.essence-value {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--purple);
}

.cheat-btn {
  padding: var(--space-1) var(--space-2);
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid var(--amber);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: bold;
  color: var(--amber);
  cursor: pointer;
}

.control-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-lg);
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn.active {
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--green);
  color: var(--green);
}

.control-btn.locked {
  opacity: 0.4;
  cursor: not-allowed;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
