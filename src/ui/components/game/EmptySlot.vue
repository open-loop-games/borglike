<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { getBoosterById } from '@game/data/boosters'

const props = defineProps<{
  slot: number
}>()

type Personality = 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'

const emit = defineEmits<{
  startRun: [slot: number, config?: { race: string; class: string; personality: Personality }]
  openLoadout: [slot: number]
}>()

const progression = useProgressionStore()

const slotConfig = computed(() => progression.getSlotConfig(props.slot))

const boosterNames = computed(() => {
  const names: string[] = []
  for (const id of slotConfig.value.boosters) {
    if (id) {
      const booster = getBoosterById(id)
      if (booster) names.push(booster.name)
    }
  }
  return names
})

function handleQuickStart() {
  const savedConfig = slotConfig.value
  // Set active boosters from saved slot config
  progression.setActiveBooster(0, savedConfig.boosters[0])
  progression.setActiveBooster(1, savedConfig.boosters[1])
  emit('startRun', props.slot, {
    race: savedConfig.race,
    class: savedConfig.class,
    personality: savedConfig.personality,
  })
}

function handleOpenLoadout() {
  emit('openLoadout', props.slot)
}
</script>

<template>
  <div class="empty-slot">
    <div class="slot-header">
      <span class="slot-number">Slot {{ slot + 1 }}</span>
    </div>

    <div class="slot-content">
      <div class="quick-start">
        <button class="start-btn" @click="handleQuickStart">
          <span class="btn-icon">&#x25B6;</span>
          <span>Quick Start</span>
        </button>

        <div class="config-summary">
          <span class="summary-main">
            {{ slotConfig.race }} {{ slotConfig.class }}
            <span class="personality">({{ slotConfig.personality }})</span>
          </span>
          <span v-if="boosterNames.length" class="summary-boosters">
            {{ boosterNames.join(', ') }}
          </span>
        </div>

        <button class="config-btn" @click="handleOpenLoadout">Configure Run</button>
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

.config-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: var(--font-mono);
  font-size: 11px;
}

.summary-main {
  color: var(--text-secondary);
}

.summary-main .personality {
  color: var(--text-dim);
}

.summary-boosters {
  color: var(--text-dim);
  font-size: 10px;
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

.config-btn {
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

.config-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
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
