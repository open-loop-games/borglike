<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProgressionStore } from '@/stores/progression'
import { races, type Race } from '@game/data/races'
import { classes, type GameClass } from '@game/data/classes'
import RaceCard from './RaceCard.vue'
import ClassCard from './ClassCard.vue'
import RaceDetailPanel from './RaceDetailPanel.vue'
import ClassDetailPanel from './ClassDetailPanel.vue'
import { heroCategoryLabel } from './hero-symbols'

const progression = useProgressionStore()

// Tab state
const activeTab = ref<'races' | 'classes'>('races')

// Filter state
const categoryFilter = ref<string>('all')
const sortBy = ref<'unlock' | 'name' | 'wins'>('unlock')
const searchQuery = ref('')

// Selected item for detail panel
const selectedRace = ref<Race | null>(null)
const selectedClass = ref<GameClass | null>(null)

function selectRace(race: Race) {
  selectedRace.value = race
  selectedClass.value = null
}

function selectClass(cls: GameClass) {
  selectedClass.value = cls
  selectedRace.value = null
}

function clearSelection() {
  selectedRace.value = null
  selectedClass.value = null
}

// Categories for filtering
const categories = ['all', 'starting', 'unlockable', 'mythic']

function getCategoryLabel(cat: string): string {
  if (cat === 'all') return 'All Categories'
  if (cat === 'mythic') return heroCategoryLabel('mythic')
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

// Get category for a race/class
function getCategory(item: Race | GameClass): string {
  if (item.mythic) return 'mythic'
  if (item.starting) return 'starting'
  return 'unlockable'
}

// Check if race is unlocked
function isRaceUnlocked(race: Race): boolean {
  return progression.unlocks.races.has(race.name)
}

// Check if class is unlocked
function isClassUnlocked(cls: GameClass): boolean {
  return progression.unlocks.classes.has(cls.name)
}

// Get win count for race
function getRaceWins(race: Race): number {
  return progression.globalStats.victoriesPerRace?.[race.name] ?? 0
}

// Get win count for class
function getClassWins(cls: GameClass): number {
  return progression.globalStats.victoriesPerClass?.[cls.name] ?? 0
}

// Filter and sort races
const filteredRaces = computed(() => {
  let result = [...races]

  // Apply category filter
  if (categoryFilter.value !== 'all') {
    result = result.filter((r) => getCategory(r) === categoryFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((r) => r.name.toLowerCase().includes(query))
  }

  // Sort
  switch (sortBy.value) {
    case 'unlock':
      // Starting first, then unlockable, then mythic. Unlocked before locked within each.
      result.sort((a, b) => {
        const orderA = a.starting ? 0 : a.mythic ? 2 : 1
        const orderB = b.starting ? 0 : b.mythic ? 2 : 1
        if (orderA !== orderB) return orderA - orderB
        const unlockedA = isRaceUnlocked(a) ? 0 : 1
        const unlockedB = isRaceUnlocked(b) ? 0 : 1
        if (unlockedA !== unlockedB) return unlockedA - unlockedB
        return a.name.localeCompare(b.name)
      })
      break
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'wins':
      result.sort((a, b) => getRaceWins(b) - getRaceWins(a))
      break
  }

  return result
})

// Filter and sort classes
const filteredClasses = computed(() => {
  let result = [...classes]

  // Apply category filter
  if (categoryFilter.value !== 'all') {
    result = result.filter((c) => getCategory(c) === categoryFilter.value)
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((c) => c.name.toLowerCase().includes(query))
  }

  // Sort
  switch (sortBy.value) {
    case 'unlock':
      result.sort((a, b) => {
        const orderA = a.starting ? 0 : a.mythic ? 2 : 1
        const orderB = b.starting ? 0 : b.mythic ? 2 : 1
        if (orderA !== orderB) return orderA - orderB
        const unlockedA = isClassUnlocked(a) ? 0 : 1
        const unlockedB = isClassUnlocked(b) ? 0 : 1
        if (unlockedA !== unlockedB) return unlockedA - unlockedB
        return a.name.localeCompare(b.name)
      })
      break
    case 'name':
      result.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'wins':
      result.sort((a, b) => getClassWins(b) - getClassWins(a))
      break
  }

  return result
})

// Discovery stats
const raceStats = computed(() => {
  const unlocked = races.filter((r) => isRaceUnlocked(r)).length
  return { unlocked, total: races.length }
})

const classStats = computed(() => {
  const unlocked = classes.filter((c) => isClassUnlocked(c)).length
  return { unlocked, total: classes.length }
})

// Clear filter when switching tabs
function switchTab(tab: 'races' | 'classes') {
  activeTab.value = tab
  clearSelection()
}
</script>

<template>
  <div class="heroes-panel">
    <div class="subtab-bar">
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'races' }"
        @click="switchTab('races')"
      >
        Races ({{ raceStats.unlocked }}/{{ raceStats.total }})
      </button>
      <button
        class="subtab-btn"
        :class="{ active: activeTab === 'classes' }"
        @click="switchTab('classes')"
      >
        Classes ({{ classStats.unlocked }}/{{ classStats.total }})
      </button>
    </div>

    <div class="filter-bar">
      <select v-model="categoryFilter" class="filter-select">
        <option v-for="cat in categories" :key="cat" :value="cat">
          {{ getCategoryLabel(cat) }}
        </option>
      </select>
      <select v-model="sortBy" class="filter-select">
        <option value="unlock">Sort by Unlock</option>
        <option value="name">Sort by Name</option>
        <option value="wins">Sort by Wins</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="activeTab === 'races' ? 'Search races...' : 'Search classes...'"
      />
    </div>

    <div class="panel-body">
      <div class="panel-content">
        <!-- Races Grid -->
        <div v-if="activeTab === 'races'" class="card-grid">
          <RaceCard
            v-for="race in filteredRaces"
            :key="race.id"
            :race="race"
            :unlocked="isRaceUnlocked(race)"
            :wins="getRaceWins(race)"
            :class="{ selected: selectedRace?.id === race.id }"
            @click="selectRace(race)"
          />
        </div>

        <!-- Classes Grid -->
        <div v-else class="card-grid">
          <ClassCard
            v-for="cls in filteredClasses"
            :key="cls.id"
            :game-class="cls"
            :unlocked="isClassUnlocked(cls)"
            :wins="getClassWins(cls)"
            :class="{ selected: selectedClass?.id === cls.id }"
            @click="selectClass(cls)"
          />
        </div>
      </div>

      <!-- Detail Panel -->
      <RaceDetailPanel
        v-if="selectedRace"
        :race="selectedRace"
        :unlocked="isRaceUnlocked(selectedRace)"
        :wins="getRaceWins(selectedRace)"
        @close="clearSelection"
      />
      <ClassDetailPanel
        v-if="selectedClass"
        :game-class="selectedClass"
        :unlocked="isClassUnlocked(selectedClass)"
        :wins="getClassWins(selectedClass)"
        @close="clearSelection"
      />
    </div>
  </div>
</template>

<style scoped>
.heroes-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.subtab-bar {
  display: flex;
  gap: 0;
  padding: 0 var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.subtab-btn {
  padding: var(--space-3) var(--space-5);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.subtab-btn:hover {
  color: var(--text-primary);
}

.subtab-btn.active {
  color: var(--essence);
  border-bottom-color: var(--essence);
}

.filter-bar {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.filter-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--essence);
}

.search-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
}

.search-input:focus {
  outline: none;
  border-color: var(--essence);
}

.search-input::placeholder {
  color: var(--text-dim);
}

.panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}

/* Selected card highlight */
.card-grid :deep(.race-card.selected),
.card-grid :deep(.class-card.selected) {
  outline: 2px solid var(--essence);
  outline-offset: -2px;
}

.card-grid :deep(.race-card.selected.mythic),
.card-grid :deep(.class-card.selected.mythic) {
  outline-color: var(--warning);
}
</style>
