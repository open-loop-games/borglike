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

// Determine cell type based on character
function getCellType(char: string, _color: number): string {
  // Player
  if (char === '@') return 'cell-player'

  // Dungeon features
  if (char === '.' || char === ',') return 'cell-floor'
  if (char === '#') return 'cell-wall'
  if (char === '+') return 'cell-door'
  if (char === '>' || char === '<') return 'cell-stairs'

  // Items (common symbols)
  if ('!?/|\\()[]=~"$*'.includes(char)) return 'cell-item'

  // Monsters (letters and some symbols)
  if (/[a-zA-Z]/.test(char)) return 'cell-monster'

  // Unknown/empty
  if (char === ' ') return 'cell-empty'

  return 'cell-unknown'
}

// Get visibility class based on color brightness
function getVisibilityClass(color: number): string {
  if (color === 0 || color === 0x000000) return 'cell-unseen'

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

const rows = computed(() => {
  const result: GridCell[][] = []
  for (let y = 0; y < displayHeight.value && y < props.grid.length; y++) {
    const row = props.grid[y]
    if (row) {
      result.push(row.slice(0, displayWidth.value))
    }
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
    <div v-for="(row, y) in rows" :key="y" class="grid-row">
      <span
        v-for="(cell, x) in row"
        :key="x"
        class="grid-cell"
        :class="[
          getCellType(cell.char, cell.color),
          getVisibilityClass(cell.color),
          { cursor: x === cursorX && y === cursorY },
        ]"
        :style="{ color: colorToHex(cell.color) }"
        >{{ cell.char || ' ' }}</span
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
