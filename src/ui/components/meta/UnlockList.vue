<script setup lang="ts">
import { ref, computed } from 'vue'
import { TabsRoot, TabsList, TabsTrigger } from 'reka-ui'
import { useProgressionStore } from '@/stores/progression'
import { getBoosterById } from '@game/data/boosters'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import UnlockItem from './UnlockItem.vue'

const progression = useProgressionStore()

type Tab = 'races' | 'classes' | 'boosters'

const activeTab = ref<Tab>('boosters')

const currentUnlocks = computed(() => {
  if (activeTab.value === 'races') {
    return progression.raceUnlocks.map((r) => ({ ...r, type: 'race' as const }))
  }
  if (activeTab.value === 'classes') {
    return progression.classUnlocks.map((c) => ({ ...c, type: 'class' as const }))
  }
  return []
})

const boosterCategories: { key: 'equipment' | 'stats' | 'special'; label: string }[] = [
  { key: 'equipment', label: 'Equipment' },
  { key: 'stats', label: 'Stats' },
  { key: 'special', label: 'Special' },
]

const unlockedCount = computed(() => {
  if (activeTab.value === 'races') return progression.raceUnlocks.filter((r) => r.isUnlocked).length
  if (activeTab.value === 'classes')
    return progression.classUnlocks.filter((c) => c.isUnlocked).length
  return progression.unlockedBoosters.length
})

const totalCount = computed(() => {
  if (activeTab.value === 'races') return progression.raceUnlocks.length
  if (activeTab.value === 'classes') return progression.classUnlocks.length
  return progression.allBoosters.length
})

function handleRaceClassUnlock(id: string) {
  const item = currentUnlocks.value.find((u) => u.id === id)
  if (!item) return
  if (item.type === 'race') progression.unlockRace(item.name, item.cost)
  else progression.unlockClass(item.name, item.cost)
}

function handleBoosterUnlock(boosterId: string) {
  progression.unlockBooster(boosterId)
}

function getPrereqText(boosterId: string): string | undefined {
  const booster = getBoosterById(boosterId)
  if (!booster?.requires) return undefined
  const prereqs = Array.isArray(booster.requires) ? booster.requires : [booster.requires]
  const names = prereqs
    .map((id) => getBoosterById(id)?.name)
    .filter((name): name is string => name !== undefined)
  return names.length ? names.join(' + ') : undefined
}
</script>

<template>
  <TabsRoot v-model="activeTab" class="unlock-list">
    <TabsList class="unlock-tabs">
      <TabsTrigger value="boosters" class="unlock-tab">
        <Icon class="tab-icon" :name="Icons.boosters" />
        <span class="tab-label">Boosters</span>
      </TabsTrigger>
      <TabsTrigger value="races" class="unlock-tab">
        <Icon class="tab-icon" :name="Icons.races" />
        <span class="tab-label">Races</span>
      </TabsTrigger>
      <TabsTrigger value="classes" class="unlock-tab">
        <Icon class="tab-icon" :name="Icons.classes" />
        <span class="tab-label">Classes</span>
      </TabsTrigger>
    </TabsList>

    <div class="unlock-header">
      <span class="header-text">{{ unlockedCount }} / {{ totalCount }} Unlocked</span>
      <span v-if="activeTab !== 'boosters'" class="codex-hint">
        <Icon class="codex-icon" :name="Icons.heroes" />
        Heroes tab has details
      </span>
    </div>

    <div class="unlocks-scroll">
      <!-- Race / Class -->
      <template v-if="activeTab !== 'boosters'">
        <UnlockItem
          v-for="item in currentUnlocks"
          :id="item.id"
          :key="item.id"
          :name="item.name"
          :description="item.description"
          :is-unlocked="item.isUnlocked"
          :cost="item.cost"
          :can-afford="item.canAfford"
          :unlock-condition="item.unlockCondition"
          :mythic="item.mythic"
          :meets-condition="item.meetsCondition"
          :type="item.type"
          :stats="item.stats"
          :hitdie="item.hitdie"
          :infravision="'infravision' in item ? item.infravision : undefined"
          :exp-penalty="'expPenalty' in item ? item.expPenalty : undefined"
          :abilities="'abilities' in item ? item.abilities : undefined"
          :max-attacks="'maxAttacks' in item ? item.maxAttacks : undefined"
          :primary-stat="'primaryStat' in item ? item.primaryStat : undefined"
          :uses-magic="'usesMagic' in item ? item.usesMagic : undefined"
          :bot-behavior="'botBehavior' in item ? item.botBehavior : undefined"
          @unlock="handleRaceClassUnlock"
        />

        <div v-if="currentUnlocks.length === 0" class="no-unlocks">
          All {{ activeTab }} unlocked!
        </div>
      </template>

      <!-- Boosters -->
      <template v-else>
        <div v-for="cat in boosterCategories" :key="cat.key" class="booster-category">
          <div class="category-header">{{ cat.label }}</div>
          <UnlockItem
            v-for="booster in progression.boostersByCategory[cat.key]"
            :id="booster.id"
            :key="booster.id"
            :name="booster.name"
            :icon="booster.icon"
            :description="booster.description"
            :is-unlocked="booster.isUnlocked"
            :cost="booster.cost"
            :can-afford="booster.canAfford"
            :meets-condition="booster.meetsCondition"
            :prereq="getPrereqText(booster.id)"
            type="booster"
            @unlock="handleBoosterUnlock"
          />
        </div>
      </template>
    </div>
  </TabsRoot>
</template>

<style scoped>
.unlock-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.unlock-tabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
}

.unlock-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-1) var(--space-1);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.unlock-tab:hover {
  background: var(--bg-highlight);
}

.unlock-tab[data-state='active'] {
  background: var(--bg-highlight);
  border-bottom: 2px solid var(--info);
}

.tab-icon {
  font-size: var(--text-xl);
  color: var(--text-dim);
}

.unlock-tab[data-state='active'] .tab-icon {
  color: var(--info);
  text-shadow: 0 0 6px color-mix(in srgb, var(--info) 50%, transparent);
}

.tab-label {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.unlock-tab[data-state='active'] .tab-label {
  color: var(--text-secondary);
}

.unlock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}

.header-text {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.codex-hint {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-dim);
}

.codex-icon {
  font-size: var(--text-base);
}

.unlocks-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.no-unlocks {
  text-align: center;
  padding: var(--space-6);
  color: var(--success);
  font-style: italic;
  font-size: var(--text-base);
}

.booster-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.category-header {
  font-size: var(--text-base);
  color: var(--essence);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: var(--space-2) 0 var(--space-1);
  border-bottom: 1px solid var(--border);
}
</style>
