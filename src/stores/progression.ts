import { defineStore } from 'pinia'
import { ref, computed, type Ref } from 'vue'
import type {
  Currency,
  UnlockState,
  GlobalStats,
  RunStats,
  RunLoadout,
  BestiaryEntry,
  ArmoryEntry,
  SlotConfig,
  AchievementState,
  UnlockContext,
  BotCapabilities,
  BotToggles,
} from '../types'
import {
  DEFAULT_BOT_CAPABILITIES,
  DEFAULT_BOT_TOGGLES,
  FULL_BOT_CAPABILITIES,
} from '../types/progression'
import { getDefaultSweepLevelRange } from '@game/bot/types'
import {
  type BotUpgradeId,
  type ToggleUpgradeId,
  getBotUpgradeById,
  canPurchaseBotUpgrade,
  applyBotUpgrade,
} from '@game/data/bot-upgrades'
import { achievements, getAchievementById } from '@game/data/achievements'
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
} from '@game/data/boosters'
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
    races: new Set(['Human', 'Dwarf', 'Elf']),
    classes: new Set(['Warrior', 'Mage', 'Rogue']),
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
    const classId = (availableClasses.value[0] || 'Warrior').toLowerCase()
    return {
      race: availableRaces.value[0] || 'Human',
      class: availableClasses.value[0] || 'Warrior',
      personality: 'cautious',
      boosters: [null, null],
      capabilities: { ...DEFAULT_BOT_CAPABILITIES },
      toggles: { ...DEFAULT_BOT_TOGGLES },
      sweepLevelRange: getDefaultSweepLevelRange(classId),
    }
  }

  // Global statistics
  const globalStats = ref<GlobalStats>({
    totalRuns: 0,
    totalDeaths: 0,
    totalKills: 0,
    totalGold: 0,
    totalEssence: 0,
    totalFloorsVisited: 0,
    maxDepthEver: 0,
  })

  // Prestige state
  const prestigeLevel = ref<number>(0)
  const lifetimeEssence = ref<number>(0) // Never resets, used for prestige currency
  const totalVictories = ref<number>(0)

  // Run history (last N runs)
  const runHistory = ref<RunStats[]>([])
  const MAX_HISTORY = 100

  // Independent top runs storage (persisted separately from recent runs)
  const topRunsByDepth = ref<RunStats[]>([])
  const topRunsByEssence = ref<RunStats[]>([])
  const topRunsByKills = ref<RunStats[]>([])
  const MAX_TOP_RUNS = 5

  // Win history - all victories, never trimmed
  const winHistory = ref<RunStats[]>([])

  // Bestiary - tracks monster kills across all runs
  const bestiary = ref<Record<string, BestiaryEntry>>({})

  // Item armory - tracks discovered items across all runs
  const itemArmory = ref<Record<string, ArmoryEntry>>({})

  // Achievements - tracks achievement progress and unlocks
  const achievementState = ref<AchievementState>({
    unlocked: new Set(),
    collected: new Set(),
    progress: {},
    newUnlocks: new Set(),
  })

  // Cached best run by depth (computed once, updates only when history changes)
  const bestRunByDepth = computed(() => {
    if (runHistory.value.length === 0) return null
    return runHistory.value.reduce((best, run) => (run.maxDepth > best.maxDepth ? run : best))
  })

  // Bestiary computed stats
  const bestiaryStats = computed(() => {
    const entries = Object.values(bestiary.value)
    return {
      discovered: Object.keys(bestiary.value).length,
      fullyUnlocked: entries.filter((e) => e.kills >= 30).length,
    }
  })

  // Item armory computed stats
  const armoryStats = computed(() => {
    const entries = Object.values(itemArmory.value)
    return {
      discovered: entries.length,
      artifacts: entries.filter((e) => e.isArtifact).length,
    }
  })

  // Achievement computed stats
  const achievementStats = computed(() => {
    const unlocked = achievementState.value.unlocked.size
    const collected = achievementState.value.collected.size
    const uncollected = unlocked - collected
    const total = achievements.length
    // Only count essence from collected achievements
    const essenceCollected = Array.from(achievementState.value.collected)
      .map((id) => getAchievementById(id)?.reward ?? 0)
      .reduce((sum, r) => sum + r, 0)
    // Essence available to claim
    const essencePending = Array.from(achievementState.value.unlocked)
      .filter((id) => !achievementState.value.collected.has(id))
      .map((id) => getAchievementById(id)?.reward ?? 0)
      .reduce((sum, r) => sum + r, 0)
    return { unlocked, collected, uncollected, total, essenceCollected, essencePending }
  })

  const hasNewAchievements = computed(() => achievementState.value.newUnlocks.size > 0)

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

  // Context for evaluating prestige unlock conditions
  const unlockContext = computed<UnlockContext>(() => ({
    globalStats: globalStats.value,
    bestiary: bestiary.value,
  }))

  // Race/class unlock info (includes canAfford and meetsCondition for prestige)
  const raceUnlocks = computed(() => {
    const locked = [...unlockableRaces, ...prestigeRaces]
    const essence = currency.value.essence
    const ctx = unlockContext.value
    return locked.map((race) => {
      const cost = race.prestige ? 5000 : 500
      // Non-prestige races always meet condition, prestige races need checkCondition
      const meetsCondition = !race.prestige || !race.checkCondition || race.checkCondition(ctx)
      return {
        ...race,
        isUnlocked: unlocks.value.races.has(race.name),
        cost,
        canAfford: essence >= cost,
        meetsCondition,
      }
    })
  })

  const classUnlocks = computed(() => {
    const locked = [...unlockableClasses, ...prestigeClasses]
    const essence = currency.value.essence
    const ctx = unlockContext.value
    return locked.map((cls) => {
      const cost = cls.prestige ? 5000 : 500
      // Non-prestige classes always meet condition, prestige classes need checkCondition
      const meetsCondition = !cls.prestige || !cls.checkCondition || cls.checkCondition(ctx)
      return {
        ...cls,
        isUnlocked: unlocks.value.classes.has(cls.name),
        cost,
        canAfford: essence >= cost,
        meetsCondition,
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
  const unlockedBoosters = computed(() => boosters.filter((b) => unlocks.value.boosters.has(b.id)))
  const availableBoosters = computed(() =>
    unlockedBoosters.value.filter(
      (b) => b.id !== activeLoadout.value.boosters[0] && b.id !== activeLoadout.value.boosters[1]
    )
  )

  // Actions
  function addEssence(amount: number) {
    currency.value.essence += amount
    globalStats.value.totalEssence += amount
    lifetimeEssence.value += amount // Lifetime never resets
    // Save immediately - essence is critical data
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after addEssence:', err)
    )
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
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after purchaseUpgrade:', err)
    )
    return true
  }

  function unlockRace(race: string, cost: number = 0): boolean {
    if (unlocks.value.races.has(race)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.races.add(race)
    // Save immediately - unlocks are critical
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after unlockRace:', err)
    )
    return true
  }

  function unlockClass(cls: string, cost: number = 0): boolean {
    if (unlocks.value.classes.has(cls)) return false
    if (cost > 0 && !spendEssence(cost)) return false
    unlocks.value.classes.add(cls)
    // Save immediately - unlocks are critical
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after unlockClass:', err)
    )
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
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after unlockBooster:', err)
    )
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
      // Migration: old saves without capabilities get FULL capabilities (reward existing players)
      const capabilities = saved.capabilities ?? { ...FULL_BOT_CAPABILITIES }
      const toggles = saved.toggles ?? { ...DEFAULT_BOT_TOGGLES }
      // Migration: old saves without sweepLevelRange get class-based defaults
      const effectiveClass = unlocks.value.classes.has(saved.class)
        ? saved.class
        : availableClasses.value[0] || 'Warrior'
      const sweepLevelRange =
        saved.sweepLevelRange ?? getDefaultSweepLevelRange(effectiveClass.toLowerCase())
      // Migration: old saves without active levels default to max unlocked
      const activeSweepLevel = saved.activeSweepLevel ?? capabilities.sweep
      const activeSurfLevel = saved.activeSurfLevel ?? capabilities.surf

      return {
        race: unlocks.value.races.has(saved.race) ? saved.race : availableRaces.value[0] || 'Human',
        class: effectiveClass,
        personality: saved.personality,
        boosters: [
          saved.boosters[0] && unlocks.value.boosters.has(saved.boosters[0])
            ? saved.boosters[0]
            : null,
          saved.boosters[1] && unlocks.value.boosters.has(saved.boosters[1])
            ? saved.boosters[1]
            : null,
        ],
        capabilities,
        toggles,
        sweepLevelRange,
        activeSweepLevel,
        activeSurfLevel,
      }
    }
    return createDefaultSlotConfig()
  }

  function saveSlotConfig(slot: number, config: SlotConfig): void {
    // Ensure array is large enough
    while (slotConfigs.value.length <= slot) {
      slotConfigs.value.push(createDefaultSlotConfig())
    }
    slotConfigs.value[slot] = {
      ...config,
      capabilities: { ...config.capabilities },
      toggles: { ...config.toggles },
    }
  }

  // Bot capability upgrade actions
  function purchaseBotUpgrade(slot: number, upgradeId: BotUpgradeId): boolean {
    const config = getSlotConfig(slot)

    if (!canPurchaseBotUpgrade(upgradeId, config.capabilities, currency.value.essence)) {
      return false
    }

    const upgrade = getBotUpgradeById(upgradeId)
    if (!upgrade) return false

    // Spend essence
    if (!spendEssence(upgrade.cost)) return false

    // Apply upgrade to capabilities
    const newCapabilities = applyBotUpgrade(upgradeId, config.capabilities)

    // Save updated config
    saveSlotConfig(slot, {
      ...config,
      capabilities: newCapabilities,
    })

    // Save immediately - upgrade purchases are critical
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after purchaseBotUpgrade:', err)
    )
    return true
  }

  function toggleBotCapability(slot: number, capability: ToggleUpgradeId): void {
    const config = getSlotConfig(slot)

    // Can only toggle if capability is unlocked
    if (!config.capabilities[capability]) return

    // Toggle the setting
    const newToggles = {
      ...config.toggles,
      [capability]: !config.toggles[capability],
    }

    // Save updated config
    saveSlotConfig(slot, {
      ...config,
      toggles: newToggles,
    })
  }

  /** Set active level for a graded capability (sweep/surf) */
  function setActiveGradedLevel(slot: number, field: 'sweep' | 'surf', level: number): void {
    const config = getSlotConfig(slot)
    const maxLevel = config.capabilities[field]

    // Clamp to unlocked level
    const activeLevel = Math.min(Math.max(0, level), maxLevel)

    // Save updated config
    saveSlotConfig(slot, {
      ...config,
      activeSweepLevel: field === 'sweep' ? activeLevel : config.activeSweepLevel,
      activeSurfLevel: field === 'surf' ? activeLevel : config.activeSurfLevel,
    })
  }

  /** Get effective capabilities (unlocked AND toggled on, with active levels) */
  function getEffectiveCapabilities(slot: number): BotCapabilities & BotToggles {
    const config = getSlotConfig(slot)
    // Use active levels if set, otherwise use max unlocked
    const activeSweep = Math.min(
      config.activeSweepLevel ?? config.capabilities.sweep,
      config.capabilities.sweep
    )
    const activeSurf = Math.min(
      config.activeSurfLevel ?? config.capabilities.surf,
      config.capabilities.surf
    )
    return {
      town: config.capabilities.town && config.toggles.town,
      farming: config.capabilities.farming && config.toggles.farming,
      tactics: config.capabilities.tactics && config.toggles.tactics,
      preparedness: config.capabilities.preparedness,
      sweepEnabled: config.toggles.sweepEnabled,
      sweep: activeSweep,
      surf: activeSurf,
      kiting: config.capabilities.kiting,
      targeting: config.capabilities.targeting,
      retreat: config.capabilities.retreat,
    }
  }

  /** Aggregated performance stats for a race/class/personality combination */
  interface ConfigPerformance {
    runCount: number
    avgDepth: number
    avgEssence: number
    avgKills: number
    bestDepth: number
    bestEssence: number
  }

  /** Get aggregated performance stats for a specific config combination */
  function getConfigPerformance(
    race: string,
    cls: string,
    personality: string
  ): ConfigPerformance | null {
    const matchingRuns = runHistory.value.filter(
      (run) => run.race === race && run.class === cls && run.personality === personality
    )

    if (matchingRuns.length === 0) return null

    const totalDepth = matchingRuns.reduce((sum, r) => sum + r.maxDepth, 0)
    const totalEssence = matchingRuns.reduce((sum, r) => sum + r.essenceEarned, 0)
    const totalKills = matchingRuns.reduce((sum, r) => sum + r.kills, 0)
    const bestDepth = Math.max(...matchingRuns.map((r) => r.maxDepth))
    const bestEssence = Math.max(...matchingRuns.map((r) => r.essenceEarned))

    return {
      runCount: matchingRuns.length,
      avgDepth: totalDepth / matchingRuns.length,
      avgEssence: totalEssence / matchingRuns.length,
      avgKills: totalKills / matchingRuns.length,
      bestDepth,
      bestEssence,
    }
  }

  function recordRun(stats: RunStats, isVictory: boolean = false) {
    runHistory.value.unshift(stats)
    if (runHistory.value.length > MAX_HISTORY) {
      runHistory.value.pop()
    }

    // Update independent top runs lists
    updateTopRuns(topRunsByDepth, stats, (a, b) => b.maxDepth - a.maxDepth)
    updateTopRuns(topRunsByEssence, stats, (a, b) => b.essenceEarned - a.essenceEarned)
    updateTopRuns(topRunsByKills, stats, (a, b) => b.kills - a.kills)

    // Update global stats
    globalStats.value.totalRuns++
    if (isVictory) {
      totalVictories.value++
      // Add to win history (never trimmed - wins are rare and precious)
      winHistory.value.unshift(stats)
      // Track victories per race and class for prestige unlock conditions
      if (!globalStats.value.victoriesPerRace) {
        globalStats.value.victoriesPerRace = {}
      }
      if (!globalStats.value.victoriesPerClass) {
        globalStats.value.victoriesPerClass = {}
      }
      globalStats.value.victoriesPerRace[stats.race] =
        (globalStats.value.victoriesPerRace[stats.race] ?? 0) + 1
      globalStats.value.victoriesPerClass[stats.class] =
        (globalStats.value.victoriesPerClass[stats.class] ?? 0) + 1
    } else {
      globalStats.value.totalDeaths++
    }
    globalStats.value.totalKills += stats.kills
    globalStats.value.totalGold += stats.goldEarned
    globalStats.value.totalFloorsVisited += stats.maxDepth
    if (stats.maxDepth > globalStats.value.maxDepthEver) {
      globalStats.value.maxDepthEver = stats.maxDepth
    }
  }

  /**
   * Update a top runs list with a new run if it qualifies
   * New entries replace the worst entry if they qualify
   */
  function updateTopRuns(
    topList: Ref<RunStats[]>,
    newRun: RunStats,
    compareFn: (a: RunStats, b: RunStats) => number
  ) {
    // Check if run already exists (by ID)
    const existingIndex = topList.value.findIndex((r) => r.id === newRun.id)
    if (existingIndex >= 0) {
      // Update existing entry
      topList.value[existingIndex] = newRun
      topList.value.sort(compareFn)
      return
    }

    // If list isn't full, add and sort
    if (topList.value.length < MAX_TOP_RUNS) {
      topList.value.push(newRun)
      topList.value.sort(compareFn)
      return
    }

    // Check if new run beats the worst entry
    const worstRun = topList.value[topList.value.length - 1]
    if (worstRun && compareFn(newRun, worstRun) < 0) {
      // New run is better than worst, replace it
      topList.value[topList.value.length - 1] = newRun
      topList.value.sort(compareFn)
    }
  }

  /**
   * Record monster kills from a completed run into the bestiary
   */
  function recordMonsterKills(monsterKills: Record<string, number>) {
    const now = Date.now()
    for (const [name, count] of Object.entries(monsterKills)) {
      if (!bestiary.value[name]) {
        bestiary.value[name] = { kills: 0, firstKillTime: now, deaths: 0 }
      }
      bestiary.value[name].kills += count
    }
    // Save immediately - bestiary data is important
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after recordMonsterKills:', err)
    )
  }

  /**
   * Record a death caused by a specific monster
   */
  function recordMonsterDeath(monsterName: string) {
    const now = Date.now()
    if (!bestiary.value[monsterName]) {
      bestiary.value[monsterName] = { kills: 0, firstKillTime: now, deaths: 0 }
    }
    const entry = bestiary.value[monsterName]
    entry.deaths = (entry.deaths ?? 0) + 1
    if (!entry.firstDeathTime) {
      entry.firstDeathTime = now
    }
    // Save immediately
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after recordMonsterDeath:', err)
    )
  }

  /**
   * Record item discoveries from a completed run into the catalog
   */
  function recordItemDiscoveries(
    itemsDiscovered: Record<string, { depth: number; isArtifact: boolean }>
  ) {
    const now = Date.now()
    let hasNewDiscoveries = false
    for (const [name, info] of Object.entries(itemsDiscovered)) {
      if (!itemArmory.value[name]) {
        itemArmory.value[name] = {
          firstFoundTime: now,
          firstFoundDepth: info.depth,
          isArtifact: info.isArtifact,
        }
        hasNewDiscoveries = true
      }
    }
    // Only save if we found new items
    if (hasNewDiscoveries) {
      saveImmediately().catch((err) =>
        console.error('[Progression] Failed to save after recordItemDiscoveries:', err)
      )
    }
  }

  // Achievement getters
  function isAchievementUnlocked(id: string): boolean {
    return achievementState.value.unlocked.has(id)
  }

  function getAchievementProgress(id: string): number {
    return achievementState.value.progress[id] ?? 0
  }

  /**
   * Award an achievement if not already unlocked
   * Does NOT grant essence - player must click to collect
   * @returns true if newly awarded, false if already unlocked
   */
  function awardAchievement(id: string): boolean {
    if (achievementState.value.unlocked.has(id)) return false

    const achievement = getAchievementById(id)
    if (!achievement) return false

    achievementState.value.unlocked.add(id)
    achievementState.value.newUnlocks.add(id)

    console.log(
      `[Progression] Achievement unlocked: ${achievement.name} (click to claim ${achievement.reward} essence)`
    )
    // Save immediately - achievement unlock is important
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after awardAchievement:', err)
    )
    return true
  }

  /**
   * Check if an achievement's essence has been collected
   */
  function isAchievementCollected(id: string): boolean {
    return achievementState.value.collected.has(id)
  }

  /**
   * Collect essence reward for an unlocked achievement
   * @returns true if essence was collected, false if not unlocked or already collected
   */
  function collectAchievement(id: string): boolean {
    // Must be unlocked but not yet collected
    if (!achievementState.value.unlocked.has(id)) return false
    if (achievementState.value.collected.has(id)) return false

    const achievement = getAchievementById(id)
    if (!achievement) return false

    achievementState.value.collected.add(id)
    addEssence(achievement.reward)

    console.log(
      `[Progression] Achievement claimed: ${achievement.name} (+${achievement.reward} essence)`
    )
    // Save happens via addEssence
    return true
  }

  /**
   * Update progress for cumulative achievements
   */
  function updateAchievementProgress(id: string, value: number) {
    achievementState.value.progress[id] = value
  }

  /**
   * Clear the new achievements notification
   */
  function clearNewAchievements() {
    achievementState.value.newUnlocks.clear()
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
    saveImmediately().catch((err) =>
      console.error('[Progression] Failed to save after prestige:', err)
    )
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
    winHistory,
    topRunsByDepth,
    topRunsByEssence,
    topRunsByKills,
    upgradeLevels,
    prestigeLevel,
    lifetimeEssence,
    totalVictories,
    activeLoadout,
    bestiary,
    itemArmory,

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
    armoryStats,

    // Achievement state and computed
    achievementState,
    achievementStats,
    hasNewAchievements,

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
    recordMonsterDeath,
    recordItemDiscoveries,
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

    // Config performance analytics
    getConfigPerformance,

    // Bot capability actions
    purchaseBotUpgrade,
    toggleBotCapability,
    setActiveGradedLevel,
    getEffectiveCapabilities,

    // Achievement getters and actions
    isAchievementUnlocked,
    isAchievementCollected,
    getAchievementProgress,
    awardAchievement,
    collectAchievement,
    updateAchievementProgress,
    clearNewAchievements,
  }
})
