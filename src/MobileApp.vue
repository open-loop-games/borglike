<script setup lang="ts">
import { ref, shallowRef, onMounted, type Component } from 'vue'
import MobileHeader from './ui/mobile/MobileHeader.vue'
import MobileTabBar, { type MobileTab } from './ui/mobile/MobileTabBar.vue'
import MobilePageStack, { type PageEntry } from './ui/mobile/MobilePageStack.vue'
import MobileRunList from './ui/mobile/MobileRunList.vue'
import MobileMoreMenu from './ui/mobile/MobileMoreMenu.vue'
import UpgradeList from './ui/components/meta/UpgradeList.vue'
import UnlockList from './ui/components/meta/UnlockList.vue'
import StatsView from './ui/components/StatsView.vue'
import RunPanelExpanded from './ui/components/game/RunPanelExpanded.vue'
import LoadoutEditor from './ui/components/game/LoadoutEditor.vue'
import CompendiumModal, { type CompendiumTab } from './ui/components/compendium/CompendiumModal.vue'
import SettingsPanel from './ui/components/settings/SettingsPanel.vue'
import CatchUpOverlay from './ui/components/overlay/CatchUpOverlay.vue'
import { useEngineStateStore } from './stores/engine-state'
import { useRunsStore } from './stores/runs'
import { useKeyboard } from './ui/composables/use-keyboard'
import { initPersistence } from './ui/composables/use-persistence'
import { useGameTitle } from './ui/composables/use-game-title'
import { useThemeEffects } from './ui/composables/use-theme-effects'
import { startRun, setSlotConfiguring } from './engine/instance-manager'
import type { Personality } from './types/events'

const isLoaded = ref(false)

useKeyboard()
useGameTitle()
useThemeEffects()
const engineState = useEngineStateStore()
const runs = useRunsStore()

onMounted(async () => {
  await initPersistence()
  isLoaded.value = true
})

// Tab state
const activeTab = ref<MobileTab>('runs')

// Page stack state
const pageStack = shallowRef<PageEntry[]>([])

function pushPage(component: Component, props?: Record<string, unknown>, landscape = false) {
  pageStack.value = [...pageStack.value, { component, props, landscape }]
}

function popPage() {
  pageStack.value = pageStack.value.slice(0, -1)
}

function handleTabChange(tab: MobileTab) {
  activeTab.value = tab
  pageStack.value = []
}

// Run list handlers
function handleExpandRun(slotIndex: number) {
  const run = runs.getRunBySlot(slotIndex)
  if (run) {
    pushPage(RunPanelExpanded, { run }, true)
  }
}

// Loadout editor — handled as a direct overlay, not in page stack,
// because it emits start/cancel which need special handling
const loadoutSlot = ref<number | null>(null)

function handleOpenLoadout(slotIndex: number) {
  setSlotConfiguring(slotIndex, true)
  loadoutSlot.value = slotIndex
}

function handleLoadoutStart(config: { race: string; class: string; personality: Personality }) {
  if (loadoutSlot.value !== null) {
    setSlotConfiguring(loadoutSlot.value, false)
    startRun(loadoutSlot.value, config)
    loadoutSlot.value = null
  }
}

function handleLoadoutCancel() {
  if (loadoutSlot.value !== null) {
    setSlotConfiguring(loadoutSlot.value, false)
    loadoutSlot.value = null
  }
}

// More menu navigation
const COMPENDIUM_TABS: readonly CompendiumTab[] = [
  'history',
  'achievements',
  'bestiary',
  'armory',
  'heroes',
  'guide',
]

function handleMoreNavigate(target: string) {
  if (target === 'settings') {
    pushPage(SettingsPanel)
    return
  }
  if ((COMPENDIUM_TABS as readonly string[]).includes(target)) {
    pushPage(CompendiumModal, { initialTab: target as CompendiumTab })
  }
}
</script>

<template>
  <div v-if="!isLoaded" class="loading-screen">
    <div class="loading-content">
      <div class="loading-title">Borglike</div>
      <div class="loading-text">Loading...</div>
    </div>
  </div>

  <div v-else class="mobile-layout">
    <MobileHeader />

    <main class="mobile-content">
      <!-- Runs tab -->
      <MobileRunList
        v-if="activeTab === 'runs'"
        @expand-run="handleExpandRun"
        @open-loadout="handleOpenLoadout"
      />

      <!-- Upgrades tab -->
      <div v-else-if="activeTab === 'upgrades'" class="tab-page">
        <UpgradeList />
      </div>

      <!-- Unlocks tab -->
      <div v-else-if="activeTab === 'unlocks'" class="tab-page">
        <UnlockList />
      </div>

      <!-- Stats tab -->
      <div v-else-if="activeTab === 'stats'" class="tab-page scrollable">
        <StatsView />
      </div>

      <!-- More tab -->
      <MobileMoreMenu v-else-if="activeTab === 'more'" @navigate="handleMoreNavigate" />
    </main>

    <MobileTabBar :active-tab="activeTab" @tab-change="handleTabChange" />

    <!-- Page stack (slides over everything) -->
    <MobilePageStack :stack="pageStack" @pop="popPage" />

    <!-- Loadout Editor overlay -->
    <div v-if="loadoutSlot !== null" class="loadout-overlay">
      <div class="loadout-header">
        <button class="back-btn" @click="handleLoadoutCancel">
          <span class="back-arrow">&larr;</span>
          <span>Back</span>
        </button>
        <span class="loadout-header-title">Slot {{ loadoutSlot + 1 }} · Configure</span>
      </div>
      <div class="loadout-content">
        <LoadoutEditor
          :slot="loadoutSlot"
          variant="mobile"
          @start="handleLoadoutStart"
          @cancel="handleLoadoutCancel"
        />
      </div>
    </div>

    <!-- Catch-Up Overlay -->
    <Teleport to="body">
      <CatchUpOverlay v-if="engineState.isCatchingUp" />
    </Teleport>
  </div>
</template>

<style scoped>
.loading-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg);
}

.loading-content {
  text-align: center;
}

.loading-title {
  font-size: 2rem;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.loading-text {
  color: var(--text-secondary);
  font-size: 1rem;
}

.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background: var(--bg);
}

.mobile-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tab-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-page.scrollable {
  overflow-y: auto;
}

.loadout-overlay {
  position: fixed;
  inset: 0;
  z-index: 950;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.loadout-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: 44px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.loadout-header-title {
  font-size: var(--text-base);
  color: var(--text-primary);
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: transparent;
  border: none;
  color: var(--essence);
  font-size: var(--text-base);
  cursor: pointer;
  padding: var(--space-2);
}

.back-arrow {
  font-size: var(--text-xl);
}

.loadout-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
