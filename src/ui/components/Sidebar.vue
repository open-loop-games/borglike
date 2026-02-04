<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { races } from '@game/data/races'
import { classes } from '@game/data/classes'
import { boosters } from '@game/data/boosters'
import PanelFrame from './common/PanelFrame.vue'
import UpgradeList from './meta/UpgradeList.vue'
import UnlockList from './meta/UnlockList.vue'

const progression = useProgressionStore()

type Tab = 'stats' | 'upgrades' | 'unlocks'
const activeTab = ref<Tab>('stats')

// Totals for unlock display
const totalRaces = races.length
const totalClasses = classes.length
const totalBoosters = boosters.length

// Show victories instead of max depth after first win
const hasVictories = computed(() => progression.totalVictories > 0)

// Count total bot upgrades across all slots
// Each slot can have: 1 toggle + 3 tactics + 3 town + 3 preparedness + 3 sweep + 3 surf + 3 kiting + 3 targeting + 3 retreat = 25 max
const totalBotUpgrades = computed(() => {
  let count = 0
  for (let i = 0; i < 4; i++) {
    const config = progression.getSlotConfig(i)
    const caps = config?.capabilities
    if (!caps) continue
    // Toggle capabilities (1 total)
    if (caps.farming) count++
    // Graded capabilities (levels 1-3 each)
    count += (caps.tactics || 0) + (caps.town || 0) + (caps.preparedness || 0)
    count += (caps.sweep || 0) + (caps.surf || 0)
    count += (caps.kiting || 0) + (caps.targeting || 0) + (caps.retreat || 0)
  }
  return count
})
const maxBotUpgrades = 4 * 25 // 4 slots × 25 upgrades each

// Format bot training as 2 lines (by group) with 4-letter codes
// Line 1: Town + Combat (Town, Targ, Retr, Kite, Tact)
// Line 2: Progression (Farm, Prep, SwpF, SrfF)
function formatTrainingLines(slotIndex: number): { line1: string; line2: string } {
  const config = progression.getSlotConfig(slotIndex)
  const caps = config.capabilities

  // Line 1: Town + Combat
  const line1Parts: string[] = []
  if (caps.town > 0) line1Parts.push(`Town${caps.town}`)
  if (caps.targeting > 0) line1Parts.push(`Targ${caps.targeting}`)
  if (caps.retreat > 0) line1Parts.push(`Retr${caps.retreat}`)
  if (caps.kiting > 0) line1Parts.push(`Kite${caps.kiting}`)
  if (caps.tactics > 0) line1Parts.push(`Tact${caps.tactics}`)

  // Line 2: Progression
  const line2Parts: string[] = []
  if (caps.farming) line2Parts.push('Farm')
  if (caps.preparedness > 0) line2Parts.push(`Prep${caps.preparedness}`)
  if (caps.sweep > 0) line2Parts.push(`SwpF${caps.sweep}`)
  if (caps.surf > 0) line2Parts.push(`SrfF${caps.surf}`)

  return {
    line1: line1Parts.length > 0 ? line1Parts.join(' ') : '—',
    line2: line2Parts.length > 0 ? line2Parts.join(' ') : '—',
  }
}

// Get slot training summaries for display (2 lines per slot)
const slotTrainingSummaries = computed(() => {
  const unlocked = progression.unlocks.runSlots
  const summaries: {
    slot: number
    label: string
    line1: string
    line2: string
    locked: boolean
  }[] = []

  for (let i = 0; i < 4; i++) {
    if (i < unlocked) {
      const lines = formatTrainingLines(i)
      summaries.push({
        slot: i,
        label: `Slot ${i + 1}`,
        line1: lines.line1,
        line2: lines.line2,
        locked: false,
      })
    } else {
      summaries.push({
        slot: i,
        label: `Slot ${i + 1}`,
        line1: 'Locked',
        line2: '',
        locked: true,
      })
    }
  }

  return summaries
})
</script>

<template>
  <div class="sidebar-container">
    <div class="sidebar-tabs">
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'stats' }"
        @click="activeTab = 'stats'"
      >
        Stats
      </button>
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'upgrades' }"
        @click="activeTab = 'upgrades'"
      >
        Upgrades
      </button>
      <button
        class="sidebar-tab"
        :class="{ active: activeTab === 'unlocks' }"
        @click="activeTab = 'unlocks'"
      >
        Unlocks
      </button>
    </div>

    <div class="sidebar-content">
      <!-- Stats Tab -->
      <div v-if="activeTab === 'stats'" class="tab-content">
        <section class="section">
          <h2>Global Statistics</h2>
          <div class="stat-grid">
            <PanelFrame class="stat">
              <span class="stat-label">Total Runs</span>
              <span class="stat-value">{{ progression.globalStats.totalRuns }}</span>
            </PanelFrame>
            <!-- Show victories after first win, otherwise max depth -->
            <PanelFrame v-if="hasVictories" class="stat">
              <span class="stat-label">Victories</span>
              <span class="stat-value victory">{{ progression.totalVictories }}</span>
            </PanelFrame>
            <PanelFrame v-else class="stat">
              <span class="stat-label">Max Depth</span>
              <span class="stat-value depth">{{ progression.globalStats.maxDepthEver }}</span>
            </PanelFrame>
            <PanelFrame class="stat">
              <span class="stat-label">Total Kills</span>
              <span class="stat-value kills">{{
                progression.globalStats.totalKills.toLocaleString()
              }}</span>
            </PanelFrame>
            <PanelFrame class="stat">
              <span class="stat-label">Total Gold</span>
              <span class="stat-value gold">{{
                progression.globalStats.totalGold.toLocaleString()
              }}</span>
            </PanelFrame>
            <PanelFrame class="stat">
              <span class="stat-label">Floors Traveled</span>
              <span class="stat-value depth">{{
                (progression.globalStats.totalFloorsVisited ?? 0).toLocaleString()
              }}</span>
            </PanelFrame>
            <PanelFrame class="stat">
              <span class="stat-label">Essence Earned</span>
              <span class="stat-value essence">{{
                progression.globalStats.totalEssence.toLocaleString()
              }}</span>
            </PanelFrame>
          </div>
        </section>

        <section class="section">
          <h2>Current Unlocks</h2>
          <PanelFrame class="unlock-summary">
            <div class="summary-row">
              <span class="summary-label">Run Slots</span>
              <span class="summary-value">{{ progression.unlocks.runSlots }} / 4</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Races</span>
              <span class="summary-value"
                >{{ progression.availableRaces.length }} / {{ totalRaces }}</span
              >
            </div>
            <div class="summary-row">
              <span class="summary-label">Classes</span>
              <span class="summary-value"
                >{{ progression.availableClasses.length }} / {{ totalClasses }}</span
              >
            </div>
            <div class="summary-row">
              <span class="summary-label">Boosters</span>
              <span class="summary-value"
                >{{ progression.unlocks.boosters.size }} / {{ totalBoosters }}</span
              >
            </div>
            <div class="summary-row">
              <span class="summary-label">Bot Upgrades</span>
              <span class="summary-value">{{ totalBotUpgrades }} / {{ maxBotUpgrades }}</span>
            </div>
          </PanelFrame>
        </section>

        <section class="section">
          <h2>Bot Training</h2>
          <PanelFrame class="training-summary">
            <div
              v-for="slot in slotTrainingSummaries"
              :key="slot.slot"
              class="training-slot"
              :class="{ locked: slot.locked }"
            >
              <span class="training-label">{{ slot.label }}</span>
              <div class="training-lines">
                <span class="training-line">{{ slot.line1 }}</span>
                <span v-if="slot.line2" class="training-line">{{ slot.line2 }}</span>
              </div>
            </div>
          </PanelFrame>
        </section>
      </div>

      <!-- Upgrades Tab -->
      <div v-else-if="activeTab === 'upgrades'" class="tab-content full-height">
        <UpgradeList />
      </div>

      <!-- Unlocks Tab -->
      <div v-else-if="activeTab === 'unlocks'" class="tab-content full-height">
        <UnlockList />
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-tabs {
  display: flex;
  background: var(--elevated);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.sidebar-tab {
  flex: 1;
  padding: 10px 8px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.sidebar-tab:hover {
  background: var(--highlight);
  color: var(--text-primary);
}

.sidebar-tab.active {
  color: var(--purple);
  border-bottom-color: var(--purple);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
}

.tab-content {
  height: 100%;
  overflow-y: auto;
}

.tab-content.full-height {
  display: flex;
  flex-direction: column;
}

.tab-content:not(.full-height) {
  padding: 16px;
}

.section {
  margin-bottom: 20px;
}

.section h2 {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin: 0 0 10px;
  letter-spacing: 1px;
  font-family: var(--font-mono);
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.stat {
  padding: 10px !important;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 9px;
  color: var(--text-dim);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-value {
  display: block;
  font-size: 16px;
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.stat-value.depth {
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}

.stat-value.kills {
  color: var(--red);
  text-shadow: 0 0 6px rgba(239, 68, 68, 0.4);
}

.stat-value.gold {
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.stat-value.essence {
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}

.stat-value.victory {
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.unlock-summary {
  padding: 12px !important;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-family: var(--font-mono);
  font-size: 12px;
}

.summary-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.summary-label {
  color: var(--text-secondary);
}

.summary-value {
  color: var(--cyan);
}

.training-summary {
  padding: 12px !important;
}

.training-slot {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  font-family: var(--font-mono);
  font-size: 10px;
}

.training-slot:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.training-slot.locked {
  opacity: 0.5;
}

.training-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  width: 40px;
}

.training-lines {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.training-line {
  color: var(--cyan);
  letter-spacing: 0.5px;
}

.training-slot.locked .training-line {
  color: var(--text-dim);
}
</style>
