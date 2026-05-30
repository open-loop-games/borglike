<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { useRunsStore, isRunEnded } from '@/stores/runs'
import { getBoosterById } from '@game/data/boosters'
import { races, type Race } from '@game/data/races'
import { classes, type GameClass } from '@game/data/classes'
import { getClassTier, type PersonalityConfig } from '@game/bot/types'
import { PERSONALITY_DISPLAY, type Personality } from '@/types/events'
import { computeUpgradeBonuses, getUpgradeTier } from '@game/upgrade-effects'
import {
  PARAMETER_INFO,
  SLIDER_UPGRADE_GATES,
  getPersonalityConfig,
  summarizePersonality,
} from '@game/bot/personality'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import IconSelect from '../common/IconSelect.vue'
import PanelFrame from '../common/PanelFrame.vue'

const props = withDefaults(
  defineProps<{
    slot: number
    variant?: 'desktop' | 'mobile'
  }>(),
  { variant: 'desktop' }
)

const emit = defineEmits<{
  start: [config: { race: string; class: string; personality: Personality }]
  cancel: []
}>()

const isMobile = computed(() => props.variant === 'mobile')

type SectionId = 'race' | 'class' | 'boosters' | 'bonuses' | 'personality' | 'controls'
const expanded = ref<Record<SectionId, boolean>>({
  race: true,
  class: false,
  boosters: false,
  bonuses: false,
  personality: false,
  controls: false,
})
function toggleSection(id: SectionId) {
  expanded.value[id] = !expanded.value[id]
}
function isOpen(id: SectionId): boolean {
  return !isMobile.value || expanded.value[id]
}

const progression = useProgressionStore()
const runs = useRunsStore()

// True when the slot already has a live run — editing then queues new config
// for the next auto-restart instead of starting immediately.
const isQueueMode = computed(() => {
  const run = runs.getRunBySlot(props.slot)
  return run !== undefined && !isRunEnded(run.state)
})

// Load saved config for this slot (with fallbacks)
const savedConfig = progression.getSlotConfig(props.slot)

// Selected options - initialized from saved config
const selectedRace = ref(savedConfig.race)
const selectedClass = ref(savedConfig.class)
const selectedPersonality = ref<Personality>(savedConfig.personality)

// Custom personality sliders
const customPersonality = ref<PersonalityConfig>(
  savedConfig.customPersonality ?? getPersonalityConfig('cautious')
)

// Surf level range
const surfRangeStart = ref(savedConfig.surfLevelRange?.start ?? 0)
const surfRangeEnd = ref(savedConfig.surfLevelRange?.end ?? 0)

// Depth gate offset
const depthGateOffset = ref(savedConfig.depthGateOffset ?? 0)

// Update depth gate to class default when switching class
watch(selectedClass, (cls) => {
  if (cls === 'Random') {
    depthGateOffset.value = 0
    return
  }
  const tier = getClassTier(cls.toLowerCase())
  if (tier === 'TANK') {
    depthGateOffset.value = -4
  } else if (tier === 'SQUISHY') {
    const bonuses = computeUpgradeBonuses(progression.upgradeLevels)
    const upgradeTier = getUpgradeTier(bonuses)
    const offsets = [5, 4, 3, 1, 0] // none → early → mid → late → full
    depthGateOffset.value = offsets[upgradeTier] ?? 5
  } else {
    depthGateOffset.value = 0
  }
})

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

// Available options: chooseable (purchased) races/classes for explicit selection
const chooseableRaces = computed(() => progression.chooseableRaces)
const chooseableClasses = computed(() => progression.chooseableClasses)

// Random pool for display when Random is selected
const randomPoolRaces = computed(() => progression.availableRaces)
const randomPoolClasses = computed(() => progression.availableClasses)

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

function buildBoosterOptions(otherSlot: string | null) {
  return [
    { value: null, label: '— None —' },
    ...unlockedBoosters.value.map((b) => ({
      value: b.id,
      label: b.name,
      icon: b.icon,
      disabled: b.id === otherSlot,
    })),
  ]
}

const boosterSlot0Options = computed(() => buildBoosterOptions(boosterSlot1.value))
const boosterSlot1Options = computed(() => buildBoosterOptions(boosterSlot0.value))

const personalities = (
  Object.entries(PERSONALITY_DISPLAY) as [Personality, (typeof PERSONALITY_DISPLAY)[Personality]][]
)
  .filter(([id]) => id !== 'custom')
  .map(([id, p]) => ({ id, name: p.name, desc: p.desc }))

// Custom personality — unlocked sliders based on bot upgrade levels
const unlockedSliders = computed(() => {
  const caps = progression.botCapabilities
  return (
    Object.entries(SLIDER_UPGRADE_GATES) as [
      keyof PersonalityConfig,
      { field: string; level: number },
    ][]
  )
    .filter(([, gate]) => {
      const capValue = caps[gate.field as keyof typeof caps]
      return typeof capValue === 'number' && capValue >= gate.level
    })
    .map(([key]) => key)
})

const hasAnySlider = computed(() => unlockedSliders.value.length > 0)

const allSliderKeys = computed(() => Object.keys(PARAMETER_INFO) as (keyof PersonalityConfig)[])

function isSliderUnlocked(key: keyof PersonalityConfig): boolean {
  return unlockedSliders.value.includes(key)
}

function getSliderGateHint(key: keyof PersonalityConfig): string {
  const gate = SLIDER_UPGRADE_GATES[key]
  const name = gate.field.charAt(0).toUpperCase() + gate.field.slice(1)
  return `Requires ${name} ${romanNumeral(gate.level)}`
}

function romanNumeral(n: number): string {
  return n === 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n)
}

function selectPersonality(id: Personality) {
  // When switching from preset to custom, seed sliders from that preset
  if (id === 'custom' && selectedPersonality.value !== 'custom') {
    const presetConfig = getPersonalityConfig(selectedPersonality.value)
    customPersonality.value = { ...presetConfig }
  }
  selectedPersonality.value = id
}

function seedFromPreset(id: Personality) {
  customPersonality.value = { ...getPersonalityConfig(id) }
}

const personalitySummary = computed(() =>
  selectedPersonality.value === 'custom' ? summarizePersonality(customPersonality.value) : ''
)

// Section summaries for collapsed accordion headers on mobile
const raceHeaderSummary = computed(() => {
  if (selectedRace.value === 'Random') return `Random · ${randomPoolRaces.value.length} in pool`
  return selectedRace.value
})

const classHeaderSummary = computed(() => {
  if (selectedClass.value === 'Random') return `Random · ${randomPoolClasses.value.length} in pool`
  return selectedClass.value
})

const boostersHeaderSummary = computed(() => {
  const names = [boosterSlot0.value, boosterSlot1.value]
    .map((id) => (id ? getBoosterById(id)?.name : null))
    .filter((n): n is string => !!n)
  return names.length > 0 ? names.join(' · ') : 'None'
})

const bonusesHeaderSummary = computed(() => {
  const count = activeBonuses.value.length
  const hasPerf = configPerformance.value && configPerformance.value.runCount >= 3
  if (count === 0 && !hasPerf) return 'None'
  if (count === 0) return `History · ${configPerformance.value?.runCount} runs`
  return `${count} bonus${count === 1 ? '' : 'es'}`
})

const personalityHeaderSummary = computed(() => {
  if (selectedPersonality.value === 'custom') return 'Custom'
  return PERSONALITY_DISPLAY[selectedPersonality.value]?.name ?? selectedPersonality.value
})

const controlsHeaderSummary = computed(() => {
  const parts: string[] = []
  if (globalCaps.value.preparedness >= 2 && depthGateOffset.value !== 0) {
    parts.push(`Gate ${depthGateOffset.value > 0 ? '+' : ''}${depthGateOffset.value}`)
  }
  if (globalCaps.value.surf > 0 && (surfRangeStart.value > 0 || surfRangeEnd.value > 0)) {
    parts.push(`Surf ${surfRangeStart.value}–${surfRangeEnd.value}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Defaults'
})

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

// Per-slot bot controls - toggles and active levels
const globalCaps = computed(() => progression.botCapabilities)
const slotConfig = computed(() => progression.getSlotConfig(props.slot))
const activeSurfLevel = computed(() => slotConfig.value.activeSurfLevel ?? globalCaps.value.surf)

const depthGateLabel = computed(() => {
  const v = depthGateOffset.value
  if (v === 0) return '0 (Normal)'
  return `${v > 0 ? '+' : ''}${v}`
})

const depthGateClass = computed(() => {
  const v = depthGateOffset.value
  if (v < 0) return 'gate-reckless'
  if (v > 0) return 'gate-cautious'
  return ''
})

const surfLabels: Record<number, string> = { 1: '5x5', 2: '9x9', 3: '21x21' }

function setActiveSurf(level: number) {
  progression.setActiveGradedLevel(props.slot, 'surf', level)
}

function handleStart() {
  // Save the config for this slot before starting
  const currentConfig = progression.getSlotConfig(props.slot)
  progression.saveSlotConfig(props.slot, {
    ...currentConfig,
    race: selectedRace.value,
    class: selectedClass.value,
    personality: selectedPersonality.value,
    boosters: [boosterSlot0.value, boosterSlot1.value],
    surfLevelRange: { start: surfRangeStart.value, end: surfRangeEnd.value },
    depthGateOffset: depthGateOffset.value,
    customPersonality:
      selectedPersonality.value === 'custom' ? { ...customPersonality.value } : undefined,
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
        <PanelFrame
          class="selection-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('race') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('race')"
          >
            <span class="section-title">Race</span>
            <span v-if="!isOpen('race')" class="section-summary">{{ raceHeaderSummary }}</span>
            <span class="section-chevron" :class="{ open: isOpen('race') }">›</span>
          </button>
          <h3 v-else>Race</h3>
          <div v-show="isOpen('race')" class="section-body">
            <div class="option-grid">
              <button
                class="option-btn random-btn"
                :class="{ active: selectedRace === 'Random' }"
                @click="selectedRace = 'Random'"
              >
                ? Random
              </button>
              <button
                v-for="race in chooseableRaces"
                :key="race"
                class="option-btn"
                :class="{ active: selectedRace === race }"
                @click="selectedRace = race"
              >
                {{ race }}
              </button>
            </div>
            <!-- Random Pool Info -->
            <div v-if="selectedRace === 'Random'" class="selection-details">
              <div class="details-desc">Randomly picks from the pool each run.</div>
              <div class="pool-list">
                <span class="pool-label">Pool:</span>
                <span v-for="name in randomPoolRaces" :key="name" class="pool-tag">{{ name }}</span>
              </div>
            </div>
            <!-- Race Description -->
            <div v-else-if="selectedRaceData" class="selection-details">
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
          </div>
        </PanelFrame>

        <!-- Class Selection -->
        <PanelFrame
          class="selection-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('class') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('class')"
          >
            <span class="section-title">Class</span>
            <span v-if="!isOpen('class')" class="section-summary">{{ classHeaderSummary }}</span>
            <span class="section-chevron" :class="{ open: isOpen('class') }">›</span>
          </button>
          <h3 v-else>Class</h3>
          <div v-show="isOpen('class')" class="section-body">
            <div class="option-grid">
              <button
                class="option-btn random-btn"
                :class="{ active: selectedClass === 'Random' }"
                @click="selectedClass = 'Random'"
              >
                ? Random
              </button>
              <button
                v-for="cls in chooseableClasses"
                :key="cls"
                class="option-btn"
                :class="{ active: selectedClass === cls }"
                @click="selectedClass = cls"
              >
                {{ cls }}
              </button>
            </div>
            <!-- Random Pool Info -->
            <div v-if="selectedClass === 'Random'" class="selection-details">
              <div class="details-desc">Randomly picks from the pool each run.</div>
              <div class="pool-list">
                <span class="pool-label">Pool:</span>
                <span v-for="name in randomPoolClasses" :key="name" class="pool-tag">{{
                  name
                }}</span>
              </div>
            </div>
            <!-- Class Description -->
            <div v-else-if="selectedClassData" class="selection-details">
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
          </div>
        </PanelFrame>

        <!-- Booster Selection -->
        <PanelFrame
          v-if="unlockedBoosters.length > 0"
          class="selection-section booster-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('boosters') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('boosters')"
          >
            <span class="section-title">Boosters <span class="booster-hint">(max 2)</span></span>
            <span v-if="!isOpen('boosters')" class="section-summary">{{
              boostersHeaderSummary
            }}</span>
            <span class="section-chevron" :class="{ open: isOpen('boosters') }">›</span>
          </button>
          <h3 v-else>Boosters <span class="booster-hint">(max 2)</span></h3>
          <div v-show="isOpen('boosters')" class="section-body">
            <div class="booster-slots">
              <div class="booster-slot">
                <span class="slot-label">Slot 1</span>
                <IconSelect
                  v-model="boosterSlot0"
                  :options="boosterSlot0Options"
                  placeholder="— None —"
                  aria-label="Booster slot 1"
                />
                <span v-if="getBoosterInfo(boosterSlot0)" class="booster-desc">
                  {{ getBoosterInfo(boosterSlot0)?.description }}
                </span>
              </div>
              <div class="booster-slot">
                <span class="slot-label">Slot 2</span>
                <IconSelect
                  v-model="boosterSlot1"
                  :options="boosterSlot1Options"
                  placeholder="— None —"
                  aria-label="Booster slot 2"
                />
                <span v-if="getBoosterInfo(boosterSlot1)" class="booster-desc">
                  {{ getBoosterInfo(boosterSlot1)?.description }}
                </span>
              </div>
            </div>
          </div>
        </PanelFrame>

        <!-- Active Bonuses & Config Performance -->
        <PanelFrame
          v-if="activeBonuses.length > 0 || (configPerformance && configPerformance.runCount >= 3)"
          class="bonuses-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('bonuses') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('bonuses')"
          >
            <span class="section-title">Active Bonuses</span>
            <span v-if="!isOpen('bonuses')" class="section-summary">{{
              bonusesHeaderSummary
            }}</span>
            <span class="section-chevron" :class="{ open: isOpen('bonuses') }">›</span>
          </button>
          <h3 v-else>Active Bonuses</h3>
          <div v-show="isOpen('bonuses')" class="section-body">
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
                  <span class="perf-value"
                    ><Icon :name="Icons.essence" />{{
                      configPerformance.avgEssence.toFixed(0)
                    }}</span
                  >
                  <span class="perf-label">avg</span>
                </div>
                <div class="perf-stat best">
                  <span class="perf-value">D:{{ configPerformance.bestDepth }}</span>
                  <span class="perf-label">best</span>
                </div>
              </div>
            </div>
          </div>
        </PanelFrame>
      </div>

      <!-- Right Column: Personality + Bot Training -->
      <div class="training-column">
        <!-- Personality Selection -->
        <PanelFrame
          class="selection-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('personality') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('personality')"
          >
            <span class="section-title">Bot Personality</span>
            <span v-if="!isOpen('personality')" class="section-summary">{{
              personalityHeaderSummary
            }}</span>
            <span class="section-chevron" :class="{ open: isOpen('personality') }">›</span>
          </button>
          <h3 v-else>Bot Personality</h3>
          <div v-show="isOpen('personality')" class="section-body">
            <div class="personality-list">
              <!-- Compact 2x2 preset grid when Custom is active -->
              <div v-if="selectedPersonality === 'custom'" class="preset-grid">
                <button
                  v-for="p in personalities"
                  :key="p.id"
                  class="preset-seed-btn"
                  @click="seedFromPreset(p.id)"
                >
                  {{ p.name }}
                </button>
              </div>
              <!-- Full preset list when not in Custom mode -->
              <template v-else>
                <button
                  v-for="p in personalities"
                  :key="p.id"
                  class="personality-btn"
                  :class="{ active: selectedPersonality === p.id }"
                  @click="selectPersonality(p.id)"
                >
                  <span class="personality-name">{{ p.name }}</span>
                  <span class="personality-desc">{{ p.desc }}</span>
                </button>
              </template>
              <button
                v-if="hasAnySlider"
                class="personality-btn custom-btn"
                :class="{ active: selectedPersonality === 'custom' }"
                @click="selectPersonality('custom')"
              >
                <span class="personality-name">Custom</span>
                <span class="personality-desc">Player-tuned sliders</span>
              </button>
            </div>

            <!-- Custom Personality Sliders -->
            <div v-if="selectedPersonality === 'custom'" class="custom-sliders">
              <div
                v-for="key in allSliderKeys"
                :key="key"
                class="slider-row"
                :class="{ locked: !isSliderUnlocked(key) }"
              >
                <span class="slider-label">{{ PARAMETER_INFO[key].name }}</span>
                <input
                  v-if="isSliderUnlocked(key)"
                  type="range"
                  class="param-slider"
                  :min="PARAMETER_INFO[key].min"
                  :max="PARAMETER_INFO[key].max"
                  :value="customPersonality[key]"
                  @input="
                    customPersonality[key] = Number(($event.target as HTMLInputElement).value)
                  "
                />
                <input
                  v-else
                  type="range"
                  class="param-slider"
                  :min="PARAMETER_INFO[key].min"
                  :max="PARAMETER_INFO[key].max"
                  :value="customPersonality[key]"
                  disabled
                />
                <span class="slider-value">
                  {{ customPersonality[key] }}{{ PARAMETER_INFO[key].unit }}
                </span>
                <span v-if="!isSliderUnlocked(key)" class="slider-lock-hint">
                  {{ getSliderGateHint(key) }}
                </span>
              </div>
              <div v-if="personalitySummary" class="personality-summary">
                {{ personalitySummary }}
              </div>
            </div>
          </div>
        </PanelFrame>

        <!-- Per-slot Bot Controls -->
        <PanelFrame
          class="selection-section"
          :class="{ collapsible: isMobile, collapsed: isMobile && !isOpen('controls') }"
        >
          <button
            v-if="isMobile"
            type="button"
            class="section-toggle"
            @click="toggleSection('controls')"
          >
            <span class="section-title">Bot Controls</span>
            <span v-if="!isOpen('controls')" class="section-summary">{{
              controlsHeaderSummary
            }}</span>
            <span class="section-chevron" :class="{ open: isOpen('controls') }">›</span>
          </button>
          <h3 v-else>Bot Controls</h3>
          <div v-show="isOpen('controls')" class="section-body">
            <div class="slot-controls">
              <!-- Depth Gate Offset (visible when preparedness >= 2) -->
              <div v-if="globalCaps.preparedness >= 2" class="depth-gate-row">
                <div class="depth-gate-header">
                  <span class="control-label">Depth Gate</span>
                  <span class="depth-gate-value" :class="depthGateClass">
                    {{ depthGateLabel }}
                  </span>
                </div>
                <input
                  v-model.number="depthGateOffset"
                  type="range"
                  class="depth-gate-slider"
                  min="-5"
                  max="5"
                  step="1"
                />
                <div class="depth-gate-labels">
                  <span>Reckless</span>
                  <span>Normal</span>
                  <span>Cautious</span>
                </div>
              </div>
              <!-- Surf Farming -->
              <div v-if="globalCaps.surf > 0" class="control-row">
                <span class="control-label">Surf Farming</span>
                <span class="control-hint">Flip depths for respawns, farm near stairs</span>
              </div>
              <!-- Surf Level Range -->
              <div v-if="globalCaps.surf > 0" class="range-row">
                <span class="control-label">Surf Range</span>
                <div class="range-inputs">
                  <input
                    v-model.number="surfRangeStart"
                    type="number"
                    class="range-input"
                    min="0"
                    max="50"
                    placeholder="0"
                  />
                  <span class="range-sep">-</span>
                  <input
                    v-model.number="surfRangeEnd"
                    type="number"
                    class="range-input"
                    min="0"
                    max="50"
                    placeholder="0"
                  />
                </div>
                <span class="range-hint">Char levels (0-0 = always)</span>
                <div class="level-selector">
                  <button
                    v-for="n in globalCaps.surf"
                    :key="n"
                    class="level-btn"
                    :class="{ selected: activeSurfLevel === n }"
                    @click="setActiveSurf(n)"
                  >
                    {{ surfLabels[n] }}
                  </button>
                </div>
              </div>
              <!-- No controls message -->
              <div
                v-if="!globalCaps.farming && globalCaps.surf === 0 && globalCaps.preparedness < 2"
                class="no-controls"
              >
                Purchase bot upgrades in Upgrades → Bot
              </div>
            </div>
          </div>
        </PanelFrame>
      </div>
    </div>

    <footer class="editor-footer">
      <button class="cancel-btn" @click="handleCancel">Cancel</button>
      <button class="start-btn" @click="handleStart">
        <Icon class="start-icon" :name="isQueueMode ? Icons.autoRestart : Icons.play" />
        {{ isQueueMode ? 'Queue for next run' : 'Start Run' }}
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
  background: var(--bg-panel);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.editor-header h2 {
  font-size: var(--text-xl);
  font-weight: bold;
  color: var(--text-primary);
  margin: 0;
}

.slot-badge {
  font-size: var(--text-base);
  padding: var(--space-1) var(--space-3);
  background: var(--bg-highlight);
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
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.training-column {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.selection-section {
  padding: var(--space-4) !important;
}

.selection-section h3 {
  font-size: var(--text-base);
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
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.option-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.option-btn.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.option-btn.random-btn {
  font-style: italic;
}

.pool-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.pool-label {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.pool-tag {
  font-size: var(--text-base);
  padding: 2px var(--space-2);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
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
  font-size: var(--text-base);
}

.stat-positive {
  color: var(--success);
}

.stat-negative {
  color: var(--danger);
}

.stat-neutral {
  color: var(--text-dim);
}

.stat-info {
  color: var(--info);
}

.stat-xp {
  color: var(--warning);
}

.stat-magic {
  color: var(--essence);
  padding: 1px var(--space-1);
  background: color-mix(in srgb, var(--essence) 15%, transparent);
  border-radius: var(--radius-sm);
}

.details-desc {
  font-size: var(--text-base);
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
  font-size: var(--text-base);
  padding: 3px 6px;
  background: color-mix(in srgb, var(--info) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--info) 30%, transparent);
  border-radius: var(--radius-md);
  color: var(--info);
  cursor: help;
}

.ability-tag:hover {
  background: color-mix(in srgb, var(--info) 20%, transparent);
  border-color: var(--info);
}

.details-behavior {
  font-size: var(--text-base);
  color: var(--text-secondary);
  line-height: 1.4;
}

.behavior-label {
  color: var(--essence);
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
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.personality-btn:hover {
  border-color: var(--essence);
}

.personality-btn.active {
  background: color-mix(in srgb, var(--essence) 15%, transparent);
  border-color: var(--essence);
}

.personality-name {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-primary);
}

.personality-btn.active .personality-name {
  color: var(--essence);
}

.personality-desc {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

/* Compact 2x2 preset grid (shown when Custom is active) */
.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.preset-seed-btn {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.preset-seed-btn:hover {
  border-color: var(--essence);
  color: var(--text-primary);
  background: color-mix(in srgb, var(--essence) 10%, transparent);
}

.bonuses-section {
  padding: var(--space-4) !important;
}

.bonuses-section h3 {
  font-size: var(--text-base);
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
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.bonus-value {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--success);
}

.no-bonuses {
  font-size: var(--text-base);
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
  font-size: var(--text-base);
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
  font-size: var(--text-lg);
  font-weight: bold;
  color: var(--info);
}

.perf-stat.best .perf-value {
  color: var(--warning);
}

.perf-label {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
}

.cancel-btn {
  padding: var(--space-3) var(--space-5);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
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
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  font-weight: bold;
  color: white;
  cursor: pointer;
  transition: all 0.2s;
}

.start-btn:hover {
  background: var(--accent-hover);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 40%, transparent);
}

.start-icon {
  font-size: var(--text-base);
}

/* Booster Section */
.booster-section h3 {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.booster-hint {
  font-size: var(--text-base);
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
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.booster-desc {
  font-size: var(--text-base);
  color: var(--essence);
  font-style: italic;
}

/* Per-slot Bot Controls */
.slot-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.control-row:last-child {
  border-bottom: none;
}

.control-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
}

.control-hint {
  width: 100%;
  order: 3;
  font-size: var(--text-sm);
  color: var(--text-dim);
  font-style: italic;
}

.control-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.toggle-btn {
  padding: var(--space-1) var(--space-3);
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: color-mix(in srgb, var(--success) 20%, transparent);
  border-color: var(--success);
  color: var(--success);
}

.toggle-btn:hover {
  border-color: var(--text-secondary);
}

.level-selector {
  display: flex;
  gap: 2px;
  margin-left: auto;
}

.level-btn {
  min-width: 32px;
  height: 26px;
  padding: 2px var(--space-1);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.level-btn:hover {
  border-color: var(--text-secondary);
}

.level-btn.selected {
  background: color-mix(in srgb, var(--info) 20%, transparent);
  border-color: var(--info);
  color: var(--info);
}

.no-controls {
  font-size: var(--text-base);
  color: var(--text-dim);
  font-style: italic;
  padding: var(--space-2) 0;
}

/* Custom Personality Sliders */
.custom-btn {
  border-style: dashed;
}

.custom-sliders {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}

.slider-row.locked {
  opacity: 0.4;
}

.slider-label {
  font-size: var(--text-base);
  color: var(--text-secondary);
  min-width: 90px;
}

.param-slider {
  flex: 1;
  accent-color: var(--essence);
  cursor: pointer;
}

.param-slider:disabled {
  cursor: not-allowed;
}

.slider-value {
  font-size: var(--text-base);
  color: var(--info);
  min-width: 50px;
  text-align: right;
}

.slider-lock-hint {
  font-size: var(--text-base);
  color: var(--text-dim);
  font-style: italic;
  position: absolute;
  right: 0;
  top: -2px;
}

.personality-summary {
  font-size: var(--text-base);
  color: var(--text-dim);
  font-style: italic;
  margin-top: var(--space-1);
}

/* Depth Gate Slider */
.depth-gate-row {
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--border);
}

.depth-gate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-1);
}

.depth-gate-value {
  font-size: var(--text-base);
  font-weight: bold;
  color: var(--text-secondary);
}

.depth-gate-value.gate-reckless {
  color: var(--danger);
}

.depth-gate-value.gate-cautious {
  color: var(--info);
}

.depth-gate-slider {
  width: 100%;
  accent-color: var(--accent);
  cursor: pointer;
}

.depth-gate-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--text-base);
  color: var(--text-dim);
}

/* Sweep/Surf Range Inputs */
.range-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.range-input {
  width: 48px;
  padding: 2px var(--space-1);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  color: var(--text-primary);
  text-align: center;
}

.range-input:focus {
  outline: none;
  border-color: var(--info);
}

.range-sep {
  color: var(--text-dim);
}

.range-hint {
  font-size: var(--text-base);
  color: var(--text-dim);
}

/* Accordion (mobile variant) */
.section-body {
  display: contents;
}

.section-toggle {
  display: none;
  width: 100%;
  align-items: center;
  gap: var(--space-2);
  padding: 0;
  margin: 0 0 var(--space-3);
  background: transparent;
  border: none;
  color: var(--text-dim);
  font-size: var(--text-base);
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  text-align: left;
}

.section-toggle .section-title {
  color: var(--text-dim);
  flex-shrink: 0;
}

.section-toggle .section-summary {
  flex: 1;
  min-width: 0;
  font-size: var(--text-base);
  color: var(--text-secondary);
  text-transform: none;
  letter-spacing: 0;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-toggle .section-chevron {
  flex-shrink: 0;
  font-size: var(--text-lg);
  color: var(--text-dim);
  transition: transform 0.15s;
  display: inline-block;
}

.section-toggle .section-chevron.open {
  transform: rotate(90deg);
}

.collapsible .section-body {
  display: block;
}

.collapsed {
  padding-bottom: var(--space-3) !important;
}

.collapsed .section-toggle {
  margin-bottom: 0;
}

@media (max-width: 720px) {
  .editor-header {
    display: none;
  }

  .editor-content {
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .config-column,
  .training-column {
    flex: initial;
    gap: var(--space-3);
  }

  .selection-section,
  .bonuses-section {
    padding: var(--space-3) !important;
  }

  .section-toggle {
    display: flex;
  }

  .editor-footer {
    position: sticky;
    bottom: 0;
    z-index: 2;
    padding: var(--space-3);
    padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
  }

  .cancel-btn {
    display: none;
  }

  .start-btn {
    flex: 1;
    justify-content: center;
    padding: var(--space-3);
  }

  /* Custom slider rows: keep lock hint inline below */
  .slider-row {
    flex-wrap: wrap;
  }

  .slider-lock-hint {
    position: static;
    width: 100%;
    flex-basis: 100%;
    text-align: right;
  }

  /* Booster slots stack vertically on narrow screens */
  .booster-slots {
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Config performance grid wraps */
  .perf-grid {
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  /* Option grid touch targets */
  .option-btn {
    padding: var(--space-2) var(--space-3);
    min-height: 36px;
  }
}
</style>
