<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import type { GridCell } from '@/stores/runs'

const props = defineProps<{
  grid: GridCell[][]
  cursorX: number
  cursorY: number
  width?: number
  height?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// Grid dimensions
const COLS = props.width || 80
const ROWS = props.height || 24

// Character cell size (will be calculated based on container)
let cellWidth = 10
let cellHeight = 16
let fontSize = 14

// Canvas context
let ctx: CanvasRenderingContext2D | null = null

// Colors
const CURSOR_BG = 'rgba(99, 102, 241, 0.3)'
const PLAYER_CURSOR_BG = 'rgba(34, 197, 94, 0.2)'

function colorToHex(color: number): string {
  if (color === 0) return '#475569'
  return '#' + color.toString(16).padStart(6, '0')
}

function calculateSize() {
  if (!containerRef.value || !canvasRef.value) return

  const container = containerRef.value
  const rect = container.getBoundingClientRect()

  // Target aspect ratio for monospace: ~0.6 width/height per character
  const charAspect = 0.6

  // Calculate cell size to fit container while maintaining character aspect ratio
  // Try fitting by height first
  const cellByHeight = Math.floor(rect.height / ROWS)
  const widthByHeight = cellByHeight * charAspect

  // Try fitting by width
  const cellWidthByWidth = Math.floor(rect.width / COLS)
  const cellByWidth = cellWidthByWidth / charAspect

  // Use whichever fits (smaller of the two)
  if (widthByHeight * COLS <= rect.width) {
    // Height-constrained
    cellHeight = cellByHeight
    cellWidth = Math.floor(widthByHeight)
  } else {
    // Width-constrained
    cellWidth = cellWidthByWidth
    cellHeight = Math.floor(cellByWidth)
  }

  // Ensure minimum readable size
  cellHeight = Math.max(cellHeight, 12)
  cellWidth = Math.max(cellWidth, 7)

  fontSize = Math.floor(cellHeight * 0.85)

  // Set canvas size
  const canvas = canvasRef.value
  canvas.width = COLS * cellWidth
  canvas.height = ROWS * cellHeight

  // Get context and set font
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = `${fontSize}px monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
  }
}

function render() {
  if (!ctx || !canvasRef.value) return

  const canvas = canvasRef.value

  // Clear
  ctx.fillStyle = '#0a0a12'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw cells
  for (let y = 0; y < ROWS && y < props.grid.length; y++) {
    const row = props.grid[y]
    if (!row) continue

    for (let x = 0; x < COLS && x < row.length; x++) {
      const cell = row[x]
      if (!cell || cell.char === ' ') continue

      const px = x * cellWidth
      const py = y * cellHeight

      // Draw cursor background
      if (x === props.cursorX && y === props.cursorY) {
        ctx.fillStyle = cell.char === '@' ? PLAYER_CURSOR_BG : CURSOR_BG
        ctx.fillRect(px, py, cellWidth, cellHeight)
      }

      // Draw character
      ctx.fillStyle = colorToHex(cell.color)
      ctx.fillText(cell.char, px + cellWidth / 2, py + cellHeight / 2)
    }
  }
}

// Resize observer for responsive sizing
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  calculateSize()
  render()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      calculateSize()
      render()
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

// Debounced render using requestAnimationFrame
// This batches all the cell updates into a single frame
let renderScheduled = false
function scheduleRender() {
  if (renderScheduled) return
  renderScheduled = true
  requestAnimationFrame(() => {
    renderScheduled = false
    render()
  })
}

// Watch for grid reference change (deep:false - grid is replaced entirely each tick)
// This is O(1) instead of O(1920) for change detection
watch(() => props.grid, scheduleRender)
watch(() => props.cursorX, scheduleRender)
watch(() => props.cursorY, scheduleRender)
</script>

<template>
  <div ref="containerRef" class="dungeon-grid-canvas">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>

<style scoped>
.dungeon-grid-canvas {
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 0; /* Important for flex children to shrink */
  background: #0a0a12;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
</style>
