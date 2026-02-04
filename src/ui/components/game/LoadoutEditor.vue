<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { getBoosterById } from '@game/data/boosters'
import { races, type Race } from '@game/data/races'
import { classes, type GameClass } from '@game/data/classes'
import PanelFrame from '../common/PanelFrame.vue'
import BotTrainingPanel from './BotTrainingPanel.vue'

const props = defineProps<{
  slot: number
}>()

type Personality = 'cautious' | 'aggressive' | 'greedy' | 'speedrunner'

const emit = defineEmits<{
  start: [config: { race: string; class: string; personality: Personality }]
  cancel: []
}>()

const progression = useProgressionStore()

// Load saved config for this slot (with fallbacks)
const savedConfig = progression.getSlotConfig(props.slot)

// Selected options - initialized from saved config
const selectedRace = ref(savedConfig.race)
const selectedClass = ref(savedConfig.class)
const selectedPersonality = ref<Personality>(savedConfig.personality)

// Booster slots - initialized from saved config
const boosterSlot0 = ref(savedConfig.boosters[0])
const boosterSlot1 = ref(savedConfig.boosters[1])

// Sync booster slots with store when changed
watch(boosterSlot0, (val) => progression.setActiveBooster(0, val))
watch(boosterSlot1, (val) => progression.setActiveBooster(1, val))

// Initialize active loadout from saved config on mount
onMounted(() => {
  progression.setActiveBooster(0, savedConfig.boosters[0])
  progression.setActiveBooster(1, savedConfig.boosters[1])
})

// Available options
const availableRaces = computed(() => progression.availableRaces)
const availableClasses = computed(() => progression.availableClasses)

// Selected race/class details for description panels
const selectedRaceData = computed((): Race | undefined => {
  return races.find((r) => r.name === selectedRace.value)
})

const selectedClassData = computed((): GameClass | undefined => {
  return classes.find((c) => c.name === selectedClass.value)
})

function formatStat(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatStatClass(value: number): string {
  if (value > 0) return 'stat-positive'
  if (value < 0) return 'stat-negative'
  return 'stat-neutral'
}

// Unlocked boosters for selection
const unlockedBoosters = computed(() => progression.unlockedBoosters)

// Get booster info for display
function getBoosterInfo(id: string | null) {
  if (!id) return null
  return getBoosterById(id)
}

const personalities = [
  { id: 'cautious', name: 'Cautious', desc: 'Retreats early, uses items freely' },
  { id: 'aggressive', name: 'Aggressive', desc: 'Fights to low HP, hoards items' },
  { id: 'greedy', name: 'Greedy', desc: 'Prioritizes gold/items over safety' },
  { id: 'speedrunner', name: 'Speedrunner', desc: 'Beelines for stairs' },
] as const

// Config performance from run history
const configPerformance = computed(() => {
  return progression.getConfigPerformance(
    selectedRace.value,
    selectedClass.value,
    selectedPersonality.value
  )
})

// Bonuses from upgrades
const activeBonuses = computed(() => {
  const bonuses: { name: string; value: string }[] = []

  const hpBonus = progression.getUpgradeEffectValue('starting_hp')
  if (hpBonus > 0) bonuses.push({ name: 'Starting HP', value: `+${hpBonus}` })

  const strBonus = progression.getUpgradeEffectValue('starting_str')
  if (strBonus > 0) bonuses.push({ name: 'Strength', value: `+${strBonus}` })

  const dexBonus = progression.getUpgradeEffectValue('starting_dex')
  if (dexBonus > 0) bonuses.push({ name: 'Dexterity', value: `+${dexBonus}` })

  const essenceBonus = progression.getUpgradeEffectValue('essence_boost')
  if (essenceBonus > 0) bonuses.push({ name: 'Essence Gain', value: `+${essenceBonus}%` })

  const goldBonus = progression.getUpgradeEffectValue('gold_boost')
  if (goldBonus > 0) bonuses.push({ name: 'Gold Find', value: `+${goldBonus}%` })

  const xpBonus = progression.getUpgradeEffectValue('xp_boost')
  if (xpBonus > 0) bonuses.push({ name: 'XP Gain', value: `+${xpBonus}%` })

  return bonuses
})

function handleStart() {
  // Save the config for this slot before starting
  progression.saveSlotConfig(props.slot, {
    race: selectedRace.value,
    class: selectedClass.value,
    personality: selectedPersonality.value,
    boosters: [boosterSlot0.value, boosterSlot1.value],
  })

  emit('start', {
    race: selectedRace.value,
    class: selectedClass.value,
    personality: selectedPersonality.value,
  })
}

function handleCancel() {
  emit('cancel')
}
</script>

<template>
  <div class="loadout-editor">
    <header class="editor-header">
      <h2>Configure Run</h2>
      <span class="slot-badge">Slot {{ slot + 1 }}</span>
    </header>

    <div class="editor-content">
      <!-- Left Column: Character Config -->
      <div class="config-column">
        <!-- Race Selection -->
        <PanelFrame class="selection-section">
          <h3>Race</h3>
          <div class="option-grid">
            <button
              v-for="race in availableRaces"
              :key="race"
              class="option-btn"
              :class="{ active: selectedRace === race }"
              @click="selectedRace = race"
            >
              {{ race }}
            </button>
          </div>
          <!-- Race Description -->
          <div v-if="selectedRaceData" class="selection-details">
            <div class="details-stats">
              <span :class="formatStatClass(selectedRaceData.stats.str)"
                >STR {{ formatStat(selectedRaceData.stats.str) }}</span
              >
              <span :class="formatStatClass(selectedRaceData.stats.int)"
                >INT {{ formatStat(selectedRaceData.stats.int) }}</span
              >
              <span :class="formatStatClass(selectedRaceData.stats.wis)"
                >WIS {{ formatStat(selectedRaceData.stats.wis) }}</span
              >
              <span :class="formatStatClass(selectedRaceData.stats.dex)"
                >DEX {{ formatStat(selectedRaceData.stats.dex) }}</span
              >
              <span :class="formatStatClass(selectedRaceData.stats.con)"
                >CON {{ formatStat(selectedRaceData.stats.con) }}</span
              >
              <span class="stat-info">HD +{{ selectedRaceData.hitdie }}</span>
              <span v-if="selectedRaceData.expPenalty !== 100" class="stat-xp"
                >XP {{ selectedRaceData.expPenalty }}%</span
              >
            </div>
            <div class="details-desc">{{ selectedRaceData.description }}</div>
            <div v-if="selectedRaceData.abilities.length > 0" class="details-abilities">
              <span
                v-for="ability in selectedRaceData.abilities"
                :key="ability.id"
                class="ability-tag"
                :title="ability.description"
              >
                {{ ability.name }}
              </span>
            </div>
          </div>
        </PanelFrame>

        <!-- Class Selection -->
        <PanelFrame class="selection-section">
          <h3>Class</h3>
          <div class="option-grid">
            <button
              v-for="cls in availableClasses"
              :key="cls"
              class="option-btn"
              :class="{ active: selectedClass === cls }"
              @click="selectedClass = cls"
            >
              {{ cls }}
            </button>
          </div>
          <!-- Class Description -->
          <div v-if="selectedClassData" class="selection-details">
            <div class="details-stats">
              <span :class="formatStatClass(selectedClassData.stats.str)"
                >STR {{ formatStat(selectedClassData.stats.str) }}</span
              >
              <span :class="formatStatClass(selectedClassData.stats.int)"
                >INT {{ formatStat(selectedClassData.stats.int) }}</span
              >
              <span :class="formatStatClass(selectedClassData.stats.wis)"
                >WIS {{ formatStat(selectedClassData.stats.wis) }}</span
              >
              <span :class="formatStatClass(selectedClassData.stats.dex)"
                >DEX {{ formatStat(selectedClassData.stats.dex) }}</span
              >
              <span :class="formatStatClass(selectedClassData.stats.con)"
                >CON {{ formatStat(selectedClassData.stats.con) }}</span
              >
              <span class="stat-info"
                >HD {{ selectedClassData.hitdie >= 0 ? '+' : ''
                }}{{ selectedClassData.hitdie }}</span
              >
              <span class="stat-info">{{ selectedClassData.maxAttacks }} atk</span>
              <span v-if="selectedClassData.usesMagic" class="stat-magic">Magic</span>
            </div>
            <div class="details-desc">{{ selectedClassData.description }}</div>
            <div class="details-behavior">
              <span class="behavior-label">AI:</span> {{ selectedClassData.botBehavior }}
            </div>
          </div>
        </PanelFrame>

        <!-- Booster Selection -->
        <PanelFrame v-if="unlockedBoosters.length > 0" class="selection-section booster-section">
          <h3>Boosters <span class="booster-hint">(max 2)</span></h3>
          <div class="booster-slots">
            <div class="booster-slot">
              <span class="slot-label">Slot 1</span>
              <select v-model="boosterSlot0" class="booster-select">
                <option :value="null">-- None --</option>
                <option
                  v-for="b in unlockedBoosters"
                  :key="b.id"
                  :value="b.id"
                  :disabled="b.id === boosterSlot1"
                >
                  {{ b.icon }} {{ b.name }}
                </option>
              </select>
              <span v-if="getBoosterInfo(boosterSlot0)" class="booster-desc">
                {{ getBoosterInfo(boosterSlot0)?.description }}
              </span>
            </div>
            <div class="booster-slot">
              <span class="slot-label">Slot 2</span>
              <select v-model="boosterSlot1" class="booster-select">
                <option :value="null">-- None --</option>
                <option
                  v-for="b in unlockedBoosters"
                  :key="b.id"
                  :value="b.id"
                  :disabled="b.id === boosterSlot0"
                >
                  {{ b.icon }} {{ b.name }}
                </option>
              </select>
              <span v-if="getBoosterInfo(boosterSlot1)" class="booster-desc">
                {{ getBoosterInfo(boosterSlot1)?.description }}
              </span>
            </div>
          </div>
        </PanelFrame>

        <!-- Active Bonuses & Config Performance -->
        <PanelFrame
          v-if="activeBonuses.length > 0 || (configPerformance && configPerformance.runCount >= 3)"
          class="bonuses-section"
        >
          <h3>Active Bonuses</h3>
          <div v-if="activeBonuses.length > 0" class="bonus-list">
            <div v-for="bonus in activeBonuses" :key="bonus.name" class="bonus-item">
              <span class="bonus-name">{{ bonus.name }}</span>
              <span class="bonus-value">{{ bonus.value }}</span>
            </div>
          </div>
          <div v-else class="no-bonuses">No upgrade bonuses active</div>

          <!-- Config Performance Stats -->
          <div
            v-if="configPerformance && configPerformance.runCount >= 3"
            class="config-performance"
          >
            <div class="perf-divider"></div>
            <h4>Config History</h4>
            <div class="perf-grid">
              <div class="perf-stat">
                <span class="perf-value">{{ configPerformance.runCount }}</span>
                <span class="perf-label">runs</span>
              </div>
              <div class="perf-stat">
                <span class="perf-value">D:{{ configPerformance.avgDepth.toFixed(1) }}</span>
                <span class="perf-label">avg</span>
              </div>
              <div class="perf-stat">
                <span class="perf-value">◆{{ configPerformance.avgEssence.toFixed(0) }}</span>
                <span class="perf-label">avg</span>
              </div>
              <div class="perf-stat best">
                <span class="perf-value">D:{{ configPerformance.bestDepth }}</span>
                <span class="perf-label">best</span>
              </div>
            </div>
          </div>
        </PanelFrame>
      </div>

      <!-- Right Column: Personality + Bot Training -->
      <div class="training-column">
        <!-- Personality Selection -->
        <PanelFrame class="selection-section">
          <h3>Bot Personality</h3>
          <div class="personality-list">
            <button
              v-for="p in personalities"
              :key="p.id"
              class="personality-btn"
              :class="{ active: selectedPersonality === p.id }"
              @click="selectedPersonality = p.id"
            >
              <span class="personality-name">{{ p.name }}</span>
              <span class="personality-desc">{{ p.desc }}</span>
            </button>
          </div>
        </PanelFrame>

        <BotTrainingPanel :slot="slot" />
      </div>
    </div>

    <footer class="editor-footer">
      <button class="cancel-btn" @click="handleCancel">Cancel</button>
      <button class="start-btn" @click="handleStart">
        <span class="start-icon">▶</span>
        Start Run
      </button>
    </footer>
  </div>
</template>

<style scoped>
.loadout-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--elevated);
  border-bottom: 1px solid var(--border);
}

.editor-header h2 {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: bold;
  color: var(--text-primary);
  margin: 0;
}

.slot-badge {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  padding: var(--space-1) var(--space-3);
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.editor-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  gap: var(--space-5);
}

.config-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.training-column {
  flex: 0 0 320px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.selection-section {
  padding: var(--space-4) !important;
}

.selection-section h3 {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 var(--space-3);
}

.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.option-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.option-btn:hover {
  border-color: var(--indigo);
  color: var(--text-primary);
}

.option-btn.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--indigo);
  color: var(--indigo);
  text-shadow: 0 0 6px rgba(99, 102, 241, 0.4);
}

/* Selection Details */
.selection-details {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
}

.details-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin-bottom: var(--space-2);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
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

.stat-info {
  color: var(--cyan);
}

.stat-xp {
  color: var(--amber);
}

.stat-magic {
  color: var(--purple);
  padding: 1px var(--space-1);
  background: rgba(139, 92, 246, 0.15);
  border-radius: var(--radius-sm);
}

.details-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: var(--space-2);
}

.details-abilities {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.ability-tag {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  padding: 3px 6px;
  background: rgba(6, 182, 212, 0.1);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: var(--radius-md);
  color: var(--cyan);
  cursor: help;
}

.ability-tag:hover {
  background: rgba(6, 182, 212, 0.2);
  border-color: var(--cyan);
}

.details-behavior {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.4;
}

.behavior-label {
  color: var(--purple);
  font-weight: bold;
}

.personality-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.personality-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--space-2) var(--space-3);
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.personality-btn:hover {
  border-color: var(--purple);
}

.personality-btn.active {
  background: rgba(139, 92, 246, 0.15);
  border-color: var(--purple);
}

.personality-name {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-primary);
}

.personality-btn.active .personality-name {
  color: var(--purple);
  text-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
}

.personality-desc {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.bonuses-section {
  padding: var(--space-4) !important;
}

.bonuses-section h3 {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 var(--space-3);
}

.bonus-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bonus-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.bonus-item:last-child {
  border-bottom: none;
}

.bonus-name {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.bonus-value {
  font-family: var(--font-mono);
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--green);
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.4);
}

.no-bonuses {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  font-style: italic;
}

/* Config Performance Stats */
.config-performance {
  margin-top: var(--space-3);
}

.perf-divider {
  height: 1px;
  background: var(--border);
  margin-bottom: var(--space-3);
}

.config-performance h4 {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 var(--space-3);
}

.perf-grid {
  display: flex;
  gap: var(--space-5);
}

.perf-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.perf-value {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: bold;
  color: var(--cyan);
}

.perf-stat.best .perf-value {
  color: var(--amber);
}

.perf-label {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-dim);
  text-transform: uppercase;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--elevated);
  border-top: 1px solid var(--border);
}

.cancel-btn {
  padding: var(--space-3) var(--space-5);
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.start-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  background: var(--indigo);
  border: 1px solid var(--indigo);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-md);
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  background: var(--indigo-hover);
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.4);
}

.start-icon {
  font-size: var(--text-sm);
}

/* Booster Section */
.booster-section h3 {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.booster-hint {
  font-size: var(--text-sm);
  font-weight: normal;
  color: var(--text-dim);
}

.booster-slots {
  display: flex;
  gap: var(--space-4);
}

.booster-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.slot-label {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-dim);
  text-transform: uppercase;
}

.booster-select {
  padding: var(--space-2) var(--space-3);
  background: var(--highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.booster-select:hover {
  border-color: var(--purple);
}

.booster-select:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 8px rgba(139, 92, 246, 0.3);
}

.booster-select option {
  background: var(--panel);
  color: var(--text-primary);
}

.booster-select option:disabled {
  color: var(--text-dim);
}

.booster-desc {
  font-size: var(--text-sm);
  color: var(--purple);
  font-style: italic;
}
</style>
