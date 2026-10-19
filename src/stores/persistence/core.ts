/**
 * Persistence Core
 *
 * Backend-agnostic primitives: schema, validation, compression, Pinia <->
 * ProgressionData (de)serialization, migrations.
 *
 * Knows about Pinia stores but not about IndexedDB, the filesystem, or any
 * particular storage transport. The backend interface (backend.ts) is the
 * boundary; orchestration (index.ts) wires the two together.
 */

import LZString from 'lz-string'
import { useProgressionStore, type UpgradeState } from '../progression'
import type {
  Currency,
  UnlockState,
  GlobalStats,
  RunStats,
  BestiaryEntry,
  ArmoryEntry,
  SlotConfig,
  BotCapabilities,
} from '@/types/progression'
import { startingRaces } from '@game/data/races'
import { startingClasses } from '@game/data/classes'
import { STAR_UPGRADES } from '@game/data/ascension'

// ============================================================================
// VERSIONING
// ============================================================================

/** Save format version — sourced from package.json via Vite define */
export const SAVE_VERSION = __APP_VERSION__

// ============================================================================
// VALIDATION
// ============================================================================

interface ValidationError {
  path: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  repaired: boolean
}

function checkForNaN(obj: unknown, path: string, errors: ValidationError[]): void {
  if (obj === null || obj === undefined) return

  if (typeof obj === 'number' && Number.isNaN(obj)) {
    errors.push({ path: path || 'root', message: 'NaN value detected', severity: 'error' })
    return
  }

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => checkForNaN(item, `${path}[${i}]`, errors))
    return
  }

  if (typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      checkForNaN(value, path ? `${path}.${key}` : key, errors)
    }
  }
}

/**
 * Validate progression data structure and values.
 * Auto-repairs obvious issues where safe (negative values, etc.)
 */
export function validateProgressionData(data: ProgressionData): ValidationResult {
  const errors: ValidationError[] = []
  let repaired = false

  checkForNaN(data, '', errors)

  if (!data.version) {
    errors.push({ path: 'version', message: 'Missing version', severity: 'warning' })
    data.version = SAVE_VERSION
    repaired = true
  }

  if (!data.currency) {
    errors.push({ path: 'currency', message: 'Missing currency object', severity: 'error' })
  } else if (typeof data.currency.essence === 'number' && data.currency.essence < 0) {
    errors.push({
      path: 'currency.essence',
      message: 'Negative essence repaired',
      severity: 'warning',
    })
    data.currency.essence = 0
    repaired = true
  }

  if (!data.unlocks) {
    errors.push({ path: 'unlocks', message: 'Missing unlocks object', severity: 'error' })
  } else {
    if (!Array.isArray(data.unlocks.races)) {
      errors.push({ path: 'unlocks.races', message: 'Invalid races unlock', severity: 'error' })
    }
    if (!Array.isArray(data.unlocks.classes)) {
      errors.push({ path: 'unlocks.classes', message: 'Invalid classes unlock', severity: 'error' })
    }
  }

  if (typeof data.lifetimeEssence === 'number' && data.lifetimeEssence < 0) {
    errors.push({
      path: 'lifetimeEssence',
      message: 'Negative lifetime essence repaired',
      severity: 'warning',
    })
    data.lifetimeEssence = 0
    repaired = true
  }

  return {
    valid: errors.filter((e) => e.severity === 'error').length === 0,
    errors,
    repaired,
  }
}

// ============================================================================
// COMPRESSION
// ============================================================================

/** Marker prefix for compressed data in sync-backup storage */
export const COMPRESSION_MARKER = 'LZ:'

/** Export format magic header */
export const EXPORT_MAGIC_V2 = 'BORGLIKE_V2_'

export function compressForStorage(data: ProgressionData): string {
  const json = JSON.stringify(data)
  return COMPRESSION_MARKER + LZString.compressToUTF16(json)
}

export function decompressFromStorage(stored: string): ProgressionData {
  if (stored.startsWith(COMPRESSION_MARKER)) {
    const compressed = stored.slice(COMPRESSION_MARKER.length)
    const json = LZString.decompressFromUTF16(compressed)
    if (!json) throw new Error('Failed to decompress backup')
    return JSON.parse(json) as ProgressionData
  }

  // v1 backward compatibility: raw JSON
  return JSON.parse(stored) as ProgressionData
}

// ============================================================================
// SCHEMA
// ============================================================================

export interface SerializedUnlockState {
  races: string[]
  classes: string[]
  runSlots: number
  upgrades: string[]
  boosters: string[]
}

export interface SerializedAchievementState {
  unlocked: string[]
  collected: string[]
  progress: Record<string, number>
  // newUnlocks is intentionally NOT persisted - session-only state.
}

export interface SerializedRunLoadout {
  boosters: [string | null, string | null]
}

export interface ProgressionData {
  version: string
  currency: Currency
  unlocks: SerializedUnlockState
  globalStats: GlobalStats
  upgradeLevels: UpgradeState
  lifetimeEssence: number
  totalVictories: number
  // Ascension tree (studio/borglike#8). The star balance derives from victories.
  starUpgradeLevels?: Record<string, number>
  // Progressive disclosure (studio/borglike#2). Optional: absent in pre-feature
  // saves, reconstructed on restore.
  totalUpgradeSpent?: number
  toastedReveals?: string[]
  activeLoadout?: SerializedRunLoadout
  bestiary?: Record<string, BestiaryEntry>
  itemArmory?: Record<string, ArmoryEntry>
  slotConfigs?: SlotConfig[]
  botCapabilities?: BotCapabilities
  achievements?: SerializedAchievementState
  topRunsByDepth?: RunStats[]
  topRunsByEssence?: RunStats[]
  topRunsByKills?: RunStats[]
  winHistory?: RunStats[]
}

// ============================================================================
// SET (DE)SERIALIZATION
// ============================================================================

function serializeUnlocks(unlocks: UnlockState): SerializedUnlockState {
  return {
    races: Array.from(unlocks.races),
    classes: Array.from(unlocks.classes),
    runSlots: unlocks.runSlots,
    upgrades: Array.from(unlocks.upgrades),
    boosters: Array.from(unlocks.boosters),
  }
}

function deserializeUnlocks(data: SerializedUnlockState): UnlockState {
  return {
    races: new Set(data.races),
    classes: new Set(data.classes),
    runSlots: data.runSlots,
    upgrades: new Set(data.upgrades),
    boosters: new Set(data.boosters ?? []),
  }
}

function serializeAchievements(state: {
  unlocked: Set<string>
  collected: Set<string>
  progress: Record<string, number>
  newUnlocks: Set<string>
}): SerializedAchievementState {
  return {
    unlocked: Array.from(state.unlocked),
    collected: Array.from(state.collected),
    progress: { ...state.progress },
  }
}

function deserializeAchievements(data: SerializedAchievementState): {
  unlocked: Set<string>
  collected: Set<string>
  progress: Record<string, number>
  newUnlocks: Set<string>
} {
  return {
    unlocked: new Set(data.unlocked),
    collected: new Set(data.collected ?? []),
    progress: data.progress ?? {},
    newUnlocks: new Set(), // Always fresh — indicator is session-only
  }
}

// ============================================================================
// MIGRATIONS
// ============================================================================

function runMigrations(): void {
  const progression = useProgressionStore()

  for (const race of startingRaces) {
    progression.unlocks.races.add(race.name)
  }

  for (const cls of startingClasses) {
    progression.unlocks.classes.add(cls.name)
  }
}

// ============================================================================
// PINIA <-> ProgressionData
// ============================================================================

/**
 * Serialize the current progression store into ProgressionData.
 *
 * Returns plain JSON-safe data — Vue reactivity proxies and Set instances are
 * stripped here so backends can write the value directly without re-cloning.
 */
export function serializeProgression(): ProgressionData {
  const progression = useProgressionStore()

  const serializedSlotConfigs = progression.slotConfigs.map((config) => ({
    race: config.race,
    class: config.class,
    personality: config.personality,
    boosters: [config.boosters[0], config.boosters[1]] as [string | null, string | null],
    toggles: { ...config.toggles },
    surfLevelRange: config.surfLevelRange ? { ...config.surfLevelRange } : undefined,
    customPersonality: config.customPersonality ? { ...config.customPersonality } : undefined,
    activeSurfLevel: config.activeSurfLevel,
    dungeonMode: config.dungeonMode ?? 'classic',
  }))

  const serializedBestiary: Record<string, BestiaryEntry> = {}
  for (const [key, entry] of Object.entries(progression.bestiary)) {
    serializedBestiary[key] = {
      kills: entry.kills,
      firstKillTime: entry.firstKillTime,
      deaths: entry.deaths ?? 0,
      firstDeathTime: entry.firstDeathTime,
    }
  }

  const serializedItemCatalog: Record<string, ArmoryEntry> = {}
  for (const [key, entry] of Object.entries(progression.itemArmory)) {
    serializedItemCatalog[key] = {
      firstFoundTime: entry.firstFoundTime,
      firstFoundDepth: entry.firstFoundDepth,
      isArtifact: entry.isArtifact,
    }
  }

  const data: ProgressionData = {
    version: SAVE_VERSION,
    currency: { essence: progression.currency.essence },
    unlocks: serializeUnlocks(progression.unlocks),
    globalStats: { ...progression.globalStats },
    upgradeLevels: { ...progression.upgradeLevels },
    lifetimeEssence: progression.lifetimeEssence,
    totalVictories: progression.totalVictories,
    starUpgradeLevels: { ...progression.starUpgradeLevels },
    totalUpgradeSpent: progression.totalUpgradeSpent,
    toastedReveals: Array.from(progression.toastedReveals),
    activeLoadout: {
      boosters: [progression.activeLoadout.boosters[0], progression.activeLoadout.boosters[1]],
    },
    bestiary: serializedBestiary,
    itemArmory: serializedItemCatalog,
    slotConfigs: serializedSlotConfigs,
    botCapabilities: { ...progression.botCapabilities },
    achievements: serializeAchievements(progression.achievementState),
    topRunsByDepth: [...progression.topRunsByDepth],
    topRunsByEssence: [...progression.topRunsByEssence],
    topRunsByKills: [...progression.topRunsByKills],
    winHistory: [...progression.winHistory],
  }

  // Strip Vue reactivity proxies so backends (e.g. IDB structured-clone) see
  // plain JSON-safe data. Cheap; runs only on save paths.
  return JSON.parse(JSON.stringify(data)) as ProgressionData
}

export function restoreProgressionFromData(data: ProgressionData): void {
  const progression = useProgressionStore()

  progression.currency.essence = data.currency.essence

  const unlocks = deserializeUnlocks(data.unlocks)
  progression.unlocks.races = unlocks.races
  progression.unlocks.classes = unlocks.classes
  progression.unlocks.runSlots = unlocks.runSlots
  progression.unlocks.upgrades = unlocks.upgrades
  progression.unlocks.boosters = unlocks.boosters

  Object.assign(progression.globalStats, data.globalStats)
  Object.assign(progression.upgradeLevels, data.upgradeLevels)

  progression.lifetimeEssence = data.lifetimeEssence ?? 0
  progression.totalVictories = data.totalVictories ?? 0
  // Levels of nodes no longer in the tree are dropped, so they cost no stars.
  progression.starUpgradeLevels = Object.fromEntries(
    Object.entries(data.starUpgradeLevels ?? {}).filter(([id]) =>
      STAR_UPGRADES.some((u) => u.id === id)
    )
  )

  if (data.activeLoadout) {
    progression.activeLoadout.boosters = data.activeLoadout.boosters
  }

  if (data.bestiary) {
    Object.assign(progression.bestiary, data.bestiary)
  }

  if (data.itemArmory) {
    Object.assign(progression.itemArmory, data.itemArmory)
  }

  if (data.slotConfigs) {
    progression.slotConfigs.length = 0
    progression.slotConfigs.push(...data.slotConfigs)
  }

  if (data.botCapabilities) {
    progression.botCapabilities = { ...data.botCapabilities }
  }

  // Reveal state — after upgradeLevels + botCapabilities so the backfill (for
  // pre-feature saves lacking totalUpgradeSpent) can reconstruct from them.
  progression.restoreReveal(data.totalUpgradeSpent, data.toastedReveals)

  if (data.achievements) {
    const achievements = deserializeAchievements(data.achievements)
    progression.achievementState.unlocked = achievements.unlocked
    progression.achievementState.collected = achievements.collected
    progression.achievementState.progress = achievements.progress
    progression.achievementState.newUnlocks = achievements.newUnlocks
  }

  if (data.topRunsByDepth) {
    progression.topRunsByDepth.length = 0
    progression.topRunsByDepth.push(...data.topRunsByDepth)
  }
  if (data.topRunsByEssence) {
    progression.topRunsByEssence.length = 0
    progression.topRunsByEssence.push(...data.topRunsByEssence)
  }
  if (data.topRunsByKills) {
    progression.topRunsByKills.length = 0
    progression.topRunsByKills.push(...data.topRunsByKills)
  }

  if (data.winHistory) {
    progression.winHistory.length = 0
    progression.winHistory.push(...data.winHistory)
  }

  runMigrations()
}

// ============================================================================
// EXPORT FORMAT (data-shape only — I/O lives in index.ts)
// ============================================================================

export interface ExportPayload {
  version: string
  exportedAt?: number
  progression: {
    currency: Currency
    unlocks: SerializedUnlockState
    globalStats: GlobalStats
    upgradeLevels: UpgradeState
    lifetimeEssence: number
    totalVictories: number
    starUpgradeLevels?: Record<string, number>
    totalUpgradeSpent?: number
    toastedReveals?: string[]
    activeLoadout?: SerializedRunLoadout
    bestiary?: Record<string, BestiaryEntry>
    itemArmory?: Record<string, ArmoryEntry>
    slotConfigs?: SlotConfig[]
    botCapabilities?: BotCapabilities
    achievements?: SerializedAchievementState
    topRunsByDepth?: RunStats[]
    topRunsByEssence?: RunStats[]
    topRunsByKills?: RunStats[]
    winHistory?: RunStats[]
  }
  runHistory?: RunStats[]
}

export function buildExportPayload(runHistory: RunStats[]): ExportPayload {
  const progression = useProgressionStore()

  return {
    version: SAVE_VERSION,
    exportedAt: Date.now(),
    progression: {
      currency: { ...progression.currency },
      unlocks: serializeUnlocks(progression.unlocks),
      globalStats: { ...progression.globalStats },
      upgradeLevels: { ...progression.upgradeLevels },
      lifetimeEssence: progression.lifetimeEssence,
      totalVictories: progression.totalVictories,
      starUpgradeLevels: { ...progression.starUpgradeLevels },
      totalUpgradeSpent: progression.totalUpgradeSpent,
      toastedReveals: Array.from(progression.toastedReveals),
      activeLoadout: { boosters: [...progression.activeLoadout.boosters] },
      bestiary: { ...progression.bestiary },
      itemArmory: { ...progression.itemArmory },
      slotConfigs: progression.slotConfigs.map((config) => ({ ...config })),
      botCapabilities: { ...progression.botCapabilities },
      achievements: serializeAchievements(progression.achievementState),
      topRunsByDepth: [...progression.topRunsByDepth],
      topRunsByEssence: [...progression.topRunsByEssence],
      topRunsByKills: [...progression.topRunsByKills],
      winHistory: [...progression.winHistory],
    },
    runHistory,
  }
}

export function progressionDataFromExport(payload: ExportPayload): ProgressionData {
  const prog = payload.progression
  return {
    version: SAVE_VERSION,
    currency: prog.currency,
    unlocks: prog.unlocks,
    globalStats: prog.globalStats,
    upgradeLevels: prog.upgradeLevels,
    lifetimeEssence: prog.lifetimeEssence,
    totalVictories: prog.totalVictories,
    starUpgradeLevels: prog.starUpgradeLevels,
    totalUpgradeSpent: prog.totalUpgradeSpent,
    toastedReveals: prog.toastedReveals,
    activeLoadout: prog.activeLoadout,
    bestiary: prog.bestiary,
    itemArmory: prog.itemArmory,
    slotConfigs: prog.slotConfigs,
    botCapabilities: prog.botCapabilities,
    achievements: prog.achievements,
    topRunsByDepth: prog.topRunsByDepth,
    topRunsByEssence: prog.topRunsByEssence,
    topRunsByKills: prog.topRunsByKills,
    winHistory: prog.winHistory,
  }
}

// ============================================================================
// RUN HISTORY PINIA SYNC
// ============================================================================

export function setRunHistoryInStore(runs: RunStats[]): void {
  const progression = useProgressionStore()
  progression.runHistory.length = 0
  progression.runHistory.push(...runs.slice(0, 100)) // Keep only last 100
}
