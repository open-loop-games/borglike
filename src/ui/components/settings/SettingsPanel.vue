<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSettingsStore, FONT_OPTIONS, THEME_OPTIONS, type ThemeId } from '@/stores/settings'
import { useProgressionStore } from '@/stores/progression'
import { clearData } from '@/ui/composables/use-persistence'
import { cleanupPersistence } from '@/stores/persistence'
import { Icons } from '@/ui/icons'
import Icon from '../common/Icon.vue'
import PanelFrame from '../common/PanelFrame.vue'
import SettingSwitch from '../common/SettingSwitch.vue'

const emit = defineEmits<{
  close: []
}>()

const settingsStore = useSettingsStore()
const progression = useProgressionStore()

const appVersion = __APP_VERSION__
const activeTab = ref<'appearance' | 'gameplay' | 'data'>('appearance')

// Confirmation dialog state
const showResetConfirm = ref(false)
const showExportSuccess = ref(false)

// Tab definitions
const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Icons.appearance },
  { id: 'gameplay', label: 'Gameplay', icon: Icons.gameplay },
  { id: 'data', label: 'Data', icon: Icons.data },
] as const

// Stats for data tab
const totalEssence = computed(() => progression.globalStats.totalEssence)
const totalRuns = computed(() => progression.globalStats.totalRuns)

// Check if auto-restart upgrade is purchased
const hasAutoRestartUpgrade = computed(() => progression.getUpgradeLevel('auto_restart') > 0)

const fontSizeOptions = [
  { value: 'small' as const, label: 'Small' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'large' as const, label: 'Large' },
]

function handleExportData() {
  const data = {
    settings: settingsStore.settings,
    progression: {
      currency: progression.currency,
      unlocks: {
        races: Array.from(progression.unlocks.races),
        classes: Array.from(progression.unlocks.classes),
        runSlots: progression.unlocks.runSlots,
        upgrades: Array.from(progression.unlocks.upgrades),
      },
      upgradeLevels: progression.upgradeLevels,
      globalStats: progression.globalStats,
      prestigeLevel: progression.prestigeLevel,
      lifetimeEssence: progression.lifetimeEssence,
      starBalance: progression.starBalance,
      totalStarsEarned: progression.totalStarsEarned,
      starUpgradeLevels: progression.starUpgradeLevels,
    },
    exportedAt: new Date().toISOString(),
    version: __APP_VERSION__,
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `borglike-save-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)

  showExportSuccess.value = true
  setTimeout(() => {
    showExportSuccess.value = false
  }, 3000)
}

function handleResetProgress() {
  showResetConfirm.value = true
}

async function confirmReset() {
  // Stop auto-save and remove beforeunload handler FIRST,
  // otherwise unload re-saves current state to localStorage
  cleanupPersistence()
  // Clear IndexedDB (primary storage) and localStorage (backup)
  await clearData()
  localStorage.clear()
  window.location.reload()
}

function cancelReset() {
  showResetConfirm.value = false
}
</script>

<template>
  <div class="settings-panel">
    <header class="settings-header">
      <h2>
        Settings <span class="version-tag">v{{ appVersion }}</span>
      </h2>
      <button class="close-btn" @click="emit('close')"><Icon :name="Icons.close" /></button>
    </header>

    <!-- Tabs -->
    <nav class="settings-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="tab-btn"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        <Icon class="tab-icon" :name="tab.icon" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </nav>

    <div class="settings-content">
      <!-- Appearance Settings -->
      <div v-if="activeTab === 'appearance'" class="settings-section">
        <PanelFrame class="setting-group">
          <h3>Theme</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Color Theme</span>
              <span class="setting-desc"
                >Affects panels, accents, and text (not the dungeon grid)</span
              >
            </div>
            <select
              :value="settingsStore.settings.theme"
              class="setting-select"
              @change="
                settingsStore.updateSetting(
                  'theme',
                  ($event.target as HTMLSelectElement).value as ThemeId
                )
              "
            >
              <option v-for="t in THEME_OPTIONS" :key="t.id" :value="t.id">
                {{ t.label }}
              </option>
            </select>
          </div>
        </PanelFrame>

        <PanelFrame class="setting-group">
          <h3>Display</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Font Size</span>
              <span class="setting-desc">Scale all text in the UI</span>
            </div>
            <div class="font-size-picker">
              <button
                v-for="opt in fontSizeOptions"
                :key="opt.value"
                class="font-size-btn"
                :class="{ active: settingsStore.settings.fontSize === opt.value }"
                @click="settingsStore.updateSetting('fontSize', opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Font</span>
              <span class="setting-desc">Monospace font for the entire UI</span>
            </div>
            <select
              :value="settingsStore.settings.fontFamily"
              class="setting-select"
              @change="
                settingsStore.updateSetting(
                  'fontFamily',
                  ($event.target as HTMLSelectElement).value as any
                )
              "
            >
              <option v-for="font in FONT_OPTIONS" :key="font.id" :value="font.id">
                {{ font.label }}
              </option>
            </select>
          </div>
        </PanelFrame>
      </div>

      <!-- Gameplay Settings -->
      <div v-if="activeTab === 'gameplay'" class="settings-section">
        <PanelFrame class="setting-group">
          <h3>Run Settings</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Turbo by Default</span>
              <span class="setting-desc">Start new runs in turbo mode</span>
            </div>
            <SettingSwitch
              :model-value="settingsStore.settings.turboByDefault"
              aria-label="Turbo by Default"
              @update:model-value="settingsStore.updateSetting('turboByDefault', $event)"
            />
          </div>

          <div class="setting-row" :class="{ locked: !hasAutoRestartUpgrade }">
            <div class="setting-info">
              <span class="setting-label">Auto-Restart</span>
              <span v-if="hasAutoRestartUpgrade" class="setting-desc"
                >Automatically start new run on death</span
              >
              <span v-else class="setting-desc locked-desc">Requires Auto Restart upgrade</span>
            </div>
            <SettingSwitch
              :model-value="settingsStore.settings.autoRestart"
              :disabled="!hasAutoRestartUpgrade"
              aria-label="Auto-Restart"
              @update:model-value="settingsStore.updateSetting('autoRestart', $event)"
            />
          </div>

          <div class="setting-row" :class="{ locked: !hasAutoRestartUpgrade }">
            <div class="setting-info">
              <span class="setting-label">Pause on Victory</span>
              <span v-if="hasAutoRestartUpgrade" class="setting-desc"
                >Suppress auto-restart when a run wins</span
              >
              <span v-else class="setting-desc locked-desc">Requires Auto Restart upgrade</span>
            </div>
            <SettingSwitch
              :model-value="settingsStore.settings.pauseOnVictory"
              :disabled="!hasAutoRestartUpgrade"
              aria-label="Pause on Victory"
              @update:model-value="settingsStore.updateSetting('pauseOnVictory', $event)"
            />
          </div>
        </PanelFrame>

        <PanelFrame class="setting-group">
          <h3>Feed</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Verbosity</span>
              <span class="setting-desc">How much to show in the event feed</span>
            </div>
            <select
              :value="settingsStore.settings.feedVerbosity"
              class="setting-select"
              @change="
                settingsStore.updateSetting(
                  'feedVerbosity',
                  ($event.target as HTMLSelectElement).value as
                    'minimal' | 'normal' | 'verbose' | 'all'
                )
              "
            >
              <option value="minimal">Minimal</option>
              <option value="normal">Normal</option>
              <option value="verbose">Verbose</option>
              <option value="all">All</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Show Timestamps</span>
              <span class="setting-desc">Display time (hh:mm:ss) on events</span>
            </div>
            <SettingSwitch
              :model-value="settingsStore.settings.feedShowTimestamps"
              aria-label="Show Timestamps"
              @update:model-value="settingsStore.updateSetting('feedShowTimestamps', $event)"
            />
          </div>
        </PanelFrame>

        <PanelFrame class="setting-group">
          <h3>Advanced</h3>

          <div class="setting-row">
            <div class="setting-info">
              <span class="setting-label">Cheat Mode</span>
              <span class="setting-desc">Enable cheat tools (free essence, stat boosters)</span>
            </div>
            <SettingSwitch
              :model-value="settingsStore.settings.cheatMode"
              aria-label="Cheat Mode"
              @update:model-value="settingsStore.updateSetting('cheatMode', $event)"
            />
          </div>
        </PanelFrame>
      </div>

      <!-- Data Settings -->
      <div v-if="activeTab === 'data'" class="settings-section">
        <PanelFrame class="setting-group">
          <h3>Statistics</h3>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-label">Total Runs</span>
              <span class="stat-value">{{ totalRuns }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Total Essence</span>
              <span class="stat-value essence">{{ totalEssence.toLocaleString() }}</span>
            </div>
          </div>
        </PanelFrame>

        <PanelFrame class="setting-group">
          <h3>Save Data</h3>

          <div class="data-actions">
            <button class="data-btn" @click="handleExportData">
              <Icon class="btn-icon" :name="Icons.exportSave" />
              Export Save
            </button>
            <button class="data-btn">
              <Icon class="btn-icon" :name="Icons.importSave" />
              Import Save
            </button>
          </div>

          <div v-if="showExportSuccess" class="export-success">Save exported successfully!</div>
        </PanelFrame>

        <PanelFrame class="setting-group danger">
          <h3>Danger Zone</h3>
          <p class="danger-warning">
            This will permanently delete all your progress, including upgrades, unlocks, and
            statistics.
          </p>
          <button class="reset-btn" @click="handleResetProgress">Reset All Progress</button>
        </PanelFrame>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <div v-if="showResetConfirm" class="modal-overlay" @click="cancelReset">
      <PanelFrame class="confirm-modal" @click.stop>
        <h3>Confirm Reset</h3>
        <p>Are you sure you want to reset ALL progress? This cannot be undone!</p>
        <div class="modal-actions">
          <button class="modal-btn cancel" @click="cancelReset">Cancel</button>
          <button class="modal-btn danger" @click="confirmReset">Yes, Reset Everything</button>
        </div>
      </PanelFrame>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-panel);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.settings-header h2 {
  font-size: var(--text-2xl);
  font-weight: bold;
  color: var(--text-primary);
  margin: 0;
}

.version-tag {
  font-size: var(--text-base);
  font-weight: normal;
  color: var(--text-dim);
}

.close-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-2xl);
  cursor: pointer;
  transition: all 0.2s;
}

.close-btn:hover {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
}

.settings-tabs {
  display: flex;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
}

.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-icon {
  font-size: var(--text-lg);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.setting-group {
  padding: var(--space-4) !important;
}

.setting-group h3 {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 var(--space-4);
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: var(--text-md);
  color: var(--text-primary);
}

.setting-desc {
  font-size: var(--text-base);
  color: var(--text-dim);
}

.setting-row.locked {
  opacity: 0.6;
}

.locked-desc {
  color: var(--warning);
}

.setting-select {
  padding: var(--space-2) var(--space-3);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-primary);
  cursor: pointer;
}

.setting-select:focus {
  outline: none;
  border-color: var(--accent);
}

/* Font Size Picker */
.font-size-picker {
  display: flex;
  gap: 2px;
  background: var(--bg-highlight);
  border-radius: var(--radius-md);
  padding: 2px;
}

.font-size-btn {
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.font-size-btn:hover {
  color: var(--text-primary);
}

.font-size-btn.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--bg-highlight);
  border-radius: var(--radius-md);
}

.stat-item .stat-label {
  font-size: var(--text-base);
  color: var(--text-dim);
  text-transform: uppercase;
}

.stat-item .stat-value {
  font-size: var(--text-2xl);
  font-weight: bold;
  color: var(--text-primary);
}

.stat-item .stat-value.essence {
  color: var(--essence);
}

/* Data Actions */
.data-actions {
  display: flex;
  gap: var(--space-3);
}

.data-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.data-btn:hover {
  background: var(--border);
  color: var(--text-primary);
}

.btn-icon {
  font-size: var(--text-lg);
}

.export-success {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: color-mix(in srgb, var(--success) 10%, transparent);
  border: 1px solid var(--success);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--success);
  text-align: center;
}

/* Danger Zone */
.setting-group.danger {
  border-color: var(--danger);
}

.setting-group.danger h3 {
  color: var(--danger);
}

.danger-warning {
  font-size: var(--text-base);
  color: var(--text-secondary);
  margin: 0 0 var(--space-3);
  line-height: 1.4;
}

.reset-btn {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  color: var(--danger);
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: var(--danger);
  color: white;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.confirm-modal {
  width: 100%;
  max-width: 400px;
  padding: var(--space-6) !important;
}

.confirm-modal h3 {
  font-size: var(--text-xl);
  color: var(--danger);
  margin: 0 0 var(--space-3);
}

.confirm-modal p {
  font-size: var(--text-md);
  color: var(--text-secondary);
  margin: 0 0 var(--space-5);
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: var(--space-3);
}

.modal-btn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  cursor: pointer;
  transition: all 0.2s;
}

.modal-btn.cancel {
  background: var(--bg-highlight);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.modal-btn.cancel:hover {
  background: var(--border);
  color: var(--text-primary);
}

.modal-btn.danger {
  background: var(--danger);
  border: 1px solid var(--danger);
  color: white;
}

.modal-btn.danger:hover {
  background: var(--danger-hover);
}
</style>
