<script setup lang="ts">
import { ref, computed } from 'vue'
import type { StatModifiers, RaceAbility } from '@/game/data/races'

const props = defineProps<{
  id: string
  name: string
  description: string
  isUnlocked: boolean
  cost: number
  canAfford: boolean
  unlockCondition?: string
  prestige?: boolean
  type: 'race' | 'class'
  // Extended data for tooltips
  stats?: StatModifiers
  hitdie?: number
  // Race-specific
  infravision?: number
  expPenalty?: number
  abilities?: RaceAbility[]
  // Class-specific
  maxAttacks?: number
  primaryStat?: string
  usesMagic?: boolean
  botBehavior?: string
}>()

const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })

function formatStat(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatStatClass(value: number): string {
  if (value > 0) return 'stat-positive'
  if (value < 0) return 'stat-negative'
  return 'stat-neutral'
}

const hasExtendedData = computed(() => props.stats !== undefined)

function handleMouseEnter(event: MouseEvent) {
  if (!hasExtendedData.value) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  tooltipPosition.value = {
    x: rect.right + 8,
    y: rect.top,
  }
  showTooltip.value = true
}

function handleMouseLeave() {
  showTooltip.value = false
}

const emit = defineEmits<{
  unlock: [id: string, type: 'race' | 'class']
}>()

function handleUnlock() {
  if (!props.isUnlocked && props.canAfford) {
    emit('unlock', props.name, props.type)
  }
}
</script>

<template>
  <div
    class="unlock-item"
    :class="{
      'is-unlocked': isUnlocked,
      'can-afford': canAfford && !isUnlocked,
      'cannot-afford': !canAfford && !isUnlocked,
      'is-prestige': prestige,
    }"
    @click="handleUnlock"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div class="unlock-badge">
      <span v-if="isUnlocked" class="badge-icon unlocked">&#x2713;</span>
      <span v-else-if="prestige" class="badge-icon prestige">&#x2605;</span>
      <span v-else class="badge-icon locked">&#x25CF;</span>
    </div>

    <div class="unlock-info">
      <div class="unlock-header">
        <span class="unlock-name">{{ name }}</span>
        <span v-if="prestige" class="prestige-tag">Prestige</span>
      </div>
      <div class="unlock-desc">{{ description }}</div>
    </div>

    <div class="unlock-status">
      <span v-if="isUnlocked" class="status-unlocked">&#x2713;</span>
      <template v-else>
        <button class="unlock-btn" :disabled="!canAfford">
          <span class="cost-icon">&#x25C6;</span>
          <span>{{ cost.toLocaleString() }}</span>
        </button>
      </template>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <div
        v-if="showTooltip && hasExtendedData"
        class="unlock-tooltip"
        :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
      >
        <div class="tooltip-header">
          <span class="tooltip-name">{{ name }}</span>
          <span v-if="prestige" class="tooltip-prestige">Prestige</span>
        </div>

        <!-- Stats -->
        <div v-if="stats" class="tooltip-stats">
          <span :class="formatStatClass(stats.str)">STR {{ formatStat(stats.str) }}</span>
          <span :class="formatStatClass(stats.int)">INT {{ formatStat(stats.int) }}</span>
          <span :class="formatStatClass(stats.wis)">WIS {{ formatStat(stats.wis) }}</span>
          <span :class="formatStatClass(stats.dex)">DEX {{ formatStat(stats.dex) }}</span>
          <span :class="formatStatClass(stats.con)">CON {{ formatStat(stats.con) }}</span>
        </div>

        <!-- Race-specific info -->
        <template v-if="type === 'race'">
          <div class="tooltip-row">
            <span class="tooltip-label">Hit Die:</span>
            <span class="tooltip-value">+{{ hitdie }}</span>
          </div>
          <div v-if="infravision && infravision > 0" class="tooltip-row">
            <span class="tooltip-label">Infravision:</span>
            <span class="tooltip-value">{{ infravision * 10 }}ft</span>
          </div>
          <div v-if="expPenalty && expPenalty !== 100" class="tooltip-row">
            <span class="tooltip-label">XP Cost:</span>
            <span class="tooltip-value xp-penalty">{{ expPenalty }}%</span>
          </div>
        </template>

        <!-- Class-specific info -->
        <template v-if="type === 'class'">
          <div class="tooltip-row">
            <span class="tooltip-label">Hit Die:</span>
            <span class="tooltip-value">{{ hitdie !== undefined && hitdie >= 0 ? '+' : '' }}{{ hitdie }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Max Attacks:</span>
            <span class="tooltip-value">{{ maxAttacks }}/round</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Primary:</span>
            <span class="tooltip-value primary-stat">{{ primaryStat?.toUpperCase() }}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Magic:</span>
            <span class="tooltip-value">{{ usesMagic ? 'Yes' : 'No' }}</span>
          </div>
        </template>

        <!-- Abilities (Race) -->
        <div v-if="abilities && abilities.length > 0" class="tooltip-abilities">
          <div class="abilities-header">Abilities</div>
          <div v-for="ability in abilities" :key="ability.id" class="ability-item">
            <span class="ability-name">{{ ability.name }}</span>
            <span class="ability-desc">{{ ability.description }}</span>
          </div>
        </div>

        <!-- Bot Behavior (Class) -->
        <div v-if="botBehavior" class="tooltip-behavior">
          <div class="behavior-header">Bot AI</div>
          <div class="behavior-text">{{ botBehavior }}</div>
        </div>

        <!-- Unlock condition -->
        <div v-if="unlockCondition && !isUnlocked" class="tooltip-unlock">
          {{ unlockCondition }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.unlock-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(18, 18, 31, 0.98) 100%);
  border: 1px solid var(--border);
  border-radius: 4px;
  transition: all 0.2s;
}

.unlock-item.can-afford {
  cursor: pointer;
  border-color: var(--cyan);
}

.unlock-item.can-afford:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(26, 26, 46, 0.95) 100%);
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.2);
}

.unlock-item.is-unlocked {
  opacity: 0.6;
}

.unlock-item.cannot-afford {
  opacity: 0.5;
}

.unlock-item.is-prestige {
  border-color: var(--amber);
}

.unlock-item.is-prestige.can-afford:hover {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(26, 26, 46, 0.95) 100%);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
}

.unlock-badge {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.badge-icon {
  font-size: 14px;
}

.badge-icon.unlocked {
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.badge-icon.prestige {
  color: var(--amber);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.6);
}

.badge-icon.locked {
  color: var(--text-dim);
}

.unlock-info {
  flex: 1;
  min-width: 0;
}

.unlock-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.unlock-name {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: bold;
  color: var(--text-primary);
}

.is-unlocked .unlock-name {
  color: var(--text-secondary);
}

.prestige-tag {
  font-size: 8px;
  padding: 1px 4px;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid var(--amber);
  border-radius: 2px;
  color: var(--amber);
  text-transform: uppercase;
}

.unlock-desc {
  font-size: 10px;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.4;
}

.unlock-status {
  flex-shrink: 0;
}

.status-unlocked {
  color: var(--green);
  font-size: 16px;
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.5);
}

.unlock-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-btn:not(:disabled):hover {
  background: var(--cyan);
  border-color: var(--cyan);
  color: white;
}

.is-prestige .unlock-btn:not(:disabled):hover {
  background: var(--amber);
  border-color: var(--amber);
}

.unlock-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.cost-icon {
  color: var(--purple);
  font-size: 9px;
}

.unlock-btn:not(:disabled):hover .cost-icon {
  color: white;
}

/* Tooltip Styles */
.unlock-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 220px;
  max-width: 280px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(15, 15, 26, 0.99) 100%);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.tooltip-name {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.tooltip-prestige {
  font-size: 9px;
  padding: 2px 5px;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid var(--amber);
  border-radius: 2px;
  color: var(--amber);
  text-transform: uppercase;
}

.tooltip-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-bottom: 10px;
  padding: 8px;
  background: var(--highlight);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
}

.stat-positive {
  color: var(--green);
}

.stat-negative {
  color: var(--red);
}

.stat-neutral {
  color: var(--text-dim);
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
  font-size: 11px;
}

.tooltip-label {
  color: var(--text-dim);
}

.tooltip-value {
  font-family: var(--font-mono);
  color: var(--text-primary);
}

.xp-penalty {
  color: var(--amber);
}

.primary-stat {
  color: var(--cyan);
  font-weight: bold;
}

.tooltip-abilities {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.abilities-header {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--purple);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 6px;
}

.ability-item {
  display: flex;
  flex-direction: column;
  margin-bottom: 6px;
}

.ability-item:last-child {
  margin-bottom: 0;
}

.ability-name {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: bold;
  color: var(--cyan);
}

.ability-desc {
  font-size: 9px;
  color: var(--text-secondary);
  margin-top: 1px;
}

.tooltip-behavior {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.behavior-header {
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--purple);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.behavior-text {
  font-size: 10px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.tooltip-unlock {
  margin-top: 10px;
  padding: 6px 8px;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 3px;
  font-size: 9px;
  color: var(--amber);
  font-style: italic;
}
</style>
