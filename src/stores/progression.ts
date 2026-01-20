import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Currency, UnlockState, GlobalStats, RunStats } from '../types'
import { unlockableRaces, prestigeRaces } from '@/game/data/races'
import { unlockableClasses, prestigeClasses } from '@/game/data/classes'
import {
  upgrades,
  getUpgradeById,
  calculateUpgradeCost,
  calculateUpgradeEffect,
} from '@/game/data/upgrades'
import {
  essenceFromDeath,
  essenceFromVictory,
  prestigeMultiplier,
  prestigeCurrency,
  essenceForNextPrestige,
} from '@core/formulas'

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
  })

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

  // Computed upgrade info
  const allUpgrades = computed(() => {
    return upgrades.map((upgrade) => ({
      ...upgrade,
      currentLevel: getUpgradeLevel(upgrade.id),
      cost: getUpgradeCost(upgrade.id),
      canAfford: canAffordUpgrade(upgrade.id),
      isMaxed: isUpgradeMaxed(upgrade.id),
      effectValue: getUpgradeEffectValue(upgrade.id),
    }))
  })

  const upgradesByCategory = computed(() => ({
    stats: allUpgrades.value.filter((u) => u.category === 'stats'),
    borg: allUpgrades.value.filter((u) => u.category === 'borg'),
    meta: allUpgrades.value.filter((u) => u.category === 'meta'),
    qol: allUpgrades.value.filter((u) => u.category === 'qol'),
  }))

  // Race/class unlock info
  const raceUnlocks = computed(() => {
    const locked = [...unlockableRaces, ...prestigeRaces]
    return locked.map((race) => ({
      ...race,
      isUnlocked: unlocks.value.races.has(race.name),
      // Cost in essence to unlock (if purchasable)
      cost: race.prestige ? 5000 : 500,
    }))
  })

  const classUnlocks = computed(() => {
    const locked = [...unlockableClasses, ...prestigeClasses]
    return locked.map((cls) => ({
      ...cls,
      isUnlocked: unlocks.value.classes.has(cls.name),
      cost: cls.prestige ? 5000 : 500,
    }))
  })

  // Actions
  function addEssence(amount: number) {
    currency.value.essence += amount
    globalStats.value.totalEssence += amount
    lifetimeEssence.value += amount // Lifetime never resets
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
    return true
  }

  function unlockRace(race: string, cost: number = 0): boolean {
    if (unlocks.value.races.has(race)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.races.add(race)
    return true
  }

  function unlockClass(cls: string, cost: number = 0): boolean {
    if (unlocks.value.classes.has(cls)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.classes.add(cls)
    return true
  }

  function unlockRunSlot() {
    if (unlocks.value.runSlots < 4) {
      unlocks.value.runSlots++
    }
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

    // Upgrade getters
    getUpgradeLevel,
    getUpgradeCost,
    canAffordUpgrade,
    isUpgradeMaxed,
    getUpgradeEffectValue,

    // Actions
    addEssence,
    spendEssence,
    purchaseUpgrade,
    unlockRace,
    unlockClass,
    unlockRunSlot,
    recordRun,
    calculateEssenceReward,
    debugAddEssence,
    prestige,
    getPrestigePreview,
  }
})
