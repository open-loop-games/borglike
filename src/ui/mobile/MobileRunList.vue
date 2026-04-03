<script setup lang="ts">
import { computed } from 'vue'
import { useRunsStore, isRunEnded } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { startRun, killRun, setSlotConfiguring } from '@/engine/instance-manager'
import type { Personality } from '@/types/events'
import RunPanel from '@/ui/components/RunPanel.vue'
import PanelFrame from '@/ui/components/common/PanelFrame.vue'
import EmptySlot from '@/ui/components/game/EmptySlot.vue'

const runs = useRunsStore()
const progression = useProgressionStore()

const emit = defineEmits<{
  'expand-run': [slotIndex: number]
  'open-loadout': [slotIndex: number]
}>()

const maxSlots = computed(() => progression.maxRunSlots)

const visibleSlots = computed(() => {
  const arr = []
  for (let i = 0; i < maxSlots.value; i++) {
    arr.push({
      index: i,
      run: runs.getRunBySlot(i),
    })
  }
  return arr
})

function handleExpand(slot: number) {
  emit('expand-run', slot)
}

function handleStartRun(
  slot: number,
  config?: { race: string; class: string; personality: Personality }
) {
  setSlotConfiguring(slot, false)
  startRun(slot, config)
}

function handleOpenLoadout(slot: number) {
  setSlotConfiguring(slot, true)
  emit('open-loadout', slot)
}

function handleRestart(slot: number) {
  const run = runs.getRunBySlot(slot)
  if (run) {
    runs.removeRun(run.id)
    const slotConfig = progression.getSlotConfig(slot)
    progression.setActiveBooster(0, slotConfig.boosters[0])
    progression.setActiveBooster(1, slotConfig.boosters[1])
    startRun(slot, {
      race: slotConfig.race,
      class: slotConfig.class,
      personality: slotConfig.personality,
    })
  }
}

function handleDismiss(slot: number) {
  const run = runs.getRunBySlot(slot)
  if (run) {
    runs.removeRun(run.id)
  }
}

function handleConfigure(slot: number) {
  setSlotConfiguring(slot, true)
  const run = runs.getRunBySlot(slot)
  if (run) {
    runs.removeRun(run.id)
  }
  emit('open-loadout', slot)
}

function handleKill(slot: number) {
  const run = runs.getRunBySlot(slot)
  if (run && !isRunEnded(run.state)) {
    killRun(run.id)
  }
}
</script>

<template>
  <div class="run-list">
    <div v-for="slot in visibleSlots" :key="slot.index" class="run-card-wrapper">
      <PanelFrame :focused="slot.run?.state === 'running'" :no-padding="true">
        <RunPanel
          v-if="slot.run"
          :run="slot.run"
          @expand="handleExpand(slot.index)"
          @restart="handleRestart(slot.index)"
          @dismiss="handleDismiss(slot.index)"
          @kill="handleKill(slot.index)"
          @configure="handleConfigure(slot.index)"
        />
        <EmptySlot
          v-else
          :slot="slot.index"
          @start-run="handleStartRun"
          @open-loadout="handleOpenLoadout"
        />
      </PanelFrame>
    </div>
  </div>
</template>

<style scoped>
.run-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  overflow-y: auto;
  height: 100%;
}

.run-card-wrapper {
  flex-shrink: 0;
}
</style>
