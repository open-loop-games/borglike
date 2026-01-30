<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { races } from '@/game/data/races'
import { classes } from '@/game/data/classes'
import { boosters } from '@/game/data/boosters'
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
// Each slot can have: 3 toggles + 3 sweep + 3 surf + 3 kiting = 12 max
const totalBotUpgrades = computed(() => {
  let count = 0
  for (let i = 0; i < 4; i++) {
    const config = progression.getSlotConfig(i)
    const caps = config?.capabilities
    if (!caps) continue
    if (caps.town) count++
    if (caps.farming) count++
    if (caps.preparedness) count++
    count += (caps.sweep || 0) + (caps.surf || 0) + (caps.kiting || 0)
  }
  return count
})
const maxBotUpgrades = 4 * 12 // 4 slots × 12 upgrades each

// Format bot training upgrades for a slot (2-letter codes)
function formatSlotUpgrades(slotIndex: number): string {
  const config = progression.getSlotConfig(slotIndex)
  const caps = config.capabilities
  const parts: string[] = []

  if (caps.town) parts.push('Tn')
  if (caps.farming) parts.push('Fm')
  if (caps.preparedness) parts.push('Pr')
  if (caps.sweep > 0) parts.push(`Sw${caps.sweep}`)
  if (caps.surf > 0) parts.push(`Sf${caps.surf}`)
  if (caps.kiting > 0) parts.push(`Kt${caps.kiting}`)

  return parts.length > 0 ? parts.join(' ') : '—'
}

// Get slot training summaries for display
const slotTrainingSummaries = computed(() => {
  const unlocked = progression.unlocks.runSlots
  const summaries: { slot: number; label: string; upgrades: string; locked: boolean }[] = []

  for (let i = 0; i < 4; i++) {
    if (i < unlocked) {
      summaries.push({
        slot: i,
        label: `Slot ${i + 1}`,
        upgrades: formatSlotUpgrades(i),
        locked: false,
      })
    } else {
      summaries.push({
        slot: i,
        label: `Slot ${i + 1}`,
        upgrades: 'Locked',
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
              <span class="summary-value"
                >{{ totalBotUpgrades }} / {{ maxBotUpgrades }}</span
              >
            </div>
          </PanelFrame>
        </section>

        <section class="section">
          <h2>Bot Training</h2>
          <PanelFrame class="training-summary">
            <div
              v-for="slot in slotTrainingSummaries"
              :key="slot.slot"
              class="training-row"
              :class="{ locked: slot.locked }"
            >
              <span class="training-label">{{ slot.label }}</span>
              <span class="training-value">{{ slot.upgrades }}</span>
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

.training-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-family: var(--font-mono);
  font-size: 11px;
}

.training-row:not(:last-child) {
  border-bottom: 1px solid var(--border);
}

.training-row.locked {
  opacity: 0.5;
}

.training-label {
  color: var(--text-secondary);
}

.training-value {
  color: var(--cyan);
  text-align: right;
  letter-spacing: 1px;
}

.training-row.locked .training-value {
  color: var(--text-dim);
}
</style>
