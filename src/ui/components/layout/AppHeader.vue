<script setup lang="ts">
import { ref, watch } from 'vue'
import { useProgressionStore } from '@/stores/progression'

const progression = useProgressionStore()

// Animation state
const isAnimating = ref(false)
const previousEssence = ref(progression.currency.essence)

// Watch for essence changes and trigger animation
watch(
  () => progression.currency.essence,
  (newVal, oldVal) => {
    if (newVal > oldVal) {
      isAnimating.value = true
      setTimeout(() => {
        isAnimating.value = false
      }, 500)
    }
    previousEssence.value = newVal
  }
)

const emit = defineEmits<{
  openSettings: []
  openHelp: []
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
      <span class="tagline">Idle Angband</span>
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
      <div class="artifact-display">
        <span class="artifact-icon">!</span>
        <span class="artifact-value">{{ progression.currency.artifacts }}</span>
      </div>
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

.artifact-display {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 4px;
}

.artifact-icon {
  font-size: 14px;
  font-family: var(--font-mono);
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
}

.artifact-value {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  color: var(--amber);
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
