<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import {
  BOT_UPGRADES,
  canPurchaseBotUpgrade,
  getToggleCapabilityField,
  type BotUpgradeId,
  type ToggleUpgradeId,
} from '@game/data/bot-upgrades'
import type { BotCapabilities, BotToggles } from '@/types/progression'
import PanelFrame from '../common/PanelFrame.vue'

const props = defineProps<{
  slot: number
}>()

const progression = useProgressionStore()

// Current essence (from currency store)
const essence = computed(() => progression.currency.essence)

// Get capabilities and toggles for this slot
const capabilities = computed<BotCapabilities>(() => {
  return progression.getSlotConfig(props.slot).capabilities
})

const toggles = computed<BotToggles>(() => {
  return progression.getSlotConfig(props.slot).toggles
})

// Graded upgrades (levels 1-3) with segment labels
interface GradedUpgrade {
  key: 'town' | 'targeting' | 'retreat' | 'preparedness' | 'sweep' | 'surf' | 'kiting'
  name: string
  desc: string
  segments: string[] // Labels for L1, L2, L3
  selectable: boolean // Can user select active level?
}

// Toggle upgrades
interface ToggleUpgrade {
  id: ToggleUpgradeId
  name: string
  desc: string
}

// === TOWN GROUP ===
const townUpgrades: GradedUpgrade[] = [
  {
    key: 'town',
    name: 'Town',
    desc: 'Town services access',
    segments: ['Portal', 'Healer', 'Commerce'],
    selectable: false,
  },
]

// === COMBAT GROUP ===
const combatGraded: GradedUpgrade[] = [
  {
    key: 'targeting',
    name: 'Targeting',
    desc: 'Target selection intelligence',
    segments: ['Wounded', 'Threat', 'Class'],
    selectable: false,
  },
  {
    key: 'retreat',
    name: 'Retreat',
    desc: 'Flee/consumable intelligence',
    segments: ['HP%', 'Status', 'Combat'],
    selectable: false,
  },
  {
    key: 'kiting',
    name: 'Kiting',
    desc: 'Ranged positioning',
    segments: ['2', '3', '4'],
    selectable: false,
  },
]

const combatToggles: ToggleUpgrade[] = [
  { id: 'tactics', name: 'Tactics', desc: 'Use buffs and pre-combat preparation' },
]

// === PROGRESSION GROUP ===
const progressionGraded: GradedUpgrade[] = [
  {
    key: 'preparedness',
    name: 'Preparedness',
    desc: 'Depth readiness checks',
    segments: ['Counts', 'Tiers', 'Full'],
    selectable: false,
  },
  {
    key: 'sweep',
    name: 'Sweep Farming',
    desc: 'Explore before descent',
    segments: ['60%', '75%', '90%'],
    selectable: true,
  },
  {
    key: 'surf',
    name: 'Surf Farming',
    desc: 'Stair farming radius',
    segments: ['5×5', '9×9', '21×21'],
    selectable: true,
  },
]

const progressionToggles: ToggleUpgrade[] = [
  { id: 'farming', name: 'Farming', desc: 'Farm gold/XP when under-prepared' },
]

function getUpgradeInfo(id: BotUpgradeId) {
  return BOT_UPGRADES[id]
}

function canPurchase(id: BotUpgradeId): boolean {
  return canPurchaseBotUpgrade(id, capabilities.value, essence.value)
}

function purchase(id: BotUpgradeId) {
  progression.purchaseBotUpgrade(props.slot, id)
}

function toggle(id: ToggleUpgradeId) {
  progression.toggleBotCapability(props.slot, id)
}

function isUnlocked(id: ToggleUpgradeId): boolean {
  const field = getToggleCapabilityField(id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (capabilities.value as any)[field] as boolean
}

function isEnabled(id: ToggleUpgradeId): boolean {
  const field = getToggleCapabilityField(id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (capabilities.value as any)[field] && (toggles.value as any)[field]
}

type GradedKey = 'town' | 'targeting' | 'retreat' | 'preparedness' | 'sweep' | 'surf' | 'kiting'

function getGradedLevel(key: GradedKey): number {
  return capabilities.value[key]
}

function getActiveLevel(key: GradedKey): number {
  const config = progression.getSlotConfig(props.slot)
  if (key === 'sweep') return config.activeSweepLevel ?? config.capabilities.sweep
  if (key === 'surf') return config.activeSurfLevel ?? config.capabilities.surf
  // targeting, retreat, kiting always use max purchased level
  return config.capabilities[key]
}

function setActiveLevel(key: 'sweep' | 'surf', level: number) {
  progression.setActiveGradedLevel(props.slot, key, level)
}

function getNextGradedId(key: GradedKey): BotUpgradeId | null {
  const currentLevel = getGradedLevel(key)
  if (currentLevel >= 3) return null
  return `${key}_${currentLevel + 1}` as BotUpgradeId
}

function getSegmentState(
  key: GradedKey,
  segmentLevel: number
): 'selected' | 'available' | 'locked' {
  const unlocked = getGradedLevel(key)
  const active = getActiveLevel(key)

  if (segmentLevel > unlocked) return 'locked'
  if (segmentLevel === active) return 'selected'
  return 'available'
}

function onSegmentClick(up: GradedUpgrade, segmentLevel: number) {
  if (!up.selectable) return
  // Only sweep and surf are selectable
  if (up.key !== 'sweep' && up.key !== 'surf') return
  const unlocked = getGradedLevel(up.key)
  if (segmentLevel > unlocked) return // Can't select locked segments
  setActiveLevel(up.key, segmentLevel)
}
</script>

<template>
  <PanelFrame class="bot-training-panel">
    <header class="panel-header">
      <h3>Bot Training</h3>
      <span class="essence-display">{{ essence.toLocaleString() }} Essence</span>
    </header>

    <div class="upgrade-list">
      <!-- TOWN GROUP -->
      <div v-for="up in townUpgrades" :key="up.key" class="upgrade-row graded">
        <div class="upgrade-info">
          <span class="upgrade-name">{{ up.name }}</span>
          <span class="upgrade-desc">{{ up.desc }}</span>
        </div>
        <div class="upgrade-level">
          <div class="level-bar">
            <button
              v-for="n in 3"
              :key="n"
              class="level-segment"
              :class="[
                getSegmentState(up.key, n),
                { selectable: up.selectable && n <= getGradedLevel(up.key) },
              ]"
              :disabled="n > getGradedLevel(up.key) || !up.selectable"
              :title="up.selectable && n <= getGradedLevel(up.key) ? 'Click to select' : ''"
              @click="onSegmentClick(up, n)"
            >
              {{ up.segments[n - 1] }}
            </button>
          </div>
        </div>
        <div class="upgrade-actions">
          <template v-if="getGradedLevel(up.key) >= 3">
            <span class="max-label">MAX</span>
          </template>
          <template v-else>
            <button
              class="buy-btn"
              :disabled="!canPurchase(getNextGradedId(up.key)!)"
              @click="purchase(getNextGradedId(up.key)!)"
            >
              {{ getUpgradeInfo(getNextGradedId(up.key)!)?.cost ?? 0 }}
            </button>
          </template>
        </div>
      </div>

      <!-- SPACER -->
      <div class="group-spacer"></div>

      <!-- COMBAT GROUP (graded) -->
      <div v-for="up in combatGraded" :key="up.key" class="upgrade-row graded">
        <div class="upgrade-info">
          <span class="upgrade-name">{{ up.name }}</span>
          <span class="upgrade-desc">{{ up.desc }}</span>
        </div>
        <div class="upgrade-level">
          <div class="level-bar">
            <button
              v-for="n in 3"
              :key="n"
              class="level-segment"
              :class="[
                getSegmentState(up.key, n),
                { selectable: up.selectable && n <= getGradedLevel(up.key) },
              ]"
              :disabled="n > getGradedLevel(up.key) || !up.selectable"
              :title="up.selectable && n <= getGradedLevel(up.key) ? 'Click to select' : ''"
              @click="onSegmentClick(up, n)"
            >
              {{ up.segments[n - 1] }}
            </button>
          </div>
        </div>
        <div class="upgrade-actions">
          <template v-if="getGradedLevel(up.key) >= 3">
            <span class="max-label">MAX</span>
          </template>
          <template v-else>
            <button
              class="buy-btn"
              :disabled="!canPurchase(getNextGradedId(up.key)!)"
              @click="purchase(getNextGradedId(up.key)!)"
            >
              {{ getUpgradeInfo(getNextGradedId(up.key)!)?.cost ?? 0 }}
            </button>
          </template>
        </div>
      </div>

      <!-- COMBAT GROUP (toggles) -->
      <div v-for="up in combatToggles" :key="up.id" class="upgrade-row">
        <div class="upgrade-info">
          <span class="upgrade-name">{{ up.name }}</span>
          <span class="upgrade-desc">{{ up.desc }}</span>
        </div>
        <div class="upgrade-actions">
          <template v-if="isUnlocked(up.id)">
            <button
              class="toggle-btn"
              :class="{ active: isEnabled(up.id) }"
              @click="toggle(up.id)"
            >
              {{ isEnabled(up.id) ? 'ON' : 'OFF' }}
            </button>
          </template>
          <template v-else>
            <button class="buy-btn" :disabled="!canPurchase(up.id)" @click="purchase(up.id)">
              {{ getUpgradeInfo(up.id)?.cost ?? 0 }}
            </button>
          </template>
        </div>
      </div>

      <!-- SPACER -->
      <div class="group-spacer"></div>

      <!-- PROGRESSION GROUP (toggles first - farming enables the others) -->
      <div v-for="up in progressionToggles" :key="up.id" class="upgrade-row">
        <div class="upgrade-info">
          <span class="upgrade-name">{{ up.name }}</span>
          <span class="upgrade-desc">{{ up.desc }}</span>
        </div>
        <div class="upgrade-actions">
          <template v-if="isUnlocked(up.id)">
            <button
              class="toggle-btn"
              :class="{ active: isEnabled(up.id) }"
              @click="toggle(up.id)"
            >
              {{ isEnabled(up.id) ? 'ON' : 'OFF' }}
            </button>
          </template>
          <template v-else>
            <button class="buy-btn" :disabled="!canPurchase(up.id)" @click="purchase(up.id)">
              {{ getUpgradeInfo(up.id)?.cost ?? 0 }}
            </button>
          </template>
        </div>
      </div>

      <!-- PROGRESSION GROUP (graded) -->
      <div v-for="up in progressionGraded" :key="up.key" class="upgrade-row graded">
        <div class="upgrade-info">
          <span class="upgrade-name">{{ up.name }}</span>
          <span class="upgrade-desc">{{ up.desc }}</span>
        </div>
        <div class="upgrade-level">
          <div class="level-bar">
            <button
              v-for="n in 3"
              :key="n"
              class="level-segment"
              :class="[
                getSegmentState(up.key, n),
                { selectable: up.selectable && n <= getGradedLevel(up.key) },
              ]"
              :disabled="n > getGradedLevel(up.key) || !up.selectable"
              :title="up.selectable && n <= getGradedLevel(up.key) ? 'Click to select' : ''"
              @click="onSegmentClick(up, n)"
            >
              {{ up.segments[n - 1] }}
            </button>
          </div>
        </div>
        <div class="upgrade-actions">
          <template v-if="getGradedLevel(up.key) >= 3">
            <span class="max-label">MAX</span>
          </template>
          <template v-else>
            <button
              class="buy-btn"
              :disabled="!canPurchase(getNextGradedId(up.key)!)"
              @click="purchase(getNextGradedId(up.key)!)"
            >
              {{ getUpgradeInfo(getNextGradedId(up.key)!)?.cost ?? 0 }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </PanelFrame>
</template>

<style scoped>
.bot-training-panel {
  padding: 16px !important;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
}

.essence-display {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--purple);
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-spacer {
  height: 1px;
  background: var(--border);
  margin: 4px 0;
}

.upgrade-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.upgrade-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.upgrade-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
}

.upgrade-desc {
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upgrade-level {
  display: flex;
  align-items: center;
  gap: 8px;
}

.level-bar {
  display: flex;
  gap: 3px;
}

.level-segment {
  min-width: 32px;
  height: 20px;
  padding: 2px 4px;
  background: var(--border);
  border: 1px solid transparent;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: bold;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

/* Locked: greyed out, not purchased */
.level-segment.locked {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Available: purchased but not selected */
.level-segment.available {
  background: var(--highlight);
  color: var(--text-secondary);
  border-color: var(--border);
}

/* Selected: currently active */
.level-segment.selected {
  background: rgba(6, 182, 212, 0.2);
  border-color: var(--cyan);
  color: var(--cyan);
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.4);
}

/* Selectable: show pointer cursor */
.level-segment.selectable:not(.locked) {
  cursor: pointer;
}

.level-segment.selectable.available:hover {
  border-color: var(--text-secondary);
  background: var(--border);
}

.upgrade-actions {
  display: flex;
  align-items: center;
  min-width: 60px;
  justify-content: flex-end;
}

.toggle-btn {
  padding: 4px 12px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: bold;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: var(--green);
  color: var(--green);
}

.toggle-btn:hover {
  border-color: var(--text-secondary);
}

.buy-btn {
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid var(--purple);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: bold;
  color: var(--purple);
  cursor: pointer;
  transition: all 0.2s;
}

.buy-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.3);
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
}

.buy-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.max-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: bold;
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}
</style>
