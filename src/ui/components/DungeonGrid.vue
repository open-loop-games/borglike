<script setup lang="ts">
import { computed } from 'vue'
import type { GridCell } from '@/stores/runs'

const props = defineProps<{
  grid: GridCell[][]
  cursorX: number
  cursorY: number
  width?: number
  height?: number
}>()

// Pre-compute cell type lookup table for O(1) lookups
const CELL_TYPE_MAP: Record<string, string> = {
  '@': 'cell-player',
  '.': 'cell-floor',
  ',': 'cell-floor',
  '#': 'cell-wall',
  '+': 'cell-door',
  '>': 'cell-stairs',
  '<': 'cell-stairs',
  '≈': 'cell-fountain',
  '~': 'cell-fountain',
  _: 'cell-altar',
  P: 'cell-merchant',
  H: 'cell-healer',
  O: 'cell-portal',
  '^': 'cell-trap',
  $: 'cell-gold',
  '!': 'cell-item',
  '?': 'cell-item',
  '/': 'cell-item',
  '|': 'cell-item',
  '\\': 'cell-item',
  '(': 'cell-item',
  ')': 'cell-item',
  '[': 'cell-item',
  ']': 'cell-item',
  '=': 'cell-item',
  '*': 'cell-item',
  ' ': 'cell-empty',
}

// Determine cell type - fast lookup with monster fallback
function getCellType(char: string): string {
  const mapped = CELL_TYPE_MAP[char]
  if (mapped) return mapped
  // Monsters: letters except P (merchant)
  if ((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'O') || (char >= 'Q' && char <= 'Z')) {
    return 'cell-monster'
  }
  return 'cell-unknown'
}

// Get visibility class based on color brightness
function getVisibilityClass(color: number): string {
  if (color === 0) return 'cell-unseen'

  // Calculate brightness from RGB
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  const brightness = (r + g + b) / 3

  if (brightness < 30) return 'cell-unseen'
  if (brightness < 100) return 'cell-seen'
  return 'cell-visible'
}

function colorToHex(color: number): string {
  if (color === 0) return 'var(--text-dim)'
  return '#' + color.toString(16).padStart(6, '0')
}

const displayWidth = computed(() => props.width || 80)
const displayHeight = computed(() => props.height || 24)

// Precomputed cell data with classes - computed once per grid update
interface ProcessedCell {
  char: string
  colorHex: string
  typeClass: string
  visClass: string
}

const processedRows = computed(() => {
  const result: ProcessedCell[][] = []
  const width = displayWidth.value
  const height = displayHeight.value

  for (let y = 0; y < height && y < props.grid.length; y++) {
    const row = props.grid[y]
    if (!row) continue

    const processedRow: ProcessedCell[] = []
    const rowLen = Math.min(row.length, width)

    for (let x = 0; x < rowLen; x++) {
      const cell = row[x]
      if (!cell) continue
      processedRow.push({
        char: cell.char || ' ',
        colorHex: colorToHex(cell.color),
        typeClass: getCellType(cell.char),
        visClass: getVisibilityClass(cell.color),
      })
    }
    result.push(processedRow)
  }
  return result
})
</script>

<template>
  <div
    class="dungeon-grid"
    :style="{
      '--cols': displayWidth,
      '--rows': displayHeight,
    }"
  >
    <div v-for="(row, y) in processedRows" :key="y" class="grid-row">
      <span
        v-for="(cell, x) in row"
        :key="`${y}-${x}`"
        class="grid-cell"
        :class="[cell.typeClass, cell.visClass, { cursor: x === cursorX && y === cursorY }]"
        :style="{ color: cell.colorHex }"
        >{{ cell.char }}</span
      >
    </div>
  </div>
</template>

<style scoped>
.dungeon-grid {
  flex: 1;
  background: var(--void);
  font-family: var(--font-mono);
  font-size: 14px;
  line-height: 1;
  padding: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.grid-row {
  white-space: pre;
  height: 1.2em;
  line-height: 1.2em;
}

.grid-cell {
  display: inline-block;
  width: 0.6em;
  text-align: center;
}

/* Cell types with themed colors */
.cell-floor {
  color: var(--text-dim) !important;
}

.cell-wall {
  color: var(--text-secondary) !important;
}

.cell-door {
  color: var(--amber) !important;
}

.cell-player {
  color: var(--green) !important;
  text-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
}

.cell-monster {
  /* Color from game, but ensure visible */
}

.cell-item {
  color: var(--amber) !important;
  text-shadow: 0 0 4px rgba(245, 158, 11, 0.5);
}

.cell-stairs {
  color: var(--cyan) !important;
  text-shadow: 0 0 6px rgba(6, 182, 212, 0.6);
}

.cell-fountain {
  color: var(--cyan) !important;
  text-shadow: 0 0 6px rgba(6, 182, 212, 0.5);
}

.cell-altar {
  color: var(--amber) !important;
  text-shadow: 0 0 4px rgba(245, 158, 11, 0.4);
}

.cell-merchant {
  color: var(--amber) !important;
  text-shadow: 0 0 5px rgba(245, 158, 11, 0.6);
}

.cell-healer {
  color: var(--green) !important;
  text-shadow: 0 0 5px rgba(34, 197, 94, 0.6);
}

.cell-portal {
  color: #a855f7 !important;
  text-shadow: 0 0 8px rgba(168, 85, 247, 0.8);
}

.cell-trap {
  color: #ef4444 !important;
  text-shadow: 0 0 4px rgba(239, 68, 68, 0.6);
}

.cell-gold {
  color: #fbbf24 !important;
  text-shadow: 0 0 5px rgba(251, 191, 36, 0.7);
}

.cell-empty {
  color: transparent !important;
}

.cell-unknown {
  color: var(--text-dim) !important;
}

/* Visibility states */
.cell-visible {
  opacity: 1;
}

.cell-seen {
  opacity: 0.4;
}

.cell-unseen {
  opacity: 0;
}

/* Cursor highlight */
.grid-cell.cursor {
  background: var(--highlight);
  box-shadow: 0 0 4px rgba(99, 102, 241, 0.4);
}

/* Player cursor special styling */
.cell-player.cursor {
  background: rgba(34, 197, 94, 0.2);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.5);
}
</style>
