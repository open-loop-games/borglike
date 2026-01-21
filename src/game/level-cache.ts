/**
 * Level Cache Management for Borglike
 *
 * LRU (Least Recently Used) cache for dungeon levels.
 * Keeps recently visited levels in memory while evicting old ones.
 */

import type { DungeonLevel } from './types'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum number of levels to keep in cache (LRU eviction beyond this) */
export const LEVEL_CACHE_MAX_SIZE = 12

// ============================================================================
// LRU CACHE OPERATIONS
// ============================================================================

/**
 * Touch a level in the cache to mark it as recently used (LRU)
 * Moves the level to the end of the Map iteration order
 *
 * @param cache - The level cache Map
 * @param depth - The depth to mark as recently used
 */
export function touchLevelCache(cache: Map<number, DungeonLevel>, depth: number): void {
  const level = cache.get(depth)
  if (level) {
    cache.delete(depth)
    cache.set(depth, level)
  }
}

/**
 * Evict old levels from cache to stay within size limit
 * Protects current depth and adjacent levels (±1) from eviction
 *
 * @param cache - The level cache Map
 * @param currentDepth - Current depth to protect
 * @param maxSize - Maximum cache size (default: LEVEL_CACHE_MAX_SIZE)
 */
export function evictOldLevels(
  cache: Map<number, DungeonLevel>,
  currentDepth: number,
  maxSize: number = LEVEL_CACHE_MAX_SIZE
): void {
  while (cache.size > maxSize) {
    // Get oldest entry (first in Map iteration order)
    const oldestDepth = cache.keys().next().value
    if (oldestDepth === undefined) break

    // Don't evict current level or adjacent levels (needed for ascend/descend)
    if (Math.abs(oldestDepth - currentDepth) <= 1) {
      // Can't evict protected levels, stop trying
      break
    }
    cache.delete(oldestDepth)
  }
}

/**
 * Get a level from cache, touching it to mark as recently used
 *
 * @param cache - The level cache Map
 * @param depth - The depth to retrieve
 * @returns The dungeon level or undefined if not cached
 */
export function getCachedLevel(
  cache: Map<number, DungeonLevel>,
  depth: number
): DungeonLevel | undefined {
  const level = cache.get(depth)
  if (level) {
    touchLevelCache(cache, depth)
  }
  return level
}

/**
 * Add a level to cache, evicting old levels if necessary
 *
 * @param cache - The level cache Map
 * @param depth - The depth to cache
 * @param level - The dungeon level to cache
 * @param currentDepth - Current depth for eviction protection
 */
export function cacheLevel(
  cache: Map<number, DungeonLevel>,
  depth: number,
  level: DungeonLevel,
  currentDepth: number
): void {
  cache.set(depth, level)
  evictOldLevels(cache, currentDepth)
}

/**
 * Check if a level is in the cache
 *
 * @param cache - The level cache Map
 * @param depth - The depth to check
 * @returns True if the level is cached
 */
export function isLevelCached(cache: Map<number, DungeonLevel>, depth: number): boolean {
  return cache.has(depth)
}

/**
 * Get cache statistics for debugging
 *
 * @param cache - The level cache Map
 * @returns Object with cache stats
 */
export function getCacheStats(cache: Map<number, DungeonLevel>): {
  size: number
  depths: number[]
  maxSize: number
} {
  return {
    size: cache.size,
    depths: Array.from(cache.keys()),
    maxSize: LEVEL_CACHE_MAX_SIZE,
  }
}

/**
 * Clear all levels from the cache
 *
 * @param cache - The level cache Map
 */
export function clearCache(cache: Map<number, DungeonLevel>): void {
  cache.clear()
}
