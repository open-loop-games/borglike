<script setup lang="ts">
import { ref } from 'vue'
import { useProgressionStore } from '@/stores/progression'

const props = defineProps<{
  slot: number
}>()

type Personality = 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'

const emit = defineEmits<{
  startRun: [slot: number, config?: { race: string; class: string; personality: Personality }]
  openLoadout: [slot: number]
}>()

const progression = useProgressionStore()

// Race/class selection state
const selectedRace = ref(progression.availableRaces[0] || 'Human')
const selectedClass = ref(progression.availableClasses[0] || 'Warrior')
const showConfig = ref(false)

function handleQuickStart() {
  emit('startRun', props.slot, {
    race: selectedRace.value,
    class: selectedClass.value,
    personality: 'cautious',
  })
}

function handleConfiguredStart() {
  emit('startRun', props.slot, {
    race: selectedRace.value,
    class: selectedClass.value,
    personality: 'cautious',
  })
}

function handleOpenLoadout() {
  emit('openLoadout', props.slot)
}

function toggleConfig() {
  showConfig.value = !showConfig.value
}
</script>

<template>
  <div class="empty-slot">
    <div class="slot-header">
      <span class="slot-number">Slot {{ slot + 1 }}</span>
    </div>

    <div class="slot-content">
      <!-- Quick Start -->
      <div v-if="!showConfig" class="quick-start">
        <button class="start-btn" @click="handleQuickStart">
          <span class="btn-icon">&#x25B6;</span>
          <span>Quick Start</span>
        </button>
        <div class="quick-actions">
          <button class="config-btn" @click="toggleConfig">Simple Config</button>
          <button class="config-btn" @click="handleOpenLoadout">Full Loadout</button>
        </div>
      </div>

      <!-- Configuration Panel -->
      <div v-else class="config-panel">
        <div class="config-row">
          <label class="config-label">Race</label>
          <select v-model="selectedRace" class="config-select">
            <option v-for="race in progression.availableRaces" :key="race" :value="race">
              {{ race }}
            </option>
          </select>
        </div>

        <div class="config-row">
          <label class="config-label">Class</label>
          <select v-model="selectedClass" class="config-select">
            <option v-for="cls in progression.availableClasses" :key="cls" :value="cls">
              {{ cls }}
            </option>
          </select>
        </div>

        <div class="config-actions">
          <button class="start-btn small" @click="handleConfiguredStart">
            <span class="btn-icon">&#x25B6;</span>
            Start
          </button>
          <button class="cancel-btn" @click="toggleConfig">Cancel</button>
        </div>
      </div>
    </div>

    <div class="slot-decoration">
      <span class="deco-char">@</span>
    </div>
  </div>
</template>

<style scoped>
.empty-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: radial-gradient(ellipse at center, rgba(99, 102, 241, 0.05) 0%, transparent 70%);
  position: relative;
}

.slot-header {
  position: absolute;
  top: 12px;
  left: 12px;
}

.slot-number {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.slot-content {
  z-index: 1;
}

.quick-start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--highlight);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 12px 24px;
  font-size: 14px;
  font-family: var(--font-mono);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.start-btn.small {
  padding: 8px 16px;
  font-size: 12px;
}

.start-btn:hover {
  background: var(--border);
  border-color: var(--indigo);
  color: var(--cyan);
  text-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.2);
}

.btn-icon {
  font-size: 12px;
  color: var(--green);
}

.start-btn:hover .btn-icon {
  color: var(--cyan);
  text-shadow: 0 0 8px rgba(6, 182, 212, 0.6);
}

.config-btn,
.cancel-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: 6px 12px;
  font-size: 11px;
  font-family: var(--font-mono);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s;
}

.config-btn:hover,
.cancel-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

.config-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  min-width: 200px;
}

.config-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.config-select {
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}

.config-select:focus {
  outline: none;
  border-color: var(--indigo);
}

.config-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.slot-decoration {
  position: absolute;
  bottom: 20%;
  opacity: 0.05;
  pointer-events: none;
}

.deco-char {
  font-family: var(--font-mono);
  font-size: 120px;
  color: var(--indigo);
}
</style>
