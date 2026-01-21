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

// Generate tooltip for equipment preview
const equipmentTooltip = computed(() => {
  if (!props.run.equipment || props.run.equipment.length === 0) {
    return 'No equipment'
  }
  const weapon = props.run.equipment.find(e => e.slot === 'weapon')
  const armor = props.run.equipment.find(e => e.slot === 'armor')
  const parts = []
  if (weapon) {
    const enchant = weapon.enchantment > 0 ? ` +${weapon.enchantment}` : ''
    parts.push(`Weapon: ${weapon.name}${enchant}`)
  }
  if (armor) {
    const enchant = armor.enchantment > 0 ? ` +${armor.enchantment}` : ''
    parts.push(`Armor: ${armor.name}${enchant}`)
  }
  return parts.join('\n') || 'No weapon or armor'
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
</script>

<template>
  <div
    class="run-row"
    :class="{ expanded }"
    :title="equipmentTooltip"
    @click="emit('toggle')"
  >
    <div class="row-collapsed">
      <span v-if="rank" class="rank">#{{ rank }}</span>
      <span class="time-ago">{{ timeAgo }}</span>
      <span class="character">{{ run.race }} {{ run.class }}</span>
      <span class="depth">D:{{ run.maxDepth }}</span>
      <span class="kills">{{ run.kills }} kills</span>
      <span class="gold">{{ run.goldEarned }} gold</span>
      <span class="essence">
        <span class="essence-icon">&#x25C6;</span>
        {{ run.essenceEarned }}
      </span>
      <span class="death-cause" v-if="run.deathCause">
        {{ run.deathCause.slice(0, 30) }}{{ run.deathCause.length > 30 ? '...' : '' }}
      </span>
      <span v-else class="victory">Victory!</span>
      <span class="expand-icon">{{ expanded ? '▼' : '▶' }}</span>
    </div>

    <div v-if="expanded" class="row-expanded">
      <div class="expanded-section">
        <h4>Details</h4>
        <div class="detail-grid">
          <div class="detail">
            <span class="label">Duration:</span>
            <span class="value">{{ duration ?? 'Unknown' }}</span>
          </div>
          <div class="detail">
            <span class="label">Turns:</span>
            <span class="value">{{ run.turns ?? 'Unknown' }}</span>
          </div>
          <div class="detail">
            <span class="label">XP Earned:</span>
            <span class="value">{{ run.xpEarned.toLocaleString() }}</span>
          </div>
          <div class="detail" v-if="run.personality">
            <span class="label">Personality:</span>
            <span class="value">{{ run.personality }}</span>
          </div>
          <div class="detail" v-if="run.seed">
            <span class="label">Seed:</span>
            <span class="value seed">{{ run.seed }}</span>
          </div>
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

      <div v-if="run.inventory && run.inventory.length > 0" class="expanded-section">
        <h4>Inventory ({{ run.inventory.length }})</h4>
        <div class="inventory-list">
          <span
            v-for="(item, index) in run.inventory"
            :key="index"
            class="inventory-item"
          >{{ item }}</span>
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
