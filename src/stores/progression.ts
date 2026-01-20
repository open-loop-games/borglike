import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Currency, UnlockState, GlobalStats, RunStats, RunLoadout, BestiaryEntry, SlotConfig } from '../types'
import {
  unlockableRaces,
  prestigeRaces,
  unlockableClasses,
  prestigeClasses,
  upgrades,
  getUpgradeById,
  calculateUpgradeCost,
  calculateUpgradeEffect,
} from '@/game'
import {
  boosters,
  getBoosterById,
  canUnlockBooster as checkBoosterPrereqs,
} from '@/game/data/boosters'
import {
  essenceFromDeath,
  essenceFromVictory,
  prestigeMultiplier,
  prestigeCurrency,
  essenceForNextPrestige,
} from '@core/formulas'
import { saveImmediately } from './persistence'

export interface UpgradeState {
  [upgradeId: string]: number // Current level of each upgrade
}

export const useProgressionStore = defineStore('progression', () => {
  // Currency
  const currency = ref<Currency>({
    essence: 0,
    artifacts: 0,
  })

  // Upgrade levels
  const upgradeLevels = ref<UpgradeState>({})

  // Unlocks
  const unlocks = ref<UnlockState>({
    races: new Set(['Human']),
    classes: new Set(['Warrior']),
    runSlots: 1,
    upgrades: new Set(),
    boosters: new Set(),
  })

  // Active loadout for runs
  const activeLoadout = ref<RunLoadout>({
    boosters: [null, null],
  })

  // Per-slot configurations (remembers last used settings)
  const slotConfigs = ref<SlotConfig[]>([])

  // Default slot config factory
  function createDefaultSlotConfig(): SlotConfig {
    return {
      race: availableRaces.value[0] || 'Human',
      class: availableClasses.value[0] || 'Warrior',
      personality: 'cautious',
      boosters: [null, null],
    }
  }

  // Global statistics
  const globalStats = ref<GlobalStats>({
    totalRuns: 0,
    totalDeaths: 0,
    totalKills: 0,
    totalGold: 0,
    totalEssence: 0,
    maxDepthEver: 0,
  })

  // Prestige state
  const prestigeLevel = ref<number>(0)
  const lifetimeEssence = ref<number>(0) // Never resets, used for prestige currency
  const totalVictories = ref<number>(0)

  // Run history (last N runs)
  const runHistory = ref<RunStats[]>([])
  const MAX_HISTORY = 100

  // Bestiary - tracks monster kills across all runs
  const bestiary = ref<Record<string, BestiaryEntry>>({})

  // Cached best run by depth (computed once, updates only when history changes)
  const bestRunByDepth = computed(() => {
    if (runHistory.value.length === 0) return null
    return runHistory.value.reduce((best, run) =>
      run.maxDepth > best.maxDepth ? run : best
    )
  })

  // Bestiary computed stats
  const bestiaryStats = computed(() => {
    const entries = Object.values(bestiary.value)
    return {
      discovered: Object.keys(bestiary.value).length,
      fullyUnlocked: entries.filter((e) => e.kills >= 30).length,
    }
  })

  // Computed
  const availableRaces = computed(() => Array.from(unlocks.value.races))
  const availableClasses = computed(() => Array.from(unlocks.value.classes))
  const maxRunSlots = computed(() => unlocks.value.runSlots)

  // Prestige computed
  const currentPrestigeMultiplier = computed(() => prestigeMultiplier(prestigeLevel.value))
  const essenceForPrestige = computed(() => essenceForNextPrestige(prestigeLevel.value))
  const canPrestige = computed(() => lifetimeEssence.value >= essenceForPrestige.value)
  const potentialPrestigeCurrency = computed(() => prestigeCurrency(lifetimeEssence.value))
  const prestigeInfo = computed(() => ({
    level: prestigeLevel.value,
    multiplier: currentPrestigeMultiplier.value,
    lifetimeEssence: lifetimeEssence.value,
    essenceForNext: essenceForPrestige.value,
    canPrestige: canPrestige.value,
    potentialCurrency: potentialPrestigeCurrency.value,
  }))

  // Upgrade getters
  function getUpgradeLevel(upgradeId: string): number {
    return upgradeLevels.value[upgradeId] || 0
  }

  function getUpgradeCost(upgradeId: string): number {
    const upgrade = getUpgradeById(upgradeId)
    if (!upgrade) return Infinity
    const currentLevel = getUpgradeLevel(upgradeId)
    return calculateUpgradeCost(upgrade, currentLevel)
  }

  function canAffordUpgrade(upgradeId: string): boolean {
    return currency.value.essence >= getUpgradeCost(upgradeId)
  }

  function isUpgradeMaxed(upgradeId: string): boolean {
    const upgrade = getUpgradeById(upgradeId)
    if (!upgrade) return true
    return getUpgradeLevel(upgradeId) >= upgrade.maxLevel
  }

  function getUpgradeEffectValue(upgradeId: string): number {
    const upgrade = getUpgradeById(upgradeId)
    if (!upgrade) return 0
    return calculateUpgradeEffect(upgrade, getUpgradeLevel(upgradeId))
  }

  // Enriched upgrade type
  type EnrichedUpgrade = (typeof upgrades)[number] & {
    currentLevel: number
    cost: number
    canAfford: boolean
    isMaxed: boolean
    effectValue: number
  }

  // Computed upgrade info - single pass computes both list and categories
  const upgradeData = computed(() => {
    const all: EnrichedUpgrade[] = []
    const byCategory: Record<'stats' | 'borg' | 'meta' | 'qol', EnrichedUpgrade[]> = {
      stats: [],
      borg: [],
      meta: [],
      qol: [],
    }

    for (const upgrade of upgrades) {
      const enriched: EnrichedUpgrade = {
        ...upgrade,
        currentLevel: getUpgradeLevel(upgrade.id),
        cost: getUpgradeCost(upgrade.id),
        canAfford: canAffordUpgrade(upgrade.id),
        isMaxed: isUpgradeMaxed(upgrade.id),
        effectValue: getUpgradeEffectValue(upgrade.id),
      }
      all.push(enriched)
      byCategory[upgrade.category].push(enriched)
    }

    return { all, byCategory }
  })

  // Accessors for backward compatibility
  const allUpgrades = computed(() => upgradeData.value.all)
  const upgradesByCategory = computed(() => upgradeData.value.byCategory)

  // Race/class unlock info (includes canAfford to avoid remapping in components)
  const raceUnlocks = computed(() => {
    const locked = [...unlockableRaces, ...prestigeRaces]
    const essence = currency.value.essence
    return locked.map((race) => {
      const cost = race.prestige ? 5000 : 500
      return {
        ...race,
        isUnlocked: unlocks.value.races.has(race.name),
        cost,
        canAfford: essence >= cost,
      }
    })
  })

  const classUnlocks = computed(() => {
    const locked = [...unlockableClasses, ...prestigeClasses]
    const essence = currency.value.essence
    return locked.map((cls) => {
      const cost = cls.prestige ? 5000 : 500
      return {
        ...cls,
        isUnlocked: unlocks.value.classes.has(cls.name),
        cost,
        canAfford: essence >= cost,
      }
    })
  })

  // Booster getters
  function isBoosterUnlocked(boosterId: string): boolean {
    return unlocks.value.boosters.has(boosterId)
  }

  function getBoosterCost(boosterId: string): number {
    const booster = getBoosterById(boosterId)
    if (!booster) return Infinity
    return booster.unlockCost
  }

  function canAffordBooster(boosterId: string): boolean {
    return currency.value.essence >= getBoosterCost(boosterId)
  }

  function canUnlockBooster(boosterId: string): boolean {
    if (isBoosterUnlocked(boosterId)) return false
    if (!canAffordBooster(boosterId)) return false
    return checkBoosterPrereqs(boosterId, unlocks.value.boosters)
  }

  // Enriched booster type
  type EnrichedBooster = (typeof boosters)[number] & {
    isUnlocked: boolean
    cost: number
    canAfford: boolean
    canUnlock: boolean
  }

  // Computed booster info
  const boosterData = computed(() => {
    const all: EnrichedBooster[] = []
    const byCategory: Record<'equipment' | 'stats' | 'special', EnrichedBooster[]> = {
      equipment: [],
      stats: [],
      special: [],
    }

    for (const booster of boosters) {
      const enriched: EnrichedBooster = {
        ...booster,
        isUnlocked: isBoosterUnlocked(booster.id),
        cost: getBoosterCost(booster.id),
        canAfford: canAffordBooster(booster.id),
        canUnlock: canUnlockBooster(booster.id),
      }
      all.push(enriched)
      byCategory[booster.category].push(enriched)
    }

    return { all, byCategory }
  })

  const allBoosters = computed(() => boosterData.value.all)
  const boostersByCategory = computed(() => boosterData.value.byCategory)
  const unlockedBoosters = computed(() =>
    boosters.filter((b) => unlocks.value.boosters.has(b.id))
  )
  const availableBoosters = computed(() =>
    unlockedBoosters.value.filter(
      (b) =>
        b.id !== activeLoadout.value.boosters[0] && b.id !== activeLoadout.value.boosters[1]
    )
  )

  // Actions
  function addEssence(amount: number) {
    currency.value.essence += amount
    globalStats.value.totalEssence += amount
    lifetimeEssence.value += amount // Lifetime never resets
    // Save immediately - essence is critical data
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after addEssence:', err))
  }

  function spendEssence(amount: number): boolean {
    if (currency.value.essence < amount) return false
    currency.value.essence -= amount
    return true
  }

  function purchaseUpgrade(upgradeId: string): boolean {
    const upgrade = getUpgradeById(upgradeId)
    if (!upgrade) return false
    if (isUpgradeMaxed(upgradeId)) return false

    const cost = getUpgradeCost(upgradeId)
    if (!spendEssence(cost)) return false

    // Increment level
    upgradeLevels.value[upgradeId] = (upgradeLevels.value[upgradeId] || 0) + 1

    // Handle special unlocks
    if (upgrade.effect.type === 'unlock' && upgrade.effect.stat === 'runSlots') {
      unlocks.value.runSlots = Math.max(unlocks.value.runSlots, upgrade.effect.baseValue)
    }

    unlocks.value.upgrades.add(upgradeId)
    // Save immediately - upgrade purchases are critical
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after purchaseUpgrade:', err))
    return true
  }

  function unlockRace(race: string, cost: number = 0): boolean {
    if (unlocks.value.races.has(race)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.races.add(race)
    // Save immediately - unlocks are critical
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after unlockRace:', err))
    return true
  }

  function unlockClass(cls: string, cost: number = 0): boolean {
    if (unlocks.value.classes.has(cls)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.classes.add(cls)
    // Save immediately - unlocks are critical
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after unlockClass:', err))
    return true
  }

  function unlockRunSlot() {
    if (unlocks.value.runSlots < 4) {
      unlocks.value.runSlots++
    }
  }

  // Booster actions
  function unlockBooster(boosterId: string): boolean {
    if (!canUnlockBooster(boosterId)) return false

    const cost = getBoosterCost(boosterId)
    if (!spendEssence(cost)) return false

    unlocks.value.boosters.add(boosterId)
    // Save immediately - unlocks are critical
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after unlockBooster:', err))
    return true
  }

  function setActiveBooster(slot: 0 | 1, boosterId: string | null): boolean {
    // If setting to null, just clear the slot
    if (boosterId === null) {
      activeLoadout.value.boosters[slot] = null
      return true
    }

    // Check if booster is unlocked
    if (!isBoosterUnlocked(boosterId)) return false

    // Check if booster is already in the other slot
    const otherSlot = slot === 0 ? 1 : 0
    if (activeLoadout.value.boosters[otherSlot] === boosterId) {
      // Swap - remove from other slot
      activeLoadout.value.boosters[otherSlot] = null
    }

    activeLoadout.value.boosters[slot] = boosterId
    return true
  }

  function clearLoadout(): void {
    activeLoadout.value.boosters = [null, null]
  }

  function getActiveBoosterIds(): string[] {
    return activeLoadout.value.boosters.filter((id): id is string => id !== null)
  }

  // Slot config actions
  function getSlotConfig(slot: number): SlotConfig {
    const saved = slotConfigs.value[slot]
    if (saved) {
      // Validate saved config - fallback if race/class no longer unlocked
      return {
        race: unlocks.value.races.has(saved.race) ? saved.race : (availableRaces.value[0] || 'Human'),
        class: unlocks.value.classes.has(saved.class) ? saved.class : (availableClasses.value[0] || 'Warrior'),
        personality: saved.personality,
        boosters: [
          saved.boosters[0] && unlocks.value.boosters.has(saved.boosters[0]) ? saved.boosters[0] : null,
          saved.boosters[1] && unlocks.value.boosters.has(saved.boosters[1]) ? saved.boosters[1] : null,
        ],
      }
    }
    return createDefaultSlotConfig()
  }

  function saveSlotConfig(slot: number, config: SlotConfig): void {
    // Ensure array is large enough
    while (slotConfigs.value.length <= slot) {
      slotConfigs.value.push(createDefaultSlotConfig())
    }
    slotConfigs.value[slot] = { ...config }
  }

  function recordRun(stats: RunStats, isVictory: boolean = false) {
    runHistory.value.unshift(stats)
    if (runHistory.value.length > MAX_HISTORY) {
      runHistory.value.pop()
    }

    // Update global stats
    globalStats.value.totalRuns++
    if (isVictory) {
      totalVictories.value++
    } else {
      globalStats.value.totalDeaths++
    }
    globalStats.value.totalKills += stats.kills
    globalStats.value.totalGold += stats.goldEarned
    if (stats.maxDepth > globalStats.value.maxDepthEver) {
      globalStats.value.maxDepthEver = stats.maxDepth
    }
  }

  /**
   * Record monster kills from a completed run into the bestiary
   */
  function recordMonsterKills(monsterKills: Record<string, number>) {
    const now = Date.now()
    for (const [name, count] of Object.entries(monsterKills)) {
      if (!bestiary.value[name]) {
        bestiary.value[name] = { kills: 0, firstKillTime: now }
      }
      bestiary.value[name].kills += count
    }
    // Save immediately - bestiary data is important
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after recordMonsterKills:', err))
  }

  function calculateEssenceReward(stats: RunStats, isVictory: boolean = false): number {
    let baseEssence: number

    if (isVictory) {
      // Victory: use essenceFromVictory formula
      // Note: stats doesn't have turnsTaken, but we can compute it as endTime - startTime if needed
      baseEssence = essenceFromVictory(stats.maxDepth, stats.kills, 0)
    } else {
      // Death: use essenceFromDeath formula
      baseEssence = essenceFromDeath(stats.maxDepth, stats.kills, stats.goldEarned)
    }

    // Apply prestige multiplier
    const prestige = prestigeMultiplier(prestigeLevel.value)
    let essence = Math.floor(baseEssence * prestige)

    // Apply essence boost upgrade
    const essenceBoostLevel = getUpgradeLevel('essence_boost')
    if (essenceBoostLevel > 0) {
      const bonus = calculateUpgradeEffect(getUpgradeById('essence_boost')!, essenceBoostLevel)
      essence = Math.floor(essence * (1 + bonus / 100))
    }

    return essence
  }

  // Debug: add essence for testing
  function debugAddEssence(amount: number) {
    addEssence(amount)
  }

  /**
   * Perform a prestige reset
   *
   * Resets: upgrades, current essence
   * Keeps: unlocks (races, classes), lifetime essence, run slots
   * Gains: +1 prestige level, better essence multiplier
   *
   * @returns true if prestige was performed, false if not eligible
   */
  function prestige(): boolean {
    if (!canPrestige.value) {
      return false
    }

    // Increment prestige level
    prestigeLevel.value++

    // Reset upgrades (all levels back to 0)
    for (const key of Object.keys(upgradeLevels.value)) {
      upgradeLevels.value[key] = 0
    }

    // Reset current essence (keep lifetimeEssence as is)
    currency.value.essence = 0

    // Note: We do NOT reset:
    // - unlocks.races
    // - unlocks.classes
    // - unlocks.runSlots (QoL purchases persist)
    // - lifetimeEssence
    // - globalStats
    // - runHistory
    // - totalVictories

    // Save immediately - prestige is a critical action
    saveImmediately().catch((err) => console.error('[Progression] Failed to save after prestige:', err))
    return true
  }

  /**
   * Get info about what prestige would grant
   */
  function getPrestigePreview(): {
    newLevel: number
    newMultiplier: number
    multiplierGain: number
  } {
    const newLevel = prestigeLevel.value + 1
    const newMultiplier = prestigeMultiplier(newLevel)
    const currentMult = currentPrestigeMultiplier.value
    return {
      newLevel,
      newMultiplier,
      multiplierGain: newMultiplier - currentMult,
    }
  }

  return {
    // State
    currency,
    unlocks,
    globalStats,
    runHistory,
    upgradeLevels,
    prestigeLevel,
    lifetimeEssence,
    totalVictories,
    activeLoadout,
    bestiary,

    // Computed
    availableRaces,
    availableClasses,
    maxRunSlots,
    allUpgrades,
    upgradesByCategory,
    raceUnlocks,
    classUnlocks,
    prestigeInfo,
    canPrestige,
    currentPrestigeMultiplier,
    bestRunByDepth,
    bestiaryStats,

    // Booster computed
    allBoosters,
    boostersByCategory,
    unlockedBoosters,
    availableBoosters,

    // Upgrade getters
    getUpgradeLevel,
    getUpgradeCost,
    canAffordUpgrade,
    isUpgradeMaxed,
    getUpgradeEffectValue,

    // Booster getters
    isBoosterUnlocked,
    getBoosterCost,
    canAffordBooster,
    canUnlockBooster,
    getActiveBoosterIds,

    // Actions
    addEssence,
    spendEssence,
    purchaseUpgrade,
    unlockRace,
    unlockClass,
    unlockRunSlot,
    recordRun,
    recordMonsterKills,
    calculateEssenceReward,
    debugAddEssence,
    prestige,
    getPrestigePreview,

    // Booster actions
    unlockBooster,
    setActiveBooster,
    clearLoadout,

    // Slot config
    slotConfigs,
    getSlotConfig,
    saveSlotConfig,
  }
})
