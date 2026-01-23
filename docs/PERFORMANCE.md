# Performance Documentation

## Current State (2026-01-23)

### Tick Budget

| Mode | Target | Measured | Status |
|------|--------|----------|--------|
| Normal (100ms) | <50ms per tick | 0.89ms avg, 4.1ms max | OK |
| Turbo (5-20ms) | <5ms per tick | 0.89ms avg, 4.1ms max | OK |
| 4x concurrent | <20ms total | ~3.5ms total | OK |

**Measurement:** Enable `PROFILE_BOT=1` environment variable to capture per-tick metrics.

### Class Comparison (5000 turns, max-upgrades)

| Class | Total Time | Avg/Tick | Main Cost |
|-------|------------|----------|-----------|
| Warrior | 4472ms | 0.89ms | flow.exploration (13%) |
| Mage | 5419ms | 1.08ms | flow.sweep (16%) |

Casters ~21% slower due to tethered sweep mode pathfinding (was 44% before multi-target Dijkstra).

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
| `buildBotContext` | `context.ts` | 11µs | 3.7ms | Filters visible entities |
| `computeDangerGrid` | `danger.ts` | 50µs | 0.7ms | Uses monster state hash cache |
| `selectGoal` | `goals.ts` | 40µs | 3.0ms | Priority-based selection |
| `flow.singleTarget` | `flow.ts` | 541µs | 1.4ms | Single-target BFS |
| `flow.exploration` | `exploration.ts` | 205µs | 1.0ms | Dijkstra frontier flow |
| `getFrontierPositions` | `exploration.ts` | 51µs | 0.7ms | Frontier tile detection |
| `handleFallback` | `tick.ts` | 245µs | 4.1ms | Goal movement execution |

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
  // Performance caches
  cachedFlow: FlowCache | null       // Current goal pathfinding
  cachedDanger: DangerCache | null   // Monster threat grid
  cachedSafetyFlow: FlowCache | null // Safe retreat paths
  cachedExplorationFlow: FlowCache | null // Dijkstra frontier
  lastExploredCount: number          // Quick frontier check
}
```

### Cache Invalidation Strategy

| Cache | Invalidated When | Cost If Missed |
|-------|------------------|----------------|
| Flow | Goal changes, player moves 5+ tiles | 1-3ms |
| Danger | Monster positions/HP change | <1ms |
| Frontier | New tile explored | 0.5-2ms |
| Exploration flow | Level change | 2-5ms |

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

### Baseline: 2026-01-23

**Test:** 5000 turns, warrior, max-upgrades, seed=1000

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| handleFallback | 26.5% | 1182ms | 4830 | 245µs |
| fallback.goalMovement | 26.4% | 1178ms | 4824 | 244µs |
| flow.exploration | 13.1% | 584ms | 2853 | 205µs |
| computeDangerGrid | 5.6% | 251ms | 5000 | 50µs |
| selectGoal | 4.4% | 194ms | 4824 | 40µs |
| getFrontierPositions | 3.9% | 175ms | 3407 | 51µs |
| flow.singleTarget | 3.7% | 164ms | 304 | 541µs |
| buildBotContext | 1.2% | 55ms | 5000 | 11µs |

**Summary:**
- Total tracked: 4463ms for 5000 turns = **0.89ms/tick avg**
- Fallback path dominates (53% of time)
- Flow computation is the main cost within fallback
- Context building is very efficient (11µs)

**Batch Test:** 30 runs, 30k turns, warrior, max-upgrades
- Runtime: **28.4s** (wall clock)
- CPU time: 3m44s (8 threads)
- ~0.95s per run

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
