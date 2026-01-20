<script setup lang="ts">
import { computed } from 'vue'
import type { MonsterTemplate } from '@/game/data/monsters'
import type { BestiaryEntry } from '@/types/progression'

interface Props {
  monster: MonsterTemplate
  entry?: BestiaryEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// Get unlock tier based on kill count
function getUnlockTier(kills: number): number {
  if (kills >= 30) return 4
  if (kills >= 15) return 3
  if (kills >= 5) return 2
  if (kills >= 1) return 1
  return 0
}

const kills = computed(() => props.entry?.kills ?? 0)
const tier = computed(() => getUnlockTier(kills.value))
const isLocked = computed(() => tier.value === 0)

// Format first kill time
const firstKillDate = computed(() => {
  if (!props.entry?.firstKillTime) return null
  return new Date(props.entry.firstKillTime).toLocaleDateString()
})

// Color mapping
const monsterColor = computed(() => {
  const colorMap: Record<string, string> = {
    white: '#ffffff',
    red: '#ef4444',
    green: '#22c55e',
    blue: '#3b82f6',
    yellow: '#eab308',
    orange: '#f97316',
    purple: '#8b5cf6',
    violet: '#a78bfa',
    umber: '#92400e',
    lightUmber: '#d97706',
    slate: '#64748b',
    lightDark: '#374151',
    lightRed: '#f87171',
    lightGreen: '#4ade80',
    lightBlue: '#60a5fa',
    lightPurple: '#c084fc',
    lightSlate: '#94a3b8',
    black: '#1f2937',
  }
  return colorMap[props.monster.color] ?? '#ffffff'
})

// Next unlock info
const nextUnlock = computed(() => {
  const k = kills.value
  if (k >= 30) return null
  if (k >= 15) return { kills: 30, desc: 'Speed, XP & depth info' }
  if (k >= 5) return { kills: 15, desc: 'Abilities & flags' }
  if (k >= 1) return { kills: 5, desc: 'HP, Damage & Armor' }
  return { kills: 1, desc: 'Name & symbol' }
})
</script>

<template>
  <div class="monster-detail">
    <header class="detail-header">
      <button class="back-btn" @click="emit('close')">&larr; Back</button>
    </header>

    <div class="detail-content">
      <!-- Symbol and name -->
      <div class="monster-identity">
        <div class="monster-symbol" :style="{ color: isLocked ? '#4b5563' : monsterColor }">
          {{ isLocked ? '?' : monster.char }}
        </div>
        <h2 class="monster-name">{{ isLocked ? 'Unknown Monster' : monster.name }}</h2>
      </div>

      <!-- Kill count -->
      <div class="kill-section">
        <div class="kill-count">
          <span class="count">{{ kills }}</span>
          <span class="label">Total Kills</span>
        </div>
        <div v-if="firstKillDate" class="first-kill">
          First killed: {{ firstKillDate }}
        </div>
      </div>

      <!-- Stats (tier 2+) -->
      <div v-if="tier >= 2" class="stats-section">
        <h3>Combat Stats</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{{ monster.hp }}</span>
            <span class="stat-label">HP</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ monster.damage }}</span>
            <span class="stat-label">Damage</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ monster.armor }}</span>
            <span class="stat-label">Armor</span>
          </div>
        </div>
      </div>

      <!-- Abilities and flags (tier 3+) -->
      <div v-if="tier >= 3" class="abilities-section">
        <h3>Abilities</h3>
        <div v-if="monster.abilities.length > 0" class="ability-list">
          <span v-for="ability in monster.abilities" :key="ability" class="ability-tag">
            {{ ability }}
          </span>
        </div>
        <div v-else class="no-abilities">None</div>

        <h3>Type</h3>
        <div v-if="monster.flags.length > 0" class="flag-list">
          <span v-for="flag in monster.flags" :key="flag" class="flag-tag">
            {{ flag }}
          </span>
        </div>
        <div v-else class="no-flags">Normal</div>
      </div>

      <!-- Full info (tier 4) -->
      <div v-if="tier >= 4" class="full-info-section">
        <h3>Details</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Speed</span>
            <span class="info-value">{{ monster.speed }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Experience</span>
            <span class="info-value">{{ monster.experience }} XP</span>
          </div>
          <div class="info-item">
            <span class="info-label">Depth</span>
            <span class="info-value">D:{{ monster.minDepth }}+</span>
          </div>
        </div>
      </div>

      <!-- Locked info -->
      <div v-if="tier < 4 && nextUnlock" class="unlock-hint">
        <div class="hint-header">Next unlock at {{ nextUnlock.kills }} kills:</div>
        <div class="hint-desc">{{ nextUnlock.desc }}</div>
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: `${(kills / nextUnlock.kills) * 100}%` }"
          ></div>
        </div>
        <div class="progress-text">{{ kills }} / {{ nextUnlock.kills }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monster-detail {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.detail-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--void);
}

.back-btn {
  padding: 6px 12px;
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.detail-content {
  padding: 20px;
}

.monster-identity {
  text-align: center;
  margin-bottom: 20px;
}

.monster-symbol {
  font-family: var(--font-mono);
  font-size: 64px;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 0 16px currentColor;
  margin-bottom: 12px;
}

.monster-name {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.kill-section {
  text-align: center;
  padding: 16px;
  background: var(--highlight);
  border-radius: 6px;
  margin-bottom: 20px;
}

.kill-count {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}

.kill-count .count {
  font-size: 32px;
  font-weight: bold;
  color: var(--purple);
}

.kill-count .label {
  font-size: 14px;
  color: var(--text-secondary);
}

.first-kill {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-dim);
}

.stats-section,
.abilities-section,
.full-info-section {
  margin-bottom: 20px;
}

.stats-section h3,
.abilities-section h3,
.full-info-section h3 {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.stat-item {
  text-align: center;
  padding: 12px;
  background: var(--highlight);
  border-radius: 4px;
}

.stat-value {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.ability-list,
.flag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.ability-tag {
  padding: 4px 10px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: var(--red);
}

.flag-tag {
  padding: 4px 10px;
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  font-size: 11px;
  color: var(--purple);
}

.no-abilities,
.no-flags {
  font-size: 12px;
  color: var(--text-dim);
  font-style: italic;
  margin-bottom: 16px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.info-item {
  text-align: center;
  padding: 8px;
  background: var(--highlight);
  border-radius: 4px;
}

.info-label {
  display: block;
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.unlock-hint {
  padding: 16px;
  background: var(--void);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-align: center;
}

.hint-header {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.hint-desc {
  font-size: 14px;
  color: var(--purple);
  margin-bottom: 12px;
}

.progress-bar {
  height: 6px;
  background: var(--highlight);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--purple);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
