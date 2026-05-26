<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppHeader from './ui/components/layout/AppHeader.vue'
import AppFeed from './ui/components/layout/AppFeed.vue'
import Sidebar from './ui/components/Sidebar.vue'
import RunArea from './ui/components/RunArea.vue'
import SettingsPanel from './ui/components/settings/SettingsPanel.vue'
import CompendiumModal, { type CompendiumTab } from './ui/components/compendium/CompendiumModal.vue'
import CatchUpOverlay from './ui/components/overlay/CatchUpOverlay.vue'
import AppModal from './ui/components/common/AppModal.vue'
import { useEngineStateStore } from './stores/engine-state'
import { useKeyboard } from './ui/composables/use-keyboard'
import { initPersistence } from './ui/composables/use-persistence'
import { useGameTitle } from './ui/composables/use-game-title'
import { useThemeEffects } from './ui/composables/use-theme-effects'

// Loading state - block render until persistence loads
const isLoaded = ref(false)

// These composables must be called synchronously during setup (before any await)
// They register lifecycle hooks that need the active component instance
useKeyboard()
useGameTitle()
useThemeEffects()
const engineState = useEngineStateStore()

// Initialize persistence on mount
onMounted(async () => {
  // CRITICAL: Await persistence before allowing app to render
  // This prevents race conditions where components try to write before data loads
  await initPersistence()
  isLoaded.value = true
})

// Modal state
const showSettings = ref(false)
const showCompendium = ref(false)
const compendiumTab = ref<CompendiumTab>('history')

// Sidebar drawer state — overlay drawer kicks in below 1400px (see CSS).
// State is harmless above the breakpoint because the .sidebar-open class
// only affects layout inside the @media block.
const sidebarOpen = ref(false)
function handleToggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}
function handleCloseSidebar() {
  sidebarOpen.value = false
}

function handleOpenSettings() {
  showSettings.value = true
}

function handleCloseSettings() {
  showSettings.value = false
}

function handleOpenCompendium(tab?: CompendiumTab) {
  compendiumTab.value = tab ?? 'history'
  showCompendium.value = true
}

function handleCloseCompendium() {
  showCompendium.value = false
}
</script>

<template>
  <!-- Loading screen while persistence initializes -->
  <div v-if="!isLoaded" class="loading-screen">
    <div class="loading-content">
      <div class="loading-title">Borglike</div>
      <div class="loading-text">Loading...</div>
    </div>
  </div>

  <!-- Main app (only renders after persistence is ready) -->
  <div v-else class="app-layout">
    <AppHeader
      class="header"
      @open-settings="handleOpenSettings"
      @open-compendium="handleOpenCompendium"
    />
    <main class="game">
      <RunArea />
    </main>
    <div
      class="sidebar-backdrop"
      :class="{ visible: sidebarOpen }"
      @click="handleCloseSidebar"
    ></div>
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <button
        class="sidebar-handle"
        :class="{ open: sidebarOpen }"
        :aria-label="sidebarOpen ? 'Close upgrades panel' : 'Open upgrades panel'"
        @click="handleToggleSidebar"
      >
        <span class="sidebar-handle-label">Upgrades</span>
      </button>
      <Sidebar />
    </aside>
    <AppFeed class="feed" />

    <!-- Settings Modal -->
    <AppModal v-model:open="showSettings" title="Settings">
      <SettingsPanel @close="handleCloseSettings" />
    </AppModal>

    <!-- Compendium Modal -->
    <AppModal v-model:open="showCompendium" title="Compendium" size="lg">
      <CompendiumModal :initial-tab="compendiumTab" @close="handleCloseCompendium" />
    </AppModal>

    <!-- Catch-Up Overlay -->
    <Teleport to="body">
      <CatchUpOverlay v-if="engineState.isCatchingUp" />
    </Teleport>
  </div>
</template>

<style scoped>
/* Loading screen */
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

.app-layout {
  display: grid;
  grid-template-rows: 48px 1fr 48px;
  grid-template-columns: 1fr 300px;
  grid-template-areas:
    'header  header'
    'game    sidebar'
    'feed    feed';
  height: 100vh;
  gap: 1px;
  background: var(--border);
}

.header {
  grid-area: header;
}

.game {
  grid-area: game;
  background: var(--bg);
  overflow: hidden;
}

.sidebar {
  grid-area: sidebar;
  background: var(--bg-panel);
  overflow-y: auto;
}

.feed {
  grid-area: feed;
}

.sidebar-backdrop {
  display: none;
}

/* Handle is sidebar-attached but hidden above breakpoint. */
.sidebar-handle {
  display: none;
}

/* Below 1400px: sidebar becomes an overlay drawer.
   Drops out of grid, runs get the full width. Slides in from the right.
   The handle stays anchored to the drawer's left edge — when the drawer is
   closed, it pokes out past the viewport edge as the only affordance to open. */
@media (max-width: 1399px) {
  .app-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'header'
      'game'
      'feed';
  }

  .sidebar {
    position: fixed;
    top: 48px;
    right: 0;
    bottom: 48px;
    width: min(360px, 90vw);
    z-index: 900;
    border-left: 1px solid var(--border);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.4);
    transform: translateX(100%);
    transition: transform 0.2s ease;
    /* Allow the handle to render outside the drawer's left edge when closed */
    overflow-y: visible;
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .sidebar-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 25%;
    left: -28px;
    width: 28px;
    height: 140px;
    padding: 0;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-right: none;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    color: var(--essence);
    cursor: pointer;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.3);
    transition:
      background 0.2s,
      color 0.2s,
      border-color 0.2s;
  }

  .sidebar-handle:hover {
    background: var(--bg-highlight);
    border-color: var(--essence);
  }

  .sidebar-handle-label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: var(--text-base);
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-weight: bold;
    user-select: none;
  }

  .sidebar-backdrop {
    display: block;
    position: fixed;
    inset: 48px 0 48px 0;
    background: color-mix(in srgb, var(--bg) 60%, transparent);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
    z-index: 800;
  }

  .sidebar-backdrop.visible {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
