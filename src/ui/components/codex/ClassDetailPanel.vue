<script setup lang="ts">
import { computed } from 'vue'
import type { GameClass } from '@game/data/classes'

interface Props {
  gameClass: GameClass
  unlocked: boolean
  wins: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// Category badge
const category = computed(() => {
  if (props.gameClass.prestige) return 'Prestige'
  if (props.gameClass.starting) return 'Starter'
  return 'Unlockable'
})

// Color for category
const categoryColor = computed(() => {
  if (props.gameClass.prestige) return '#f59e0b'
  if (props.gameClass.starting) return '#22c55e'
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
  const clamped = Math.max(-4, Math.min(4, value))
  return ((clamped + 4) / 8) * 100
}

// Get stat bar color based on value
function getStatBarColor(value: number): string {
  if (value > 0) return '#22c55e'
  if (value < 0) return '#ef4444'
  return '#6b7280'
}

// All stats for display
const stats = computed(() => [
  { key: 'str', label: 'STR', value: props.gameClass.stats.str },
  { key: 'int', label: 'INT', value: props.gameClass.stats.int },
  { key: 'wis', label: 'WIS', value: props.gameClass.stats.wis },
  { key: 'dex', label: 'DEX', value: props.gameClass.stats.dex },
  { key: 'con', label: 'CON', value: props.gameClass.stats.con },
])

// Primary stat name
const primaryStatName = computed(() => {
  const names: Record<string, string> = {
    str: 'Strength',
    int: 'Intelligence',
    wis: 'Wisdom',
    dex: 'Dexterity',
    con: 'Constitution',
  }
  return names[props.gameClass.primaryStat] ?? props.gameClass.primaryStat
})

// Selected titles to show (first, middle, last)
const displayTitles = computed(() => {
  const titles = props.gameClass.titles
  if (titles.length <= 3) return titles.map((t, i) => ({ level: (i + 1) * 5, title: t }))
  return [
    { level: 5, title: titles[0] },
    { level: 25, title: titles[4] },
    { level: 50, title: titles[9] },
  ]
})

// Special abilities from class flags
const specialAbilities = computed(() => {
  const abilities: { name: string; description: string }[] = []
  if (props.gameClass.canShieldBash) {
    abilities.push({
      name: 'Shield Bash',
      description: 'Can perform shield bash attacks when shield equipped',
    })
  }
  if (props.gameClass.combatLifesteal) {
    abilities.push({
      name: 'Combat Lifesteal',
      description: `Heals ${props.gameClass.combatLifesteal}% of melee damage dealt`,
    })
  }
  return abilities
})
</script>

<template>
  <div class="detail-panel" :class="{ prestige: gameClass.prestige }">
    <header class="panel-header">
      <button class="back-btn" @click="emit('close')">&larr;</button>
      <h3>Class Details</h3>
    </header>

    <div class="panel-content">
      <!-- Class name and category -->
      <div class="class-hero">
        <h2 class="class-name" :style="{ color: categoryColor }">{{ gameClass.name }}</h2>
        <div class="class-category" :style="{ color: categoryColor }">{{ category }} Class</div>
        <div class="class-tags">
          <span v-if="gameClass.usesMagic" class="tag magic">Uses Magic</span>
          <span v-else class="tag melee">No Magic</span>
          <span class="tag primary">{{ primaryStatName }}</span>
        </div>
      </div>

      <!-- Lock status -->
      <div v-if="!unlocked" class="locked-section">
        <div class="lock-badge">Locked</div>
        <p class="unlock-condition">{{ gameClass.unlockCondition }}</p>
      </div>

      <!-- Description -->
      <div class="description-section">
        <p class="description-text">"{{ gameClass.description }}"</p>
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

      <!-- Class properties -->
      <div class="properties-section">
        <h4>Properties</h4>
        <div class="property-grid">
          <div class="property-row">
            <span class="property-label">Hit Die</span>
            <span class="property-value" :class="{ negative: gameClass.hitdie < 0 }">
              {{ gameClass.hitdie >= 0 ? '+' + gameClass.hitdie : gameClass.hitdie }}
            </span>
          </div>
          <div class="property-row">
            <span class="property-label">Max Attacks</span>
            <span class="property-value">{{ gameClass.maxAttacks }}</span>
          </div>
          <div class="property-row">
            <span class="property-label">Primary Stat</span>
            <span class="property-value">{{ primaryStatName }}</span>
          </div>
        </div>
      </div>

      <!-- Special abilities -->
      <div v-if="specialAbilities.length > 0" class="abilities-section">
        <h4>Special Abilities</h4>
        <div class="ability-list">
          <div v-for="ability in specialAbilities" :key="ability.name" class="ability-item">
            <div class="ability-name">{{ ability.name }}</div>
            <div class="ability-description">{{ ability.description }}</div>
          </div>
        </div>
      </div>

      <!-- Titles progression -->
      <div class="titles-section">
        <h4>Titles</h4>
        <div class="title-list">
          <div v-for="item in displayTitles" :key="item.level" class="title-item">
            <span class="title-level">Lv {{ item.level }}</span>
            <span class="title-name">{{ item.title }}</span>
          </div>
        </div>
      </div>

      <!-- Bot behavior -->
      <div class="behavior-section">
        <h4>Bot Behavior</h4>
        <p class="behavior-text">{{ gameClass.botBehavior }}</p>
      </div>

      <!-- History section -->
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
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
  background: var(--void);
}

.panel-header h3 {
  margin: 0;
  font-size: var(--text-lg);
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
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xl);
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
  padding: var(--space-4);
}

.class-hero {
  text-align: center;
  margin-bottom: var(--space-4);
}

.class-name {
  margin: 0 0 var(--space-1);
  font-size: var(--text-3xl);
}

.class-category {
  font-size: var(--text-base);
  opacity: 0.8;
  margin-bottom: var(--space-2);
}

.class-tags {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
}

.tag {
  font-size: var(--text-xs);
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  font-weight: 500;
}

.tag.magic {
  color: var(--violet);
  background: rgba(167, 139, 250, 0.15);
}

.tag.melee {
  color: var(--red);
  background: rgba(239, 68, 68, 0.15);
}

.tag.primary {
  color: var(--text-secondary);
  background: var(--highlight);
}

.locked-section {
  text-align: center;
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--highlight);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border);
}

.lock-badge {
  display: inline-block;
  font-size: var(--text-sm);
  font-weight: bold;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--red);
  background: rgba(239, 68, 68, 0.15);
  margin-bottom: var(--space-2);
}

.unlock-condition {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.description-section {
  margin-bottom: var(--space-4);
}

.description-text {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.5;
  text-align: center;
}

.stats-section,
.properties-section,
.abilities-section,
.titles-section,
.behavior-section,
.history-section {
  margin-bottom: var(--space-4);
}

h4 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stat-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-label {
  width: 32px;
  font-size: var(--text-sm);
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
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.stat-value {
  width: 24px;
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  text-align: right;
}

.property-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.property-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--highlight);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

.property-label {
  color: var(--text-secondary);
}

.property-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.property-value.negative {
  color: var(--red);
}

.ability-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ability-item {
  padding: var(--space-2) var(--space-3);
  background: var(--highlight);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--purple);
}

.ability-name {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.ability-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.title-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--highlight);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

.title-level {
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  min-width: 40px;
}

.title-name {
  color: var(--text-primary);
}

.behavior-text {
  margin: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.5;
  padding: var(--space-2) var(--space-3);
  background: var(--highlight);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--blue);
}

.history-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.history-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--highlight);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
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
