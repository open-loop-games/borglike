<script setup lang="ts">
import { computed, toRef } from 'vue'
import type { ActiveRun, DisplayItem } from '@/stores/runs'
import type { EquipSlot } from '@game/types'
import { useSettingsStore, type PanelStates } from '@/stores/settings'
import { useItemLinger } from '@/ui/composables/use-item-linger'
import ProgressBar from '../common/ProgressBar.vue'
import CollapsibleSection from '../common/CollapsibleSection.vue'
import GameTooltip from '../common/GameTooltip.vue'

const props = defineProps<{
  run: ActiveRun
}>()

const settingsStore = useSettingsStore()

function togglePanel(panel: keyof PanelStates) {
  settingsStore.togglePanel(panel)
}

const RESIST_CONFIG: Record<string, { label: string; color: string }> = {
  FIRE: { label: 'F', color: '#ef4444' },
  COLD: { label: 'C', color: '#06b6d4' },
  POISON: { label: 'P', color: '#22c55e' },
  ACID: { label: 'A', color: '#84cc16' },
  LIGHTNING: { label: 'L', color: '#eab308' },
  LIGHT: { label: 'Lt', color: '#fbbf24' },
  DARK: { label: 'Dk', color: '#6366f1' },
  DRAIN: { label: 'Dr', color: '#a855f7' },
}

interface ResistView {
  type: string
  value: number
  label: string
  color: string
}

const activeResistances = computed<ResistView[]>(() => {
  return Object.entries(props.run.resistances)
    .filter(([, value]) => value !== 0)
    .map(([type, value]) => ({
      type,
      value: value as number,
      ...(RESIST_CONFIG[type] || { label: type.charAt(0) || type, color: '#94a3b8' }),
    }))
})

const STATUS_CONFIG: Record<string, { label: string; color: string; name: string; desc: string }> =
  {
    speed: { label: 'SPD', color: '#06b6d4', name: 'Haste', desc: 'Increased action speed' },
    heroism: {
      label: 'HERO',
      color: '#f59e0b',
      name: 'Heroism',
      desc: 'Bonus to-hit and damage, resist fear',
    },
    berserk: {
      label: 'BRSRK',
      color: '#ef4444',
      name: 'Berserk',
      desc: 'Large damage bonus, reduced defense',
    },
    blessing: {
      label: 'BLESS',
      color: '#fbbf24',
      name: 'Blessing',
      desc: 'Bonus to-hit and armor class',
    },
    protection: {
      label: 'PROT',
      color: '#3b82f6',
      name: 'Protection',
      desc: 'Increased armor class',
    },
  }

interface StatusView {
  type: string
  turnsRemaining: number
  value: number
  label: string
  color: string
  name: string
  desc: string
}

const activeStatuses = computed<StatusView[]>(() => {
  return props.run.statusEffects.map((effect) => ({
    ...effect,
    ...(STATUS_CONFIG[effect.type] || {
      label: effect.type.toUpperCase(),
      color: '#94a3b8',
      name: effect.type,
      desc: effect.type,
    }),
  }))
})

const isConsumableChar = (char: string) => char === '!' || char === '?'

const equipmentItems = computed(() => {
  return props.run.inventory.filter((item) => !isConsumableChar(item.char))
})

interface StackedConsumable {
  name: string
  char: string
  color: number
  count: number
  isArtifact: boolean
  tier: number
}

const stackedConsumables = computed<StackedConsumable[]>(() => {
  const consumables = props.run.inventory.filter((item) => isConsumableChar(item.char))
  const stacks = new Map<string, StackedConsumable>()

  for (const item of consumables) {
    const existing = stacks.get(item.name)
    if (existing) {
      existing.count++
    } else {
      stacks.set(item.name, {
        name: item.name,
        char: item.char,
        color: item.color,
        count: 1,
        isArtifact: item.isArtifact,
        tier: item.tier,
      })
    }
  }

  return Array.from(stacks.values()).sort((a, b) => {
    if (a.char !== b.char) return a.char === '!' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
})

const runTurns = toRef(props, 'run')
const turnsRef = computed(() => runTurns.value.turns)

const lingeredResistances = useItemLinger<ResistView>(activeResistances, turnsRef, (r) => r.type)
const lingeredStatuses = useItemLinger<StatusView>(activeStatuses, turnsRef, (s) => s.type)
const lingeredConsumables = useItemLinger<StackedConsumable>(
  stackedConsumables,
  turnsRef,
  (c) => c.name
)

const equipSlots = [
  { id: 'weapon', label: 'wep' },
  { id: 'armor', label: 'arm' },
  { id: 'shield', label: 'shd' },
  { id: 'helm', label: 'hlm' },
  { id: 'gloves', label: 'glv' },
  { id: 'boots', label: 'bot' },
  { id: 'ring1', label: 'rg1' },
  { id: 'ring2', label: 'rg2' },
  { id: 'amulet', label: 'amu' },
  { id: 'light', label: 'lit' },
  { id: 'bow', label: 'bow' },
]

const SLOT_NAMES: Record<string, string> = {
  weapon: 'Weapon',
  armor: 'Body Armor',
  shield: 'Shield',
  helm: 'Helm',
  gloves: 'Gloves',
  boots: 'Boots',
  ring1: 'Ring (left)',
  ring2: 'Ring (right)',
  amulet: 'Amulet',
  light: 'Light Source',
  bow: 'Bow',
}

const STAT_TIPS = {
  STR: { label: 'Strength', desc: 'Melee damage and carry capacity' },
  INT: { label: 'Intelligence', desc: 'Spell power and mana pool' },
  DEX: { label: 'Dexterity', desc: 'Accuracy, evasion, and ranged damage' },
  WIS: { label: 'Wisdom', desc: 'Spell resistance and mana regeneration' },
  CON: { label: 'Constitution', desc: 'Hit points and physical resilience' },
} as const

const COMBAT_TIPS = {
  AC: { label: 'Armor Class', desc: 'Damage reduction from armor and shields' },
  EVA: { label: 'Evasion', desc: 'Chance to dodge attacks entirely' },
  DMG: { label: 'Melee Damage', desc: 'Base damage dealt per hit' },
  ACC: { label: 'Accuracy', desc: 'Bonus to attack hit chance' },
  SPD: { label: 'Speed', desc: 'Action speed — above 100 is faster, below is slower' },
} as const

const RESIST_FULL_NAMES: Record<string, string> = {
  FIRE: 'Fire',
  COLD: 'Cold',
  POISON: 'Poison',
  ACID: 'Acid',
  LIGHTNING: 'Lightning',
  LIGHT: 'Light',
  DARK: 'Dark',
  DRAIN: 'Life Drain',
}

const EMPTY_CHAR = '─'

function getSlotChar(slotId: string): string {
  const item = props.run.equipment[slotId as EquipSlot]
  return item?.char ?? EMPTY_CHAR
}

function getSlotColor(slotId: string): string {
  const item = props.run.equipment[slotId as EquipSlot]
  if (!item) return '#475569'
  return '#' + item.color.toString(16).padStart(6, '0')
}

function formatItemName(item: DisplayItem): string {
  if (item.enchantment > 0) {
    return `${item.name} +${item.enchantment}`
  }
  return item.name
}

function formatCompact(value: number): string {
  if (value >= 10_000_000) return `${Math.round(value / 1_000_000)}M`
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`
  return value.toLocaleString()
}

function formatGoal(goal: string | undefined): string {
  if (!goal) return '...'
  const parts = goal.split(' - ')
  if (parts.length < 2) return goal
  return `${parts[0]}: ${parts.slice(1).join(' - ')}`
}
</script>

<template>
  <aside class="stats-panel">
    <!-- AI Status -->
    <div v-if="run.state === 'running'" class="ai-status">
      <p class="ai-line" :title="run.botGoal">
        <span class="ai-label">Goal:</span> {{ formatGoal(run.botGoal) }}
      </p>
      <p v-if="run.depthBlocker" class="ai-line prep" :title="run.depthBlocker">
        <span class="ai-label">Prep:</span> {{ run.depthBlocker }}
      </p>
    </div>

    <!-- Vitals -->
    <CollapsibleSection
      title="Vitals"
      :expanded="settingsStore.panelStates.vitals"
      @toggle="togglePanel('vitals')"
    >
      <div class="resource-row">
        <span class="stat-label">HP</span>
        <ProgressBar :current="run.hp" :max="run.maxHp" variant="hp" :show-text="true" size="md" />
      </div>
      <div v-if="run.maxMp > 0" class="resource-row">
        <span class="stat-label">MP</span>
        <ProgressBar :current="run.mp" :max="run.maxMp" variant="mp" :show-text="true" size="md" />
      </div>
      <div class="stats-row">
        <span class="stat-item"
          >LVL <span class="val level">{{ run.level }}</span></span
        >
        <span class="stat-item"
          >XP <span class="val xp">{{ formatCompact(run.xp) }}</span></span
        >
        <span class="stat-item"
          >Gold <span class="val gold">{{ formatCompact(run.gold) }}</span></span
        >
      </div>
      <div class="stats-row">
        <span class="stat-item"
          >Depth <span class="val depth">{{ run.depth }}</span></span
        >
        <span class="stat-item"
          >Kills <span class="val kills">{{ run.kills.toLocaleString() }}</span></span
        >
      </div>
    </CollapsibleSection>

    <!-- Core Stats -->
    <CollapsibleSection
      title="Stats"
      :expanded="settingsStore.panelStates.stats"
      @toggle="togglePanel('stats')"
    >
      <div class="core-stats-grid">
        <GameTooltip class="core-stat" :text="`${STAT_TIPS.STR.label} — ${STAT_TIPS.STR.desc}`">
          <span class="core-label">STR</span>
          <span class="core-val str">{{ run.stats.str }}</span>
        </GameTooltip>
        <GameTooltip class="core-stat" :text="`${STAT_TIPS.INT.label} — ${STAT_TIPS.INT.desc}`">
          <span class="core-label">INT</span>
          <span class="core-val int">{{ run.stats.int }}</span>
        </GameTooltip>
        <GameTooltip class="core-stat" :text="`${STAT_TIPS.DEX.label} — ${STAT_TIPS.DEX.desc}`">
          <span class="core-label">DEX</span>
          <span class="core-val dex">{{ run.stats.dex }}</span>
        </GameTooltip>
        <GameTooltip class="core-stat" :text="`${STAT_TIPS.WIS.label} — ${STAT_TIPS.WIS.desc}`">
          <span class="core-label">WIS</span>
          <span class="core-val wis">{{ run.stats.wis }}</span>
        </GameTooltip>
        <GameTooltip class="core-stat" :text="`${STAT_TIPS.CON.label} — ${STAT_TIPS.CON.desc}`">
          <span class="core-label">CON</span>
          <span class="core-val con">{{ run.stats.con }}</span>
        </GameTooltip>
      </div>
    </CollapsibleSection>

    <!-- Combat Stats -->
    <CollapsibleSection
      title="Combat"
      :expanded="settingsStore.panelStates.combat"
      @toggle="togglePanel('combat')"
    >
      <div class="combat-stats-grid">
        <GameTooltip
          class="combat-stat"
          :text="`${COMBAT_TIPS.DMG.label} — ${COMBAT_TIPS.DMG.desc}`"
        >
          <span class="combat-label">DMG</span>
          <span class="combat-val damage">{{ run.combat.meleeDamage }}</span>
          <template #extended>
            <span class="tt-muted"
              >Combined weapon damage + strength bonus. Shown as average per hit.</span
            >
          </template>
        </GameTooltip>
        <GameTooltip
          class="combat-stat"
          :text="`${COMBAT_TIPS.EVA.label} — ${COMBAT_TIPS.EVA.desc}`"
        >
          <span class="combat-label">EVA</span>
          <span class="combat-val evasion">{{ run.combat.evasion }}</span>
          <template #extended>
            <span class="tt-muted"
              >Compared against attacker's accuracy. Higher evasion means more dodges.</span
            >
          </template>
        </GameTooltip>
        <GameTooltip class="combat-stat" :text="`${COMBAT_TIPS.AC.label} — ${COMBAT_TIPS.AC.desc}`">
          <span class="combat-label">AC</span>
          <span class="combat-val armor">{{ run.combat.armor }}</span>
          <template #extended>
            <span class="tt-muted"
              >Higher is better. Each point reduces incoming melee damage.</span
            >
          </template>
        </GameTooltip>
        <GameTooltip
          class="combat-stat"
          :text="`${COMBAT_TIPS.ACC.label} — ${COMBAT_TIPS.ACC.desc}`"
        >
          <span class="combat-label">ACC</span>
          <span class="combat-val accuracy">{{ run.combat.accuracy }}</span>
          <template #extended>
            <span class="tt-muted"
              >Compared against target's evasion. Higher accuracy means fewer misses.</span
            >
          </template>
        </GameTooltip>
        <GameTooltip
          class="combat-stat"
          :text="`${COMBAT_TIPS.SPD.label} — ${COMBAT_TIPS.SPD.desc}`"
        >
          <span class="combat-label">SPD</span>
          <span
            class="combat-val speed"
            :class="{ buffed: run.combat.speed > 100, debuffed: run.combat.speed < 100 }"
          >
            {{ run.combat.speed }}
          </span>
          <template #extended>
            <span class="tt-muted"
              >100 = normal. Each +10 means ~10% more actions per turn cycle.</span
            >
          </template>
        </GameTooltip>
      </div>
    </CollapsibleSection>

    <!-- Equipment -->
    <CollapsibleSection
      title="Equipped"
      :expanded="settingsStore.panelStates.equipment"
      @toggle="togglePanel('equipment')"
    >
      <div class="equip-grid">
        <GameTooltip v-for="slot in equipSlots" :key="slot.id" class="equip-slot" position="bottom">
          <span class="slot-char" :style="{ color: getSlotColor(slot.id) }">
            {{ getSlotChar(slot.id) }}
          </span>
          <span class="slot-label">{{ slot.label }}</span>
          <template #content>
            <div class="tt-header">{{ SLOT_NAMES[slot.id] ?? slot.id }}</div>
            <template v-if="run.equipment[slot.id as EquipSlot]">
              <span
                :class="{
                  'equip-tt-artifact': run.equipment[slot.id as EquipSlot]!.isArtifact,
                }"
              >
                {{ formatItemName(run.equipment[slot.id as EquipSlot]!) }}
              </span>
              <div class="tt-muted">
                {{
                  run.equipment[slot.id as EquipSlot]!.isArtifact
                    ? 'Artifact'
                    : `Tier ${run.equipment[slot.id as EquipSlot]!.tier}`
                }}
              </div>
            </template>
            <span v-else class="tt-muted">Empty</span>
          </template>
          <template v-if="run.equipment[slot.id as EquipSlot]" #extended>
            <div v-if="run.equipment[slot.id as EquipSlot]!.enchantment > 0" class="tt-row">
              <span class="tt-label">Enchantment</span>
              <span class="tt-val">+{{ run.equipment[slot.id as EquipSlot]!.enchantment }}</span>
            </div>
            <div class="tt-row">
              <span class="tt-label">Tier</span>
              <span class="tt-val">{{ run.equipment[slot.id as EquipSlot]!.tier }}</span>
            </div>
            <div v-if="run.equipment[slot.id as EquipSlot]!.isArtifact" class="tt-muted">
              Artifacts are unique and cannot be found again
            </div>
          </template>
        </GameTooltip>
      </div>
    </CollapsibleSection>

    <!-- Pack -->
    <CollapsibleSection
      title="Pack"
      :expanded="settingsStore.panelStates.inventory"
      :badge="equipmentItems.length"
      @toggle="togglePanel('inventory')"
    >
      <div class="inventory-list">
        <div v-for="item in equipmentItems" :key="item.id" class="inv-item">
          <span
            class="item-char"
            :style="{ color: '#' + item.color.toString(16).padStart(6, '0') }"
            >{{ item.char }}</span
          >
          <span class="item-name" :class="{ artifact: item.isArtifact }">
            {{ formatItemName(item) }}
          </span>
        </div>
        <div v-if="equipmentItems.length === 0" class="inv-empty">Empty</div>
      </div>
    </CollapsibleSection>

    <!-- Resistances (volatile) -->
    <CollapsibleSection
      v-show="lingeredResistances.length > 0"
      title="Resist"
      :expanded="settingsStore.panelStates.resist"
      :badge="activeResistances.length"
      @toggle="togglePanel('resist')"
    >
      <div class="resist-grid">
        <GameTooltip
          v-for="entry in lingeredResistances"
          :key="entry.key"
          class="resist-item"
          :class="{ 'lingered-fading': entry.state === 'fading' }"
        >
          <span class="resist-label" :style="{ color: entry.item.color }">{{
            entry.item.label
          }}</span>
          <span
            class="resist-val"
            :class="{ immune: entry.item.value >= 100, vuln: entry.item.value < 0 }"
          >
            {{ entry.item.value }}
          </span>
          <template #content>
            <div class="tt-header">
              {{ RESIST_FULL_NAMES[entry.item.type] ?? entry.item.type }} Resistance
            </div>
            <span class="game-tooltip-text">
              {{
                entry.item.value >= 100
                  ? 'Immune to'
                  : entry.item.value < 0
                    ? `Vulnerable to`
                    : `Reduces`
              }}
              {{ (RESIST_FULL_NAMES[entry.item.type] ?? entry.item.type).toLowerCase() }}
              damage{{
                entry.item.value >= 100 || entry.item.value < 0 ? '' : ` by ${entry.item.value}%`
              }}
            </span>
          </template>
        </GameTooltip>
      </div>
    </CollapsibleSection>

    <!-- Status Effects (volatile) -->
    <CollapsibleSection
      v-show="lingeredStatuses.length > 0"
      title="Status"
      :expanded="settingsStore.panelStates.status"
      :badge="activeStatuses.length"
      @toggle="togglePanel('status')"
    >
      <div class="status-effects">
        <GameTooltip
          v-for="entry in lingeredStatuses"
          :key="entry.key"
          class="status-effect"
          :class="{ 'lingered-fading': entry.state === 'fading' }"
          :style="{ borderColor: entry.item.color }"
        >
          <span class="status-name" :style="{ color: entry.item.color }">{{
            entry.item.label
          }}</span>
          <span class="status-turns">{{ entry.item.turnsRemaining }}</span>
          <template #content>
            <div class="tt-header" :style="{ color: entry.item.color }">
              {{ entry.item.name ?? entry.item.type }}
            </div>
            <span class="game-tooltip-text">{{ entry.item.desc ?? entry.item.type }}</span>
          </template>
          <template #extended>
            <div class="tt-row">
              <span class="tt-label">Turns left</span>
              <span class="tt-val">{{ entry.item.turnsRemaining }}</span>
            </div>
          </template>
        </GameTooltip>
      </div>
    </CollapsibleSection>

    <!-- Consumables (volatile) -->
    <CollapsibleSection
      v-show="lingeredConsumables.length > 0"
      title="Consumables"
      :expanded="settingsStore.panelStates.consumables"
      :badge="stackedConsumables.reduce((sum, c) => sum + c.count, 0)"
      @toggle="togglePanel('consumables')"
    >
      <div class="consumables-list">
        <div
          v-for="entry in lingeredConsumables"
          :key="entry.key"
          class="consumable-item"
          :class="{ 'lingered-fading': entry.state === 'fading' }"
        >
          <span
            class="item-char"
            :style="{ color: '#' + entry.item.color.toString(16).padStart(6, '0') }"
            >{{ entry.item.char }}</span
          >
          <span class="consumable-count">{{ entry.item.count }}x</span>
          <span class="item-name" :class="{ artifact: entry.item.isArtifact }">
            {{ entry.item.name }}
          </span>
        </div>
      </div>
    </CollapsibleSection>
  </aside>
</template>

<style scoped>
.ai-status {
  padding: 0 var(--space-1);
  font-size: var(--text-base);
}

.ai-line {
  margin: 0;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2lh;
}

.ai-line + .ai-line {
  margin-top: var(--space-1);
}

.ai-line.prep {
  color: var(--warning);
}

.ai-label {
  color: var(--text-dim);
  text-transform: uppercase;
  font-size: var(--text-sm);
}

.stats-panel {
  width: 220px;
  padding: var(--space-2);
  background: var(--bg-panel);
  border-right: 1px solid var(--border);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stats-panel :deep(.section-header) {
  padding: 2px var(--space-2);
}

.stat-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.stats-row {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.stat-item .val {
  font-weight: bold;
  color: var(--text-primary);
}
.stat-item .val.depth {
  color: var(--essence);
}
.stat-item .val.kills {
  color: var(--danger);
}
.stat-item .val.gold {
  color: var(--warning);
}
.stat-item .val.xp {
  color: var(--info);
}
.stat-item .val.level {
  color: var(--success);
}

/* Equipment grid */
.equip-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-1);
}

.equip-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-1) 2px;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.slot-char {
  font-size: var(--text-lg);
  line-height: 1;
}

.slot-label {
  font-size: var(--text-2xs);
  color: var(--text-dim);
  text-transform: lowercase;
}

/* Inventory list */
.inventory-list {
  max-height: 180px;
  overflow-y: auto;
}

.inv-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px 0;
  font-size: var(--text-base);
}

.item-char {
  width: 12px;
  text-align: center;
}

.item-name {
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-name.artifact {
  color: var(--warning);
  text-shadow: 0 0 6px color-mix(in srgb, var(--warning) 40%, transparent);
}

.inv-empty,
.inv-more {
  font-size: var(--text-base);
  color: var(--text-dim);
  font-style: italic;
}

/* Consumables list */
.consumables-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.consumable-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-base);
}

.consumable-count {
  color: var(--text-dim);
  min-width: 20px;
}

/* Vitals layout */
.resource-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.resource-row :deep(.progress-bar) {
  flex: 1;
}

.resource-row .stat-label {
  width: 20px;
  flex-shrink: 0;
}

/* Core Stats Grid (3 columns) */
.core-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1) var(--space-2);
}

.core-stat {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-base);
}

.core-label {
  color: var(--text-dim);
}

.core-val {
  font-weight: bold;
  color: var(--text-primary);
}

.core-val.str {
  color: var(--danger);
}
.core-val.dex {
  color: var(--success);
}
.core-val.con {
  color: var(--warning);
}
.core-val.int {
  color: var(--info);
}
.core-val.wis {
  color: var(--essence);
}

/* Combat Stats Grid (3 columns) */
.combat-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1) var(--space-2);
}

.combat-stat {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-base);
}

.combat-label {
  color: var(--text-dim);
}

.combat-val {
  font-weight: bold;
  color: var(--text-primary);
}

.combat-val.armor {
  color: var(--info);
}
.combat-val.evasion {
  color: var(--success);
}
.combat-val.damage {
  color: var(--danger);
}
.combat-val.accuracy {
  color: var(--warning);
}
.combat-val.speed {
  color: var(--text-secondary);
}
.combat-val.speed.buffed {
  color: var(--success);
}
.combat-val.speed.debuffed {
  color: var(--danger);
}

/* Resistances Grid */
.resist-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-1) var(--space-2);
}

.resist-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-base);
}

.resist-label {
  font-weight: bold;
}

.resist-val {
  color: var(--text-secondary);
}

.resist-val.immune {
  color: var(--success);
  text-shadow: 0 0 4px color-mix(in srgb, var(--success) 50%, transparent);
}

.resist-val.vuln {
  color: var(--danger);
}

/* Status Effects */
.status-effects {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.status-effect {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px 6px;
  background: var(--bg-highlight);
  border: 1px solid;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
}

.status-name {
  font-weight: bold;
}

.status-turns {
  color: var(--text-dim);
}

/* Per-item linger: dimmed + greyscale for recently-removed items */
.lingered-fading {
  opacity: 0.35;
  filter: grayscale(1);
  transition:
    opacity 200ms ease,
    filter 200ms ease;
}
</style>

<!-- Tooltip artifact name glow (global since tooltip is teleported) -->
<style>
.equip-tt-artifact {
  color: var(--warning);
  text-shadow: 0 0 6px color-mix(in srgb, var(--warning) 40%, transparent);
}
</style>
