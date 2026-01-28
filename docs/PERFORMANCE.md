# Performance Documentation

## Current State (2026-01-27)

### Tick Budget

| Mode | Target | Measured | Status |
|------|--------|----------|--------|
| Normal (100ms) | <50ms per tick | 0.55ms avg, 3.2ms max | ✅ OK |
| Turbo (5-20ms) | <5ms per tick | 0.55ms avg, 3.2ms max | ✅ OK |
| 4x concurrent | <20ms total | ~2.2ms total | ✅ OK |

**Measurement:** Enable `PROFILE_BOT=1` environment variable to capture per-tick metrics.

### Class Comparison (50k turn limit, max-upgrades, seed=1000)

| Class | Turns | Total Time | Avg/Tick | Main Cost |
|-------|-------|------------|----------|-----------|
| Warrior | 13.8k | 6165ms | 0.45ms | handleFallback (24%) |
| Mage | 32.9k | 22595ms | 0.69ms | handleFallback (24%), getSweepFrontiers (6%) |

Mage ~53% slower per tick due to sweep mode frontier calculation (longer-lived runs spend more time in sweep). Flow computation itself is now fast (~5% of total).

---

## Profiling Infrastructure

### Built-in Profiler (`src/game/bot/profiler.ts`)

Lightweight opt-in profiler with zero overhead when disabled:

```typescript
// Enable: PROFILE_BOT=1 pnpm run dev
// Or: import { enableProfiling } from '@game/bot/profiler'

profile('buildBotContext', () => buildBotContext(state, bot))
profile('computeDangerGrid', () => computeDangerGrid(context))
profile('selectGoal', () => selectGoal(context))
```

**Output:** Sorted by total time consumed, shows min/max/avg/count per operation.

### Profiling Commands

```bash
# Dev server with profiling
PROFILE_BOT=1 pnpm run dev

# Batch test with profiling (runs are slower)
PROFILE_BOT=1 npx tsx scripts/diagnose.ts batch --runs=10 --seed=1000 --max-upgrades

# Single run deep dive with timing
PROFILE_BOT=1 npx tsx scripts/diagnose.ts deep --seed=12345 --class=warrior
```

### Chrome DevTools

1. `pnpm run dev`
2. Open Chrome DevTools → Performance tab
3. Record during gameplay
4. Look for long tasks in main thread

---

## Performance-Critical Code Paths

### Per-Tick Operations

| Operation | File | Avg Time | Max Time | Notes |
|-----------|------|----------|----------|-------|
| `buildBotContext` | `context.ts` | 2.6µs | 0.35ms | Filters visible entities |
| `computeDangerGrid` | `danger.ts` | 47µs | 0.79ms | Uses monster state hash cache |
| `selectGoal` | `goals.ts` | 39µs | 2.0ms | Priority-based selection |
| `flow.singleTarget` | `flow.ts` | 319µs | 1.1ms | Single-target BFS (typed array) |
| `flow.exploration` | `flow.ts` | 73µs | 0.47ms | Dijkstra frontier flow (typed array) |
| `getFrontierPositions` | `exploration.ts` | 54µs | 1.0ms | Frontier tile detection |
| `handleFallback` | `tick.ts` | 136µs | 3.2ms | Goal movement execution |

### Expensive Operations (Cached)

| Operation | Cache Key | TTL | Invalidation |
|-----------|-----------|-----|--------------|
| Flow map | Goal position + turn | ~10 turns | Goal change, position change |
| Danger grid | Monster state hash | 1 turn | Monster move/damage |
| Frontier list | Explored tile count | Until exploration | New tile explored |
| Dijkstra exploration | Level depth | Level change | Descend/ascend |

---

## Caching Architecture

### Context-Level Caches (`BotState`)

```typescript
interface BotState {
  // Performance caches (FlowGrid = Uint8Array-backed typed array)
  cachedFlow: FlowResult | null           // Current goal pathfinding
  cachedDanger: DangerResult | null       // Monster threat grid
  cachedExplorationFlow: ExplorationFlowCache | null  // Dijkstra frontier
  cachedSweepFlow: SweepFlowCache | null  // Caster sweep mode
  lastExploredCount: number               // Quick frontier check
}
```

### Cache Invalidation Strategy

| Cache | Invalidated When | Cost If Missed |
|-------|------------------|----------------|
| Flow (FlowGrid) | Goal changes, player moves 5+ tiles | 0.3-1ms |
| Danger | Monster positions/HP change | <1ms |
| Frontier | New tile explored | 0.5-1ms |
| Exploration flow | Level change, explored count | 0.5-1ms |
| Sweep flow | seenThisVisit.size changes | 0.5-1ms |

### Danger Grid Hash (`danger.ts`)

```typescript
// Monster state hash for intelligent cache invalidation
function hashMonsterState(monsters: Monster[]): string {
  return monsters.map(m => `${m.id}:${m.x},${m.y}:${m.hp}`).join(';')
}
```

---

## Known Bottlenecks

### 1. Exploration Thrashing

**Symptom:** 60%+ of EXPLORE goals are short-distance (<3 tiles)
**Impact:** Wasted computation, eventual circuit breaker
**Location:** `exploration.ts:getExplorationGoal()`
**Status:** Mitigated by Dijkstra exploration flow

### 2. Flow Recomputation

**Symptom:** Flow computed multiple times per tick
**Impact:** 3-9ms wasted per tick
**Location:** `flow.ts:computeFlow()`
**Status:** Caching implemented, TTL ~10 turns

### 3. Large Frontier Lists

**Symptom:** Frontier >500 tiles on large levels
**Impact:** Slow distance scoring
**Location:** `exploration.ts:findFrontierTiles()`
**Status:** Lazy computation, only when needed

---

## Test Methodology

### Micro-Benchmarks

```bash
# Profile specific operation (add to code temporarily)
const start = performance.now()
const result = expensiveOperation()
console.log(`Operation took ${performance.now() - start}ms`)
```

### Batch Performance Test

```bash
# Baseline timing (100 runs)
time npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --max-upgrades --turns=30000

# After optimization
time npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 --max-upgrades --turns=30000
```

### Turbo Mode Stress Test

```bash
# Run 4 concurrent games at max speed
# Monitor in browser DevTools for frame drops
```

---

## Optimization History

### Baseline: 2026-01-27 (Post Typed Array Flow)

**Test:** ~4500 turns, warrior, max-upgrades

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| handleFallback | 23.7% | 593ms | 4367 | 136µs |
| fallback.goalMovement | 23.5% | 588ms | 4358 | 135µs |
| computeDangerGrid | 8.5% | 214ms | 4510 | 47µs |
| selectGoal | 6.8% | 169ms | 4358 | 39µs |
| goal.descend | 5.4% | 136ms | 571 | 237µs |
| flow.exploration | 5.2% | 130ms | 1791 | 73µs |
| getFrontierPositions | 4.8% | 121ms | 2251 | 54µs |
| flow.singleTarget | 4.8% | 120ms | 375 | 319µs |
| buildBotContext | 0.5% | 12ms | 4510 | 2.6µs |

**Summary:**
- Total tracked: 2502ms for ~4500 turns = **0.55ms/tick avg**
- Fallback path dominates (47% of time)
- Flow computation now ~10% of total (was ~17%)
- Context building very efficient (2.6µs)

**Batch Test:** 100 runs, 50k turns, warrior, max-upgrades
- Warrior avg depth: 47.8, CB rate: 2%
- Mage avg depth: 42.5, CB rate: 20%
- Zero regression from typed array refactor

---

### Pass 1: 2026-01-23 - Sweep Flow Multi-Target Dijkstra

**Before (Mage, 5000 turns):**
| Metric | Value |
|--------|-------|
| Total tracked | 6370ms |
| flow.sweep | 1539ms (24.2%) |

**Changes:**
- Added `getSweepFrontierPositions()` returning `Point[]` for multi-target Dijkstra
- Added `SweepFlowCache` type with seenCount-based invalidation
- Modified `computeExploreGoalFlow()` to use cached multi-target Dijkstra for sweep mode
- Fall back to normal exploration when sweep frontiers empty (fixes fresh level bug)

**After (Mage, 5000 turns):**
| Metric | Value | Change |
|--------|-------|--------|
| Total tracked | 5419ms | **-15%** |
| flow.sweep | 843ms (15.6%) | **-45%** |

**Warrior unchanged:** 4472ms vs 4463ms baseline (within noise)

**Learnings:**
- Single-target BFS recomputed per-tick is expensive; multi-target Dijkstra with caching is 45% faster
- Sweep cache invalidates on `seenThisVisit.size` change (same pattern as exploration cache)
- Empty sweep frontiers on fresh level visits requires fallback to normal exploration

---

### Pass 2: 2026-01-23 - Eliminate ctx.unexplored Spike

**Problem:** `ctx.unexplored` had 3.86ms max spike (avg 8.5µs) causing frame drops in turbo mode.

**Root cause:** Every 20 turns, full level scan to recount explored tiles, plus second scan for frontier computation if count changed.

**Analysis:**
- `unexploredTiles` is only used for `.length === 0` checks (guard conditions)
- Actual frontier list is computed separately by `findFrontierTiles()` in exploration.ts
- The `findUnexploredTiles()` computation was completely unnecessary

**Changes:**
- Eliminated `findUnexploredTiles()` and `checkAdjacentExplored()` from context.ts
- Changed `getCachedUnexploredTiles()` to return sentinel array `[{ x: 0, y: 0 }]`
- Use `getCachedExploredCount()` from exploration.ts to avoid redundant level scans
- Extended revalidation interval to 50 turns

**Results (Warrior, 5000 turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| ctx.unexplored avg | 8.5µs | 0.3µs | **28x faster** |
| ctx.unexplored max | 3.86ms | 0.13ms | **30x lower spike** |
| buildBotContext avg | 10.5µs | 2.6µs | **4x faster** |
| buildBotContext max | 3.59ms | 0.36ms | **10x lower spike** |

**Learnings:**
- Profile max times, not just averages - spikes cause frame drops
- Audit what data is actually used before computing it
- Sentinel values work when only existence check needed

---

### Pass 3: 2026-01-27 - Typed Array Flow Grid

**Problem:** Flow computation used `Map<string, number>` with string key creation ("x,y") on every access, causing hash computation overhead.

**Changes:**
- Replaced `Map<string, number>` with `Uint8Array`-backed `FlowGrid` type
- Direct array indexing via `data[y * width + x]` instead of string keys
- Pre-allocated circular buffer queue for BFS (avoids array resizing)
- Merged `flow-grid.ts` into `flow.ts` for cleaner API

**Benchmark results (isolated):**
| Operation | Map-based | Typed Array | Speedup |
|-----------|-----------|-------------|---------|
| Single-target BFS | 0.54ms | 0.21ms | **2.6x** |
| Multi-target BFS | 0.06ms | 0.04ms | **1.5x** |
| Memory per flow | 4.9KB | 3.1KB | **37% smaller** |

**Results (Warrior, ~4500 turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 4463ms | 2502ms | **44% faster** |
| flow.singleTarget | 541µs avg | 319µs avg | **41% faster** |
| flow.exploration | 205µs avg | 73µs avg | **64% faster** |
| Tick time | 0.89ms avg | 0.55ms avg | **38% faster** |

**Results (Mage, ~4500 turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 5419ms | 2489ms | **54% faster** |
| flow.singleTarget | - | 314µs avg | - |
| flow.exploration | - | 74µs avg | - |
| Tick time | 1.08ms avg | 0.55ms avg | **49% faster** |

**Verification:** 100-run batch tests for warrior and mage show identical results to baseline (same avg depth, CB rate, kills). Zero regression.

**Learnings:**
- Typed arrays dramatically outperform Maps for grid-based algorithms
- String key creation ("x,y") is surprisingly expensive at scale
- Pre-allocated queues avoid GC pressure from array resizing
- Direct indexing beats hash table lookups for dense grids

---

## Performance Targets

### Tick Time

| Scenario | Target | Acceptable | Unacceptable |
|----------|--------|------------|--------------|
| Normal mode | <5ms | <20ms | >50ms |
| Turbo mode | <2ms | <5ms | >10ms |
| 4x concurrent | <10ms total | <30ms | >50ms |

### Batch Test Runtime

| Test | Target | Acceptable | Current |
|------|--------|------------|---------|
| 100 runs, 30k turns | <2 min | <5 min | ~2 min |
| Baseline (11 classes) | <15 min | <25 min | ~15 min |

### Memory

| Metric | Target | Acceptable | Unacceptable |
|--------|--------|------------|--------------|
| Per-game heap | <50MB | <100MB | >200MB |
| 4x concurrent | <200MB | <400MB | >500MB |
| Level cache (12 levels) | <20MB | <50MB | >100MB |

---

## Monitoring Checklist

Before merging performance-related changes:

- [ ] `pnpm run check` passes
- [ ] Batch test runtime not regressed
- [ ] No new console warnings in turbo mode
- [ ] Chrome DevTools shows no long tasks >50ms
- [ ] Memory usage stable over 30+ min session

---

## References

- `src/game/bot/profiler.ts` - Profiling infrastructure
- `src/game/bot/context.ts` - Context building and caches
- `src/game/bot/danger.ts` - Danger grid with hash caching
- `src/game/bot/flow.ts` - Pathfinding with flow caching
- `src/game/bot/exploration.ts` - Frontier detection and Dijkstra
- `src/game/bot/tick.ts` - Main decision loop
- `docs/BOT-AI-PLAN.md` - Bot architecture overview
