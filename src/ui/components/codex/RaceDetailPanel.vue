<script setup lang="ts">
import { computed } from 'vue'
import type { Race } from '@/game/data/races'

interface Props {
  race: Race
  unlocked: boolean
  wins: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// Category badge
const category = computed(() => {
  if (props.race.prestige) return 'Prestige'
  if (props.race.starting) return 'Starter'
  return 'Unlockable'
})

// Color for category
const categoryColor = computed(() => {
  if (props.race.prestige) return '#f59e0b'
  if (props.race.starting) return '#22c55e'
  return '#3b82f6'
})

// Format stat with sign
function formatStat(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `${value}`
  return '0'
}

// Get stat bar width (scale: -4 to +4 maps to 0% to 100%, with 50% being neutral)
function getStatBarWidth(value: number): number {
  // Clamp between -4 and +4, then scale to 0-100
  const clamped = Math.max(-4, Math.min(4, value))
  return ((clamped + 4) / 8) * 100
}

// Get stat bar color based on value
function getStatBarColor(value: number): string {
  if (value > 0) return '#22c55e' // Green for positive
  if (value < 0) return '#ef4444' // Red for negative
  return '#6b7280' // Gray for neutral
}

// All stats for display
const stats = computed(() => [
  { key: 'str', label: 'STR', value: props.race.stats.str },
  { key: 'int', label: 'INT', value: props.race.stats.int },
  { key: 'wis', label: 'WIS', value: props.race.stats.wis },
  { key: 'dex', label: 'DEX', value: props.race.stats.dex },
  { key: 'con', label: 'CON', value: props.race.stats.con },
])
</script>

<template>
  <div class="detail-panel" :class="{ prestige: race.prestige }">
    <header class="panel-header">
      <button class="back-btn" @click="emit('close')">&larr;</button>
      <h3>Race Details</h3>
    </header>

    <div class="panel-content">
      <!-- Race name and category -->
      <div class="race-hero">
        <h2 class="race-name" :style="{ color: categoryColor }">{{ race.name }}</h2>
        <div class="race-category" :style="{ color: categoryColor }">{{ category }} Race</div>
      </div>

      <!-- Lock status -->
      <div v-if="!unlocked" class="locked-section">
        <div class="lock-badge">Locked</div>
        <p class="unlock-condition">{{ race.unlockCondition }}</p>
      </div>

      <!-- Description -->
      <div class="description-section">
        <p class="description-text">"{{ race.description }}"</p>
      </div>

      <!-- Stats section -->
      <div class="stats-section">
        <h4>Stat Modifiers</h4>
        <div class="stat-bars">
          <div v-for="stat in stats" :key="stat.key" class="stat-row">
            <span class="stat-label">{{ stat.label }}</span>
            <div class="stat-bar-container">
              <div class="stat-bar-bg">
                <div class="stat-bar-center"></div>
                <div
                  class="stat-bar-fill"
                  :style="{
                    width: getStatBarWidth(stat.value) + '%',
                    background: getStatBarColor(stat.value),
                  }"
                ></div>
              </div>
            </div>
            <span class="stat-value" :style="{ color: getStatBarColor(stat.value) }">
              {{ formatStat(stat.value) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Race properties -->
      <div class="properties-section">
        <h4>Properties</h4>
        <div class="property-grid">
          <div class="property-row">
            <span class="property-label">Hit Die</span>
            <span class="property-value">{{ race.hitdie }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Infravision</span>
            <span class="property-value">
              {{ race.infravision > 0 ? race.infravision * 10 + "'" : 'None' }}
            </span>
          </div>
          <div class="property-row">
            <span class="property-label">Exp Penalty</span>
            <span class="property-value" :class="{ penalty: race.expPenalty > 100 }">
              {{ race.expPenalty > 100 ? '+' + (race.expPenalty - 100) + '%' : 'None' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Abilities section -->
      <div v-if="race.abilities.length > 0" class="abilities-section">
        <h4>Abilities</h4>
        <div class="ability-list">
          <div v-for="ability in race.abilities" :key="ability.id" class="ability-item">
            <div class="ability-name">{{ ability.name }}</div>
            <div class="ability-description">{{ ability.description }}</div>
          </div>
        </div>
      </div>

      <!-- Stats section (if unlocked with wins) -->
      <div v-if="unlocked" class="history-section">
        <h4>Your History</h4>
        <div class="history-grid">
          <div class="history-row">
            <span class="history-label">Victories</span>
            <span class="history-value wins">{{ wins }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-panel {
  background: var(--panel);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 280px;
  max-width: 320px;
}

.detail-panel.prestige {
  border-left-color: rgba(245, 158, 11, 0.5);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--void);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.back-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--highlight);
  color: var(--text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.race-hero {
  text-align: center;
  margin-bottom: 16px;
}

.race-name {
  margin: 0 0 4px;
  font-size: 20px;
}

.race-category {
  font-size: 12px;
  opacity: 0.8;
}

.locked-section {
  text-align: center;
  margin-bottom: 16px;
  padding: 12px;
  background: var(--highlight);
  border-radius: 6px;
  border: 1px dashed var(--border);
}

.lock-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: bold;
  padding: 4px 12px;
  border-radius: 4px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
  margin-bottom: 8px;
}

.unlock-condition {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.description-section {
  margin-bottom: 16px;
}

.description-text {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.5;
  text-align: center;
}

.stats-section,
.properties-section,
.abilities-section,
.history-section {
  margin-bottom: 16px;
}

h4 {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-label {
  width: 32px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

.stat-bar-container {
  flex: 1;
  height: 12px;
}

.stat-bar-bg {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--void);
  border-radius: 2px;
  overflow: hidden;
}

.stat-bar-center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border);
}

.stat-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.stat-value {
  width: 24px;
  font-size: 11px;
  font-family: var(--font-mono);
  text-align: right;
}

.property-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.property-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: var(--highlight);
  border-radius: 4px;
  font-size: 12px;
}

.property-label {
  color: var(--text-secondary);
}

.property-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.property-value.penalty {
  color: #ef4444;
}

.ability-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ability-item {
  padding: 8px 10px;
  background: var(--highlight);
  border-radius: 4px;
  border-left: 3px solid var(--purple);
}

.ability-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.ability-description {
  font-size: 11px;
  color: var(--text-secondary);
}

.history-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: var(--highlight);
  border-radius: 4px;
  font-size: 12px;
}

.history-label {
  color: var(--text-secondary);
}

.history-value {
  font-family: var(--font-mono);
}

.history-value.wins {
  color: var(--green);
}
</style>
