import { watch, shallowRef, type ComputedRef, type Ref } from 'vue'

export interface LingeredItem<T> {
  item: T
  key: string
  state: 'active' | 'fading'
}

interface LingerEntry<T> {
  item: T
  lastSeenTurn: number
}

/**
 * Keep recently-removed items rendered for a few turns so list-driven
 * sections don't bounce when individual items appear and disappear.
 * Active items come first (in source order); fading items follow.
 */
export function useItemLinger<T>(
  items: Ref<readonly T[]> | ComputedRef<readonly T[]>,
  turns: Ref<number> | ComputedRef<number>,
  keyFn: (item: T) => string,
  lingerTurns = 25
): Readonly<Ref<LingeredItem<T>[]>> {
  const seen = new Map<string, LingerEntry<T>>()
  const displayed = shallowRef<LingeredItem<T>[]>([])

  watch(
    [items, turns],
    ([currentItems, currentTurn]) => {
      for (const item of currentItems) {
        seen.set(keyFn(item), { item, lastSeenTurn: currentTurn })
      }
      for (const [key, entry] of seen) {
        if (currentTurn - entry.lastSeenTurn >= lingerTurns) {
          seen.delete(key)
        }
      }

      const activeKeys = new Set(currentItems.map(keyFn))
      const active: LingeredItem<T>[] = currentItems.map((item) => ({
        item,
        key: keyFn(item),
        state: 'active',
      }))
      const fading: LingeredItem<T>[] = []
      for (const [key, entry] of seen) {
        if (!activeKeys.has(key)) {
          fading.push({ item: entry.item, key, state: 'fading' })
        }
      }
      displayed.value = [...active, ...fading]
    },
    { immediate: true }
  )

  return displayed
}
