<script setup lang="ts">
import { computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import {
  BOT_UPGRADES,
  canPurchaseBotUpgrade,
  type BotUpgradeId,
  type ToggleUpgradeId,
} from '@/game/data/bot-upgrades'
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

// ON/OFF upgrades
const toggleUpgrades: { id: ToggleUpgradeId; name: string; desc: string }[] = [
  { id: 'town', name: 'Town Access', desc: 'Visit town for healing and shopping' },
  { id: 'farming', name: 'Resource Farming', desc: 'Farm gold/XP when under-prepared' },
  { id: 'preparedness', name: 'Depth Readiness', desc: 'Check consumables before descent' },
]

// Graded upgrades (levels 1-3)
const gradedUpgrades: { key: 'sweep' | 'surf' | 'kiting'; name: string; desc: string }[] = [
  { key: 'sweep', name: 'Sweep', desc: 'Exploration thoroughness before descent' },
  { key: 'surf', name: 'Surf', desc: 'HP threshold for retreat' },
  { key: 'kiting', name: 'Kiting', desc: 'Ranged combat positioning distance' },
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
  return capabilities.value[id]
}

function isEnabled(id: ToggleUpgradeId): boolean {
  return capabilities.value[id] && toggles.value[id]
}

function getGradedLevel(key: 'sweep' | 'surf' | 'kiting'): number {
  return capabilities.value[key]
}

function getNextGradedId(key: 'sweep' | 'surf' | 'kiting'): BotUpgradeId | null {
  const currentLevel = getGradedLevel(key)
  if (currentLevel >= 3) return null
  return `${key}_${currentLevel + 1}` as BotUpgradeId
}

function isKitingLocked(): boolean {
  // Kiting requires sweep_1 to be purchased
  return capabilities.value.sweep < 1
}
</script>

<template>
  <PanelFrame class="bot-training-panel">
    <header class="panel-header">
      <h3>Bot Training</h3>
      <span class="essence-display">{{ essence.toLocaleString() }} Essence</span>
    </header>

    <!-- ON/OFF Capabilities -->
    <section class="upgrade-section">
      <h4>Capabilities</h4>
      <div class="upgrade-list">
        <div v-for="up in toggleUpgrades" :key="up.id" class="upgrade-row">
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
      </div>
    </section>

    <!-- Graded Capabilities -->
    <section class="upgrade-section">
      <h4>Training Levels</h4>
      <div class="upgrade-list">
        <div
          v-for="up in gradedUpgrades"
          :key="up.key"
          class="upgrade-row graded"
          :class="{ locked: up.key === 'kiting' && isKitingLocked() }"
        >
          <div class="upgrade-info">
            <span class="upgrade-name">
              {{ up.name }}
              <span
                v-if="up.key === 'kiting' && isKitingLocked()"
                class="lock-icon"
                title="Requires Sweep I"
              >
                (locked)
              </span>
            </span>
            <span class="upgrade-desc">{{ up.desc }}</span>
          </div>
          <div class="upgrade-level">
            <!-- Level bar (3 segments) -->
            <div class="level-bar">
              <span
                v-for="n in 3"
                :key="n"
                class="level-segment"
                :class="{ filled: n <= getGradedLevel(up.key) }"
              ></span>
            </div>
            <span class="level-label">L{{ getGradedLevel(up.key) }}</span>
          </div>
          <div class="upgrade-actions">
            <template v-if="getGradedLevel(up.key) >= 3">
              <span class="max-label">MAX</span>
            </template>
            <template v-else-if="up.key === 'kiting' && isKitingLocked()">
              <span class="locked-label">Locked</span>
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
    </section>
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

.upgrade-section h4 {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.upgrade-row.locked {
  opacity: 0.5;
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

.lock-icon {
  font-size: 10px;
  font-weight: normal;
  color: var(--amber);
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
  width: 16px;
  height: 8px;
  background: var(--border);
  border-radius: 2px;
}

.level-segment.filled {
  background: var(--cyan);
  box-shadow: 0 0 6px rgba(6, 182, 212, 0.4);
}

.level-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-dim);
  min-width: 20px;
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

.locked-label {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--amber);
}
</style>
