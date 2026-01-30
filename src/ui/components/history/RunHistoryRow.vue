<script setup lang="ts">
import { computed } from 'vue'
import type { RunStats } from '@/types/progression'

interface Props {
  run: RunStats
  expanded: boolean
  timeAgo: string
  rank?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: []
}>()

// Personality abbreviation mapping
const personalityAbbrev: Record<string, string> = {
  cautious: 'CAU',
  aggressive: 'AGG',
  greedy: 'GRD',
  speedrunner: 'SPD',
}

const personalityDisplay = computed(() => {
  if (!props.run.personality) return null
  const abbrev =
    personalityAbbrev[props.run.personality] ?? props.run.personality.slice(0, 3).toUpperCase()
  return abbrev
})

// Personality full name for tooltip
const personalityTooltip = computed(() => {
  if (!props.run.personality) return ''
  return props.run.personality.charAt(0).toUpperCase() + props.run.personality.slice(1)
})

// Full death cause for tooltip
const fullDeathCause = computed(() => {
  return props.run.deathCause || 'Victory!'
})

// Format equipment slot name
function formatSlot(slot: string): string {
  const names: Record<string, string> = {
    weapon: 'Weapon',
    bow: 'Bow',
    armor: 'Armor',
    shield: 'Shield',
    helm: 'Helm',
    gloves: 'Gloves',
    boots: 'Boots',
    ring1: 'Ring 1',
    ring2: 'Ring 2',
    amulet: 'Amulet',
    light: 'Light',
  }
  return names[slot] ?? slot
}

// Format run duration
const duration = computed(() => {
  if (!props.run.startTime || !props.run.endTime) return null
  const ms = props.run.endTime - props.run.startTime
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
})

// Consumable keywords for detection
const consumableKeywords = ['Potion', 'Scroll']

function isConsumable(name: string): boolean {
  return consumableKeywords.some((kw) => name.includes(kw))
}

// Process inventory: split consumables from items, stack duplicates
const processedInventory = computed(() => {
  if (!props.run.inventory || props.run.inventory.length === 0) {
    return { consumables: [], items: [] }
  }

  const consumableMap = new Map<string, number>()
  const items: string[] = []

  for (const item of props.run.inventory) {
    if (isConsumable(item)) {
      consumableMap.set(item, (consumableMap.get(item) || 0) + 1)
    } else {
      items.push(item)
    }
  }

  // Convert consumable map to sorted array with counts
  const consumables = Array.from(consumableMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Sort items alphabetically
  items.sort((a, b) => a.localeCompare(b))

  return { consumables, items }
})
</script>

<template>
  <div class="run-row" :class="{ expanded }" @click="emit('toggle')">
    <div class="row-collapsed">
      <span v-if="rank" class="rank" title="Rank by category">#{{ rank }}</span>
      <span class="time-ago" :title="new Date(run.endTime ?? run.startTime).toLocaleString()">{{
        timeAgo
      }}</span>
      <span class="character" :title="`${run.race} ${run.class}`"
        >{{ run.race }} {{ run.class }}</span
      >
      <span
        v-if="personalityDisplay"
        class="personality"
        :title="`Personality: ${personalityTooltip}`"
        >{{ personalityDisplay }}</span
      >
      <span class="depth" :title="`Maximum depth reached: ${run.maxDepth}`"
        >D:{{ run.maxDepth }}</span
      >
      <span class="kills" :title="`${run.kills} monsters killed`">{{ run.kills }} kills</span>
      <span class="gold" :title="`${run.goldEarned.toLocaleString()} gold earned`"
        >{{ run.goldEarned }} gold</span
      >
      <span class="essence" :title="`Essence earned: ${run.essenceEarned}`">
        <span class="essence-icon">&#x25C6;</span>
        {{ run.essenceEarned }}
      </span>
      <span v-if="run.deathCause" class="death-cause" :title="fullDeathCause">
        {{ run.deathCause.slice(0, 30) }}{{ run.deathCause.length > 30 ? '...' : '' }}
      </span>
      <span v-else class="victory" title="Defeated Morgoth!">Victory!</span>
      <span class="expand-icon" :title="expanded ? 'Collapse details' : 'Expand details'">{{
        expanded ? '▼' : '▶'
      }}</span>
    </div>

    <div v-if="expanded" class="row-expanded">
      <div class="expanded-section">
        <h4>Details</h4>
        <div class="detail-grid">
          <div v-if="run.level" class="detail">
            <span class="label">Level:</span>
            <span class="value level-value">{{ run.level }}</span>
          </div>
          <div class="detail">
            <span class="label">Duration:</span>
            <span class="value">{{ duration ?? 'Unknown' }}</span>
          </div>
          <div class="detail">
            <span class="label">Turns:</span>
            <span class="value">{{ run.turns?.toLocaleString() ?? 'Unknown' }}</span>
          </div>
          <div class="detail">
            <span class="label">XP Earned:</span>
            <span class="value">{{ run.xpEarned.toLocaleString() }}</span>
          </div>
          <div v-if="run.personality" class="detail">
            <span class="label">Personality:</span>
            <span class="value personality-value"
              >{{ personalityDisplay }}
              <span class="personality-full">({{ run.personality }})</span></span
            >
          </div>
          <div v-if="run.seed" class="detail">
            <span class="label">Seed:</span>
            <span class="value seed">{{ run.seed }}</span>
          </div>
        </div>
      </div>

      <!-- Boosters -->
      <div v-if="run.boosters && run.boosters.length > 0" class="expanded-section">
        <h4>Boosters</h4>
        <div class="booster-list">
          <span v-for="booster in run.boosters" :key="booster" class="booster-item">{{
            booster
          }}</span>
        </div>
      </div>

      <!-- Combat Stats -->
      <div
        v-if="run.damageDealt !== undefined || run.damageTaken !== undefined"
        class="expanded-section"
      >
        <h4>Combat</h4>
        <div class="detail-grid">
          <div v-if="run.damageDealt !== undefined" class="detail">
            <span class="label">Damage Dealt:</span>
            <span class="value damage-dealt">{{ run.damageDealt.toLocaleString() }}</span>
          </div>
          <div v-if="run.damageTaken !== undefined" class="detail">
            <span class="label">Damage Taken:</span>
            <span class="value damage-taken">{{ run.damageTaken.toLocaleString() }}</span>
          </div>
          <div v-if="run.spellsCast" class="detail">
            <span class="label">Spells Cast:</span>
            <span class="value spells">{{ run.spellsCast }}</span>
          </div>
          <div v-if="run.abilitiesUsed" class="detail">
            <span class="label">Abilities Used:</span>
            <span class="value abilities">{{ run.abilitiesUsed }}</span>
          </div>
        </div>
      </div>

      <!-- Economy Stats -->
      <div v-if="run.goldSpent || run.itemsBought || run.itemsSold" class="expanded-section">
        <h4>Economy</h4>
        <div class="detail-grid">
          <div class="detail">
            <span class="label">Gold Earned:</span>
            <span class="value gold-earned">{{ run.goldEarned.toLocaleString() }}</span>
          </div>
          <div v-if="run.goldSpent" class="detail">
            <span class="label">Gold Spent:</span>
            <span class="value gold-spent">{{ run.goldSpent.toLocaleString() }}</span>
          </div>
          <div v-if="run.itemsBought" class="detail">
            <span class="label">Items Bought:</span>
            <span class="value">{{ run.itemsBought }}</span>
          </div>
          <div v-if="run.itemsSold" class="detail">
            <span class="label">Items Sold:</span>
            <span class="value">{{ run.itemsSold }}</span>
          </div>
        </div>
      </div>

      <!-- Killer Monster (if died) -->
      <div v-if="run.killerMonster" class="expanded-section">
        <h4>Slain By</h4>
        <div class="killer-info">
          <span class="killer-name">{{ run.killerMonster.name }}</span>
          <span class="killer-stats">
            (Depth {{ run.killerMonster.level }}, {{ run.killerMonster.hp }} HP)
          </span>
        </div>
        <div v-if="run.deathDepth && run.deathDepth !== run.maxDepth" class="death-depth">
          Died on depth {{ run.deathDepth }} (max reached: {{ run.maxDepth }})
        </div>
      </div>

      <div v-if="run.equipment && run.equipment.length > 0" class="expanded-section">
        <h4>Equipment</h4>
        <div class="equipment-grid">
          <div
            v-for="item in run.equipment"
            :key="item.slot"
            class="equipment-item"
            :class="{ artifact: item.isArtifact }"
          >
            <span class="slot-name">{{ formatSlot(item.slot) }}:</span>
            <span class="item-name">
              {{ item.name }}
              <span v-if="item.enchantment > 0" class="enchant">+{{ item.enchantment }}</span>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="processedInventory.consumables.length > 0"
        class="expanded-section"
      >
        <h4>Consumables ({{ processedInventory.consumables.reduce((sum, c) => sum + c.count, 0) }})</h4>
        <div class="inventory-list">
          <span
            v-for="item in processedInventory.consumables"
            :key="item.name"
            class="inventory-item consumable"
          >
            {{ item.name }}<span v-if="item.count > 1" class="item-count"> x{{ item.count }}</span>
          </span>
        </div>
      </div>

      <div v-if="processedInventory.items.length > 0" class="expanded-section">
        <h4>Items ({{ processedInventory.items.length }})</h4>
        <div class="inventory-list">
          <span v-for="(item, index) in processedInventory.items" :key="index" class="inventory-item">{{
            item
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.run-row {
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.run-row:hover {
  background: var(--border);
}

.run-row.expanded {
  background: var(--void);
  border-color: var(--purple);
}

.row-collapsed {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
}

.rank {
  width: 24px;
  font-weight: bold;
  color: var(--gold);
}

.time-ago {
  width: 60px;
  color: var(--text-dim);
}

.character {
  flex: 1;
  min-width: 100px;
  color: var(--text-primary);
}

.personality {
  width: 32px;
  color: var(--cyan);
  font-weight: bold;
  font-size: 11px;
}

.depth {
  width: 40px;
  color: var(--indigo);
  font-weight: bold;
}

.kills {
  width: 70px;
  color: var(--red);
}

.gold {
  width: 70px;
  color: var(--gold);
}

.essence {
  width: 60px;
  color: var(--purple);
  display: flex;
  align-items: center;
  gap: 4px;
}

.essence-icon {
  font-size: 10px;
}

.death-cause {
  flex: 1;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.victory {
  flex: 1;
  color: var(--green);
  font-weight: bold;
}

.expand-icon {
  width: 16px;
  color: var(--text-dim);
  font-size: 10px;
}

.row-expanded {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}

.expanded-section {
  margin-bottom: 16px;
}

.expanded-section:last-child {
  margin-bottom: 0;
}

.expanded-section h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}

.detail {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.detail .label {
  color: var(--text-dim);
}

.detail .value {
  color: var(--text-primary);
}

.detail .value.seed {
  font-family: var(--font-mono);
  color: var(--indigo);
}

.detail .value.personality-value {
  color: var(--cyan);
  font-weight: bold;
}

.detail .value.level-value {
  color: var(--gold);
  font-weight: bold;
}

.detail .value.damage-dealt {
  color: var(--green);
}

.detail .value.damage-taken {
  color: var(--red);
}

.detail .value.spells {
  color: var(--indigo);
}

.detail .value.abilities {
  color: var(--cyan);
}

.detail .value.gold-earned {
  color: var(--gold);
}

.detail .value.gold-spent {
  color: var(--orange, #f97316);
}

.personality-full {
  font-weight: normal;
  color: var(--text-dim);
}

.killer-info {
  font-size: 13px;
  margin-bottom: 4px;
}

.killer-name {
  color: var(--red);
  font-weight: bold;
}

.killer-stats {
  color: var(--text-dim);
  margin-left: 8px;
}

.death-depth {
  font-size: 11px;
  color: var(--text-dim);
  font-style: italic;
}

.booster-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.booster-item {
  font-size: 12px;
  padding: 4px 10px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 4px;
  color: var(--indigo);
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 6px;
}

.equipment-item {
  display: flex;
  gap: 8px;
  font-size: 12px;
  padding: 4px 8px;
  background: var(--highlight);
  border-radius: 3px;
}

.equipment-item.artifact {
  background: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.slot-name {
  color: var(--text-dim);
  min-width: 60px;
}

.item-name {
  color: var(--text-primary);
}

.equipment-item.artifact .item-name {
  color: var(--purple);
}

.enchant {
  color: var(--green);
  font-size: 10px;
}

.inventory-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.inventory-item {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--highlight);
  border-radius: 3px;
  color: var(--text-secondary);
}
</style>
