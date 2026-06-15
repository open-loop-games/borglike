<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { getBoosterById } from '@game/data/boosters'
import type { Personality } from '@/types/events'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  slot: number
}>()

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

const lastRun = computed(() => progression.lastRunBySlot[props.slot] ?? null)

const lastRunSummary = computed(() => {
  const run = lastRun.value
  if (!run) return null
  return {
    depth: run.maxDepth,
    cause: run.isVictory ? 'Slew Morgoth' : (run.deathCause ?? 'Unknown'),
    turns: run.turns ?? 0,
    victory: !!run.isVictory,
  }
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
          <Icon class="btn-icon" :name="Icons.play" />
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

        <button v-if="progression.reveal.selectable" class="config-btn" @click="handleOpenLoadout">
          Configure Run
        </button>

        <div v-if="lastRunSummary" class="last-run" :class="{ victory: lastRunSummary.victory }">
          <div class="last-run-label">Last Run</div>
          <div class="last-run-stats">
            <span class="last-run-stat">
              <span class="stat-label">Depth</span>
              <span class="stat-value">{{ lastRunSummary.depth }}</span>
            </span>
            <span class="last-run-stat">
              <span class="stat-label">Turns</span>
              <span class="stat-value">{{ lastRunSummary.turns.toLocaleString() }}</span>
            </span>
          </div>
          <div class="last-run-cause">{{ lastRunSummary.cause }}</div>
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
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--accent) 5%, transparent) 0%,
    transparent 70%
  );
  position: relative;
}

.slot-header {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
}

.slot-number {
  font-size: var(--text-base);
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
  gap: var(--space-3);
}

.config-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: var(--text-base);
}

.summary-main {
  color: var(--text-secondary);
}

.summary-main .personality {
  color: var(--text-dim);
}

.summary-boosters {
  color: var(--text-dim);
  font-size: var(--text-base);
}

.start-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-lg);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s;
}

.start-btn:hover {
  background: var(--border);
  border-color: var(--accent);
  color: var(--info);
  text-shadow: 0 0 8px color-mix(in srgb, var(--info) 50%, transparent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 20%, transparent);
}

.btn-icon {
  font-size: var(--text-base);
  color: var(--success);
}

.start-btn:hover .btn-icon {
  color: var(--info);
  text-shadow: 0 0 8px color-mix(in srgb, var(--info) 60%, transparent);
}

.config-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-dim);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-base);
  cursor: pointer;
  border-radius: var(--radius-md);
  transition: all 0.2s;
}

.config-btn:hover {
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

.last-run {
  margin-top: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--bg-highlight) 60%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  min-width: 220px;
}

.last-run.victory {
  border-color: color-mix(in srgb, var(--success) 60%, transparent);
  background: color-mix(in srgb, var(--success) 8%, transparent);
}

.last-run-label {
  font-size: var(--text-xs, var(--text-base));
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.last-run-stats {
  display: flex;
  gap: var(--space-4);
}

.last-run-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.last-run-stat .stat-label {
  font-size: var(--text-xs, var(--text-base));
  color: var(--text-dim);
  text-transform: uppercase;
}

.last-run-stat .stat-value {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: bold;
}

.last-run-cause {
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-style: italic;
  text-align: center;
  max-width: 240px;
}

.last-run.victory .last-run-cause {
  color: var(--success);
  font-style: normal;
}

.slot-decoration {
  position: absolute;
  bottom: 20%;
  opacity: 0.05;
  pointer-events: none;
}

.deco-char {
  font-size: 120px;
  color: var(--accent);
}
</style>
