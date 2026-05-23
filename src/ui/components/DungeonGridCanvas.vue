<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { GridCell } from '@/stores/runs'
import { useSettingsStore, FONT_OPTIONS } from '@/stores/settings'

const props = defineProps<{
  grid: GridCell[][]
  cursorX: number
  cursorY: number
  width?: number
  height?: number
}>()

const settingsStore = useSettingsStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// CSS font-family string derived from user setting
const fontCss = computed(() => {
  const opt = FONT_OPTIONS.find((f) => f.id === settingsStore.settings.fontFamily)
  return opt?.css ?? 'monospace'
})

// Grid dimensions — the full engine viewport, in cells. Must match
// VIEWPORT_* in engine/instance-manager.ts and createEmptyGrid() in
// stores/runs.ts.
const COLS = props.width || 80
const ROWS = props.height || 32

// Readable floor for cells. If fitting the full grid would force cells smaller
// than this, we hold the floor and crop the displayed window instead — the
// camera follows the player (mirrors the engine-side viewport behavior in
// instance-manager.ts:calculateViewport).
const MIN_CELL_HEIGHT = 14

// Upper bound on cell size. When the container has more room than the full
// grid needs at this size, cells stop growing — fewer cols/rows visible and
// the camera scrolls instead. Stops glyphs from looking pixely in wide panes.
const TARGET_CELL_HEIGHT = 20

// Character cell size (will be calculated based on container)
let cellWidth = 10
let cellHeight = 16
let fontSize = 14

// Window of cells actually drawn this layout. Equals COLS/ROWS when the
// container is wide enough; shrinks when not.
let visibleCols = COLS
let visibleRows = ROWS

// Camera origin (window's top-left in grid coords). Persisted between renders
// so the deadzone scroll only shifts when the cursor crosses the edge bands —
// otherwise the camera holds steady even as the player wanders inside.
// NaN means "uninitialized; center on cursor next render".
let lastStartX = NaN
let lastStartY = NaN
// Fraction of the visible window kept as edge band on each side. Cursor only
// shifts the camera when it enters one of these bands.
const DEADZONE_FRACTION = 0.2

// Canvas context
let ctx: CanvasRenderingContext2D | null = null

// Colors
const CURSOR_BG = 'color-mix(in srgb, var(--accent) 30%, transparent)'

function resolveSuccessColor(): string {
  if (!canvasRef.value) return '#22c55e'
  const c = getComputedStyle(canvasRef.value).getPropertyValue('--success').trim()
  return c || '#22c55e'
}

function colorToHex(color: number): string {
  if (color === 0) return '#475569'
  return '#' + color.toString(16).padStart(6, '0')
}

/** Measure actual character width/height ratio for the current font */
function measureCharAspect(): number {
  if (!canvasRef.value) return 0.6
  const tempCtx = canvasRef.value.getContext('2d')
  if (!tempCtx) return 0.6
  const sampleSize = 100
  tempCtx.font = `${sampleSize}px ${fontCss.value}`
  return tempCtx.measureText('M').width / sampleSize
}

function calculateSize() {
  if (!containerRef.value || !canvasRef.value) return

  const container = containerRef.value
  const rect = container.getBoundingClientRect()

  // Measure real character aspect ratio from the active font
  const charAspect = measureCharAspect()

  // Pass 1: try fitting the full COLS×ROWS grid into the container.
  const cellByHeight = Math.floor(rect.height / ROWS)
  const widthByHeight = cellByHeight * charAspect
  const cellWidthByWidth = Math.floor(rect.width / COLS)
  const cellByWidth = cellWidthByWidth / charAspect

  if (widthByHeight * COLS <= rect.width) {
    cellHeight = cellByHeight
    cellWidth = Math.floor(widthByHeight)
  } else {
    cellWidth = cellWidthByWidth
    cellHeight = Math.floor(cellByWidth)
  }

  // Pass 2: cap at target size. If pass 1 wants cells bigger than the target
  // (huge container, small grid), hold the cap — the visible window stays at
  // the full grid, just with bigger glyphs unused. The camera handles any
  // overflow below.
  const maxCellW = Math.max(MIN_CELL_HEIGHT, Math.floor(TARGET_CELL_HEIGHT * charAspect))
  if (cellHeight > TARGET_CELL_HEIGHT) cellHeight = TARGET_CELL_HEIGHT
  if (cellWidth > maxCellW) cellWidth = maxCellW

  // Pass 3: if the full-fit would shrink cells below readable, hold the floor
  // and let the visible window shrink instead. Camera follows the player
  // (see render() — startX/startY centered on cursor, clamped to grid bounds).
  const minCellH = MIN_CELL_HEIGHT
  const minCellW = Math.max(8, Math.floor(minCellH * charAspect))
  if (cellHeight < minCellH || cellWidth < minCellW) {
    cellHeight = minCellH
    cellWidth = minCellW
  }

  visibleCols = Math.min(COLS, Math.max(1, Math.floor(rect.width / cellWidth)))
  visibleRows = Math.min(ROWS, Math.max(1, Math.floor(rect.height / cellHeight)))

  // Window changed — clamp the held camera origin so the player stays visible.
  // NaN passes through and triggers center-on-cursor in render().
  if (!isNaN(lastStartX)) {
    lastStartX = Math.max(0, Math.min(COLS - visibleCols, lastStartX))
    lastStartY = Math.max(0, Math.min(ROWS - visibleRows, lastStartY))
  }

  fontSize = Math.floor(cellHeight * 0.85)

  // Set canvas size (resets context state)
  const canvas = canvasRef.value
  canvas.width = visibleCols * cellWidth
  canvas.height = visibleRows * cellHeight

  // Re-apply context state after resize
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.font = `${fontSize}px ${fontCss.value}`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
  }
}

function resolveBgColor(): string {
  if (!canvasRef.value) return '#0a0a12'
  const bg = getComputedStyle(canvasRef.value).getPropertyValue('--bg').trim()
  return bg || '#0a0a12'
}

function render() {
  if (!ctx || !canvasRef.value) return

  const canvas = canvasRef.value

  // Clear
  ctx.fillStyle = resolveBgColor()
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Camera with deadzone: hold the previous origin unless the cursor has
  // drifted into the edge band. When it has, shift the camera just enough to
  // put the cursor back at the deadzone edge. First render (NaN) centers.
  const halfCols = Math.floor(visibleCols / 2)
  const halfRows = Math.floor(visibleRows / 2)
  let startX: number
  let startY: number
  if (isNaN(lastStartX)) {
    startX = props.cursorX - halfCols
    startY = props.cursorY - halfRows
  } else {
    const deadX = Math.max(1, Math.floor(visibleCols * DEADZONE_FRACTION))
    const deadY = Math.max(1, Math.floor(visibleRows * DEADZONE_FRACTION))
    const vx = props.cursorX - lastStartX
    const vy = props.cursorY - lastStartY
    startX = lastStartX
    startY = lastStartY
    if (vx < deadX) startX = props.cursorX - deadX
    else if (vx > visibleCols - deadX - 1) startX = props.cursorX - (visibleCols - deadX - 1)
    if (vy < deadY) startY = props.cursorY - deadY
    else if (vy > visibleRows - deadY - 1) startY = props.cursorY - (visibleRows - deadY - 1)
  }
  // Clamp to grid bounds
  startX = Math.max(0, Math.min(COLS - visibleCols, startX))
  startY = Math.max(0, Math.min(ROWS - visibleRows, startY))
  lastStartX = startX
  lastStartY = startY

  const successColor = resolveSuccessColor()
  const glowBlur = cellHeight * 0.6
  // Defer the player glyph so the radial glow paints over neighbours rather
  // than getting overwritten by later cells. Painted as a final pass below.
  let playerDraw: { px: number; py: number; char: string; color: string } | null = null

  for (let vy = 0; vy < visibleRows; vy++) {
    const y = startY + vy
    const row = props.grid[y]
    if (!row) continue

    for (let vx = 0; vx < visibleCols; vx++) {
      const x = startX + vx
      const cell = row[x]
      if (!cell || cell.char === ' ') continue

      const px = vx * cellWidth
      const py = vy * cellHeight
      const isPlayer = x === props.cursorX && y === props.cursorY && cell.char === '@'

      // Draw cursor background (non-player tiles only — player gets a glow instead)
      if (x === props.cursorX && y === props.cursorY && !isPlayer) {
        ctx.fillStyle = CURSOR_BG
        ctx.fillRect(px, py, cellWidth, cellHeight)
      }

      if (isPlayer) {
        playerDraw = { px, py, char: cell.char, color: colorToHex(cell.color) }
        continue
      }

      // Draw character
      ctx.fillStyle = colorToHex(cell.color)
      ctx.fillText(cell.char, px + cellWidth / 2, py + cellHeight / 2)
    }
  }

  if (playerDraw) {
    ctx.save()
    ctx.shadowColor = successColor
    ctx.shadowBlur = glowBlur
    ctx.fillStyle = playerDraw.color
    // Two passes so the glow accumulates to a visible halo without making the
    // glyph itself look fuzzy — shadowBlur softens fast at moderate radii.
    ctx.fillText(playerDraw.char, playerDraw.px + cellWidth / 2, playerDraw.py + cellHeight / 2)
    ctx.fillText(playerDraw.char, playerDraw.px + cellWidth / 2, playerDraw.py + cellHeight / 2)
    ctx.restore()
  }
}

// Resize observer for responsive sizing
let resizeObserver: ResizeObserver | null = null
// Theme observer — repaint canvas bg when [data-theme] changes
let themeObserver: MutationObserver | null = null

onMounted(async () => {
  await document.fonts.ready
  calculateSize()
  render()

  if (containerRef.value) {
    resizeObserver = new ResizeObserver(() => {
      calculateSize()
      render()
    })
    resizeObserver.observe(containerRef.value)
  }

  themeObserver = new MutationObserver(() => scheduleRender())
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
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

// Recalculate cell sizing + re-render when font changes (may load async from Google Fonts)
watch(fontCss, async () => {
  await document.fonts.ready
  calculateSize()
  render()
})
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
  background: var(--bg);
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
