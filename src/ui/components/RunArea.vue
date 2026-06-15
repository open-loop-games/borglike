<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRunsStore } from '@/stores/runs'
import { useProgressionStore } from '@/stores/progression'
import { isRunEnded } from '@/stores/runs'
import { startRun, killRun, setSlotConfiguring } from '@/engine/instance-manager'
import type { Personality } from '@/types/events'
import RunPanel from './RunPanel.vue'
import PanelFrame from './common/PanelFrame.vue'
import EmptySlot from './game/EmptySlot.vue'
import LockedSlot from './game/LockedSlot.vue'
import RunPanelExpanded from './game/RunPanelExpanded.vue'
import LoadoutEditor from './game/LoadoutEditor.vue'

const runs = useRunsStore()
const progression = useProgressionStore()

// Loadout editor state
const loadoutSlot = ref<number | null>(null)

const maxSlots = computed(() => progression.maxRunSlots)

// All 4 slots, showing locked state for unavailable slots
const allSlots = computed(() => {
  const max = maxSlots.value
  const arr = []
  for (let i = 0; i < 4; i++) {
    const isUnlocked = i < max
    arr.push({
      index: i,
      isUnlocked,
      run: isUnlocked ? runs.getRunBySlot(i) : null,
    })
  }
  return arr
})

// Show all unlocked slots plus a single locked teaser for the next slot.
// This keeps the grid from having an unexplained empty quadrant. The teaser is
// gated by reveal phase so new players aren't shown locked slots up front
// (studio/borglike#2): slot 2 teases at "selectable", slots 3/4 at "wide".
const visibleSlots = computed(() => {
  const max = maxSlots.value
  return allSlots.value.slice(0, Math.min(max + 1, progression.revealedSlotCount))
})

const gridClass = computed(() => {
  // When focused or editing loadout, use full-width layout
  if (runs.focusedSlot !== null || loadoutSlot.value !== null) return 'grid-focused'

  const slotCount = visibleSlots.value.length
  switch (slotCount) {
    case 1:
      return 'grid-1'
    case 2:
      return 'grid-2'
    case 3:
      return 'grid-3'
    case 4:
      return 'grid-4'
    default:
      return 'grid-1'
  }
})

// Derive from allSlots to avoid duplicate store lookup
const focusedRun = computed(() => {
  if (runs.focusedSlot === null) return null
  return allSlots.value[runs.focusedSlot]?.run ?? null
})

function handleStartRun(
  slot: number,
  config?: {
    race: string
    class: string
    personality: Personality
  }
) {
  try {
    setSlotConfiguring(slot, false)
    // Queue mode: slot still has a live run, so the editor was opened mid-run.
    // LoadoutEditor has already persisted slot config; let the current run
    // finish and auto-restart will pick up the new values.
    const existing = runs.getRunBySlot(slot)
    if (existing && !isRunEnded(existing.state)) {
      loadoutSlot.value = null
      return
    }
    startRun(slot, config)
    loadoutSlot.value = null
  } catch (err) {
    console.error('Failed to start run:', err)
  }
}

function handleOpenLoadout(slot: number) {
  setSlotConfiguring(slot, true)
  loadoutSlot.value = slot
}

function handleCloseLoadout() {
  if (loadoutSlot.value !== null) setSlotConfiguring(loadoutSlot.value, false)
  loadoutSlot.value = null
}

function handleLoadoutStart(config: { race: string; class: string; personality: Personality }) {
  if (loadoutSlot.value !== null) {
    handleStartRun(loadoutSlot.value, config)
  }
}

function handleExpand(slot: number) {
  runs.setFocusedSlot(slot)
}

function handleCollapse() {
  runs.clearFocus()
}

function handleRestart(slot: number) {
  const run = runs.getRunBySlot(slot)
  if (run) {
    runs.removeRun(run.id)
    // Use saved slot config (preserves 'Random') instead of resolved run config
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
  // Only clear ended runs; an active run keeps going while the user edits the
  // slot config — auto-restart picks up the new values on its next cycle.
  if (run && isRunEnded(run.state)) {
    runs.removeRun(run.id)
  }
  loadoutSlot.value = slot
}

function handleDismissExpanded() {
  if (runs.focusedSlot !== null) {
    handleDismiss(runs.focusedSlot)
    runs.clearFocus()
  }
}

function handleKill(slot: number) {
  const run = runs.getRunBySlot(slot)
  if (run && !isRunEnded(run.state)) {
    killRun(run.id)
  }
}

function handleKillExpanded() {
  if (runs.focusedSlot !== null) {
    handleKill(runs.focusedSlot)
  }
}
</script>

<template>
  <div class="run-area" :class="gridClass">
    <!-- Expanded View -->
    <template v-if="runs.focusedSlot !== null && focusedRun">
      <RunPanelExpanded
        :run="focusedRun"
        @collapse="handleCollapse"
        @restart="handleRestart(runs.focusedSlot!)"
        @dismiss="handleDismissExpanded"
        @kill="handleKillExpanded"
      />
    </template>

    <!-- Loadout Editor -->
    <template v-else-if="loadoutSlot !== null">
      <LoadoutEditor :slot="loadoutSlot" @start="handleLoadoutStart" @cancel="handleCloseLoadout" />
    </template>

    <!-- Grid View -->
    <template v-else>
      <template v-for="slot in visibleSlots" :key="slot.index">
        <PanelFrame class="run-slot" :focused="slot.run?.state === 'running'" :no-padding="true">
          <!-- Locked Slot (not yet purchased) -->
          <LockedSlot v-if="!slot.isUnlocked" :slot="slot.index" />

          <!-- Active Run -->
          <RunPanel
            v-else-if="slot.run"
            :run="slot.run"
            @expand="handleExpand(slot.index)"
            @restart="handleRestart(slot.index)"
            @dismiss="handleDismiss(slot.index)"
            @kill="handleKill(slot.index)"
            @configure="handleConfigure(slot.index)"
          />

          <!-- Empty Slot (unlocked, no run) -->
          <EmptySlot
            v-else
            :slot="slot.index"
            @start-run="handleStartRun"
            @open-loadout="handleOpenLoadout"
          />
        </PanelFrame>
      </template>
    </template>
  </div>
</template>

<style scoped>
.run-area {
  display: grid;
  height: 100%;
  padding: var(--space-2);
  gap: var(--space-2);
}

.grid-focused {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.grid-1 {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.grid-2 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr;
}

.grid-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.grid-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

.run-slot {
  overflow: hidden;
}
</style>
