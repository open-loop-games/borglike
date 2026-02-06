# Performance Documentation

## Current State (2026-02-05)

### Tick Budget

| Mode | Target | Measured | Status |
|------|--------|----------|--------|
| Normal (100ms) | <50ms per tick | 0.47ms avg, 4.7ms max | ✅ OK |
| Turbo (5-20ms) | <5ms per tick | 0.47ms avg, 4.7ms max | ✅ OK |
| 4x concurrent | <20ms total | ~1.9ms total | ✅ OK |

**Measurement:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`

### Class Comparison (50k turn limit, upgrades=full, capabilities=full, boosters=class, seed=1000)

| Class | Turns | Total Time | Avg/Tick | Main Cost |
|-------|-------|------------|----------|-----------|
| Warrior | 13.9k | 6572ms | 0.47ms | goalMovement (24%), computeDangerGrid (17%) |
| Mage | 29.3k | 17459ms | 0.60ms | goalMovement (24%), computeDangerGrid (15%), getSweepFrontiers (5%) |
| Druid | 5.0k* | 2163ms | 0.43ms | goalMovement (22%), computeDangerGrid (8%) |
| Rogue | 5.0k* | 2217ms | 0.44ms | goalMovement (23%), computeDangerGrid (8%) |

*Druid/Rogue ran 5k turn cap for spot-check only.

Mage ~27% slower per tick due to sweep mode (frontier + flow). New `computeSafetyFlow` adds ~1.5ms per call for caster flee paths (147 calls, 1.3% total).

### vs Previous Baseline (2026-01-27)

| Class | Old Avg/Tick | New Avg/Tick | Delta | Notes |
|-------|-------------|-------------|-------|-------|
| Warrior | 0.45ms | 0.47ms | +5.6% | `computeDangerGrid` +66% from 12 new D19-30 monsters |
| Mage | 0.69ms | 0.60ms | -13% | Goal persistence improvements, better cache hit rates |

**Important:** Old baseline used legacy `--max-upgrades` flag. Current baseline uses `--upgrades=full --capabilities=full --boosters=class` (diagnose defaults). The legacy flag applies different bonuses and produces very different run behavior.

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

# Single run deep dive with timing (uses diagnose defaults: upgrades=full, capabilities=full, boosters=class)
PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000

# Batch test with profiling (runs are slower)
PROFILE_BOT=1 pnpm diagnose batch --runs=10 --seed=1000

# Spot-check a specific class
PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=mage --turns=5000

# Raw baseline (no upgrades/capabilities/boosters)
PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --upgrades=none --capabilities=none --boosters=none
```

### Chrome DevTools

1. `pnpm run dev`
2. Open Chrome DevTools → Performance tab
3. Record during gameplay
4. Look for long tasks in main thread

---

## Performance-Critical Code Paths

### Per-Tick Operations (Warrior, 50k turns, seed=1000)

| Operation | File | Avg Time | Max Time | Notes |
|-----------|------|----------|----------|-------|
| `buildBotContext` | `context.ts` | 2.2µs | 0.37ms | Filters visible entities |
| `computeDangerGrid` | `danger.ts` | 16µs | 0.72ms | Int16Array + FNV-1a hash (Pass 4) |
| `selectGoal` | `goals.ts` | 23µs | 3.4ms | Priority-based selection |
| `flow.singleTarget` | `flow.ts` | 194µs | 0.96ms | Single-target BFS (typed array) |
| `flow.exploration` | `flow.ts` | 64µs | 0.44ms | Dijkstra frontier flow (typed array) |
| `getFrontierPositions` | `exploration.ts` | 49µs | 1.7ms | Frontier tile detection |
| `goalMovement` | `tick.ts` | 118µs | 4.6ms | Goal movement execution |
| `selectActionByTier` | `tier-actions.ts` | 10µs | 0.70ms | Class-specific action selection |
| `recordVisibleTiles` | `exploration.ts` | 11µs | 0.37ms | Visible tile tracking |

### Mage-Specific Operations (50k turns, seed=1000)

| Operation | File | Avg Time | Max Time | Notes |
|-----------|------|----------|----------|-------|
| `getSweepFrontiers` | `exploration.ts` | 155µs | 1.1ms | Sweep mode frontier calculation |
| `flow.sweep` | `flow.ts` | 157µs | 0.67ms | Multi-target sweep Dijkstra |
| `computeSafetyFlow` | `safety-flow.ts` | 913µs | 1.3ms | Int16Array + binary heap (Pass 4) |

### Expensive Operations (Cached)

| Operation | Cache Key | TTL | Invalidation |
|-----------|-----------|-----|--------------|
| Flow map | Goal position + turn | ~10 turns | Goal change, position change |
| Danger grid | Monster state hash | 1 turn | Monster move/damage |
| Frontier list | Explored tile count | Until exploration | New tile explored |
| Dijkstra exploration | Level depth | Level change | Descend/ascend |
| Safety flow | Player position + turn | 1 turn | Position change |
| Tether sweep flow | Tether origin + seen count | Until seen count changes | New tile seen |

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
  cachedSafetyFlow: SafetyFlowResult | null  // Flee path computation
  lastExploredCount: number               // Quick frontier check
}
```

### Cache Invalidation Strategy

| Cache | Invalidated When | Cost If Missed |
|-------|------------------|----------------|
| Flow (FlowGrid) | Goal changes, player moves 5+ tiles | 0.2-1ms |
| Danger | Monster positions/HP change | <1ms |
| Frontier | New tile explored | 0.5-1ms |
| Exploration flow | Level change, explored count | 0.5-1ms |
| Sweep flow | seenThisVisit.size changes | 0.5-1ms |
| Safety flow | Position change, turn change | 0.4-1.3ms |
| Tether sweep flow | Tether origin + seen count | 0.2-0.8ms |

### Danger Grid Hash (`danger.ts`)

```typescript
// FNV-1a numeric hash for cache invalidation (no string allocation)
function hashMonsterState(monsters: Monster[]): number {
  let hash = 2166136261
  for (const m of monsters) {
    if (m.hp > 0) {
      for (let i = 0; i < Math.min(m.id.length, 4); i++)
        hash = Math.imul(hash ^ m.id.charCodeAt(i), 16777619)
      hash = Math.imul(hash ^ m.position.x, 16777619)
      hash = Math.imul(hash ^ m.position.y, 16777619)
      hash = Math.imul(hash ^ m.hp, 16777619)
    }
  }
  return hash
}
```

---

## Known Bottlenecks

### 1. computeDangerGrid (Resolved — Pass 4)

**Symptom:** Was 78µs avg, 17% of warrior total
**Status:** ✅ Resolved. Int16Array grid + FNV-1a numeric hash → 16µs avg (4.5x faster)

### 2. computeSafetyFlow (Resolved — Pass 4)

**Symptom:** Was 1.5ms avg, 3.8ms max spike
**Status:** ✅ Resolved. Binary min-heap + typed arrays → 363µs avg warrior, 913µs avg mage (max 1.3ms)

### 3. Exploration Thrashing (Resolved)

**Symptom:** 60%+ of EXPLORE goals are short-distance (<3 tiles)
**Impact:** Wasted computation, eventual circuit breaker
**Location:** `exploration.ts:getExplorationGoal()`
**Status:** ✅ Resolved by Dijkstra exploration flow + goal persistence

### 4. Flow Recomputation (Resolved)

**Symptom:** Flow computed multiple times per tick
**Impact:** 3-9ms wasted per tick
**Location:** `flow.ts:computeFlow()`
**Status:** ✅ Resolved. Caching implemented, TTL ~10 turns

### 5. Large Frontier Lists

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
# Baseline timing (100 runs, uses defaults: upgrades=full, capabilities=full, boosters=class)
time pnpm diagnose batch --runs=100 --seed=1000 --turns=30000

# After optimization (compare wall clock time)
time pnpm diagnose batch --runs=100 --seed=1000 --turns=30000

# Full 11-class baseline
pnpm diagnose baseline --seed=1000
```

### Turbo Mode Stress Test

```bash
# Run 4 concurrent games at max speed
# Monitor in browser DevTools for frame drops
```

---

## Optimization History

### Pass 4: 2026-02-05 - DangerGrid + SafetyFlow Typed Arrays

**Problem 1:** `computeDangerGrid` used `Map<string, number>` with string keys and `getAdjacentPositions()` allocations. 78µs avg, 17% of warrior total.

**Problem 2:** `computeSafetyFlow` used `queue.sort()` inside Dijkstra loop (O(n² log n)), `queue.shift()` for BFS (O(n)), and three `Map<string, number>` allocations.

**Changes (danger.ts):**
- Replaced `Map<string, number>` danger map with `Int16Array` grid (`DangerGrid` type)
- FNV-1a numeric hash (`Math.imul`) replaces string concatenation for cache keys
- Inlined 3x3 neighbor loop in `getLocalDanger()` (no `getAdjacentPositions` allocation)
- Pre-computed `DANGER_MULTIPLIERS` array replaces conditional chain

**Changes (safety-flow.ts):**
- Binary min-heap replaces `queue.sort()` in Dijkstra rescan (O(n log n) vs O(n² log n))
- Circular buffer replaces `queue.shift()` in BFS (O(1) vs O(n))
- `Int16Array` grids replace three `Map<string, number>` allocations
- Scaled integer math (×5) preserves -1.2 coefficient exactly without floats
- Module-level `popX/popY/popCost` avoids heap-pop object allocation
- Removed `safetyMap` from `SafetyFlowResult` (unused debugging field)

**Results (Warrior, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `computeDangerGrid` avg | 78µs | 16µs | **4.5x faster** |
| `computeSafetyFlow` avg | 3744µs | 363µs | **10x faster** |
| Total tracked | 6572ms | 5942ms | **-10%** |

**Results (Mage, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| `computeSafetyFlow` avg | 1491µs | 913µs | **1.6x faster** |
| `computeSafetyFlow` max | 3.8ms | 1.3ms | **2.9x lower spike** |

**Note:** `goalMovement.buildAvoidSet` slightly regressed (4.5µs → 6.2µs) due to typed array → string key conversion for flow.ts `avoid` set compatibility. Net win far exceeds this.

**Learnings:**
- Same typed-array pattern from Pass 3 (flow.ts) applied to danger + safety grids
- Binary heap eliminates the worst algorithmic issue (sort-inside-loop)
- Integer scaling (×5) avoids float precision issues while preserving exact ratios
- Pre-allocated module-level structures (BFS buffer, heap arrays) avoid per-call allocation

---

### Baseline: 2026-02-05 (Post Farming/Capabilities/Balance Rework)

**Test:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`
**Config:** upgrades=full, capabilities=full, boosters=class (diagnose defaults)

**Warrior (13924 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 23.7% | 1554ms | 12923 | 120µs |
| goalMovement.inner | 23.5% | 1545ms | 12901 | 120µs |
| computeDangerGrid | 16.6% | 1091ms | 13924 | 78µs |
| getFrontierPositions | 6.5% | 428ms | 8792 | 49µs |
| flow.exploration | 6.9% | 455ms | 6445 | 71µs |
| selectGoal | 4.2% | 279ms | 12901 | 22µs |
| flow.singleTarget | 3.0% | 196ms | 875 | 224µs |
| goal.descend | 2.7% | 179ms | 1486 | 121µs |
| selectActionByTier | 2.6% | 171ms | 13924 | 12µs |
| buildBotContext | 0.5% | 31ms | 13924 | 2.2µs |

**Summary:**
- Total tracked: 6572ms for ~13.9k turns = **0.47ms/tick avg**
- Goal movement dominates (47% of time)
- `computeDangerGrid` up to 17% (was 8.5%) due to 12 new D19-30 monsters
- `selectGoal` improved 45% (22µs vs 39µs) from better goal persistence
- Flow computation ~10% of total

**Mage (29277 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 24.2% | 4230ms | 22595 | 187µs |
| computeDangerGrid | 14.5% | 2531ms | 29277 | 86µs |
| selectGoal | 6.5% | 1131ms | 22529 | 50µs |
| getSweepFrontiers | 5.4% | 949ms | 6131 | 155µs |
| flow.exploration | 3.3% | 578ms | 6198 | 93µs |
| flow.sweep | 2.9% | 509ms | 3251 | 157µs |
| computeSafetyFlow | 1.3% | 219ms | 147 | 1491µs |
| flow.singleTarget | 1.8% | 315ms | 1965 | 216µs |

**Summary:**
- Total tracked: 17459ms for ~29.3k turns = **0.60ms/tick avg**
- `computeSafetyFlow` is new (flee path for casters), 1.5ms avg but only 147 calls
- Sweep overhead (frontiers + flow) = ~8.3% combined

---

### Baseline: 2026-01-27 (Post Typed Array Flow)

**Test:** ~4500 turns, warrior, `--max-upgrades` (legacy flag, no capabilities/boosters)

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 23.7% | 593ms | 4367 | 136µs |
| goalMovement.inner | 23.5% | 588ms | 4358 | 135µs |
| computeDangerGrid | 8.5% | 214ms | 4510 | 47µs |
| selectGoal | 6.8% | 169ms | 4358 | 39µs |
| goal.descend | 5.4% | 136ms | 571 | 237µs |
| flow.exploration | 5.2% | 130ms | 1791 | 73µs |
| getFrontierPositions | 4.8% | 121ms | 2251 | 54µs |
| flow.singleTarget | 4.8% | 120ms | 375 | 319µs |
| buildBotContext | 0.5% | 12ms | 4510 | 2.6µs |

**Summary:**
- Total tracked: 2502ms for ~4500 turns = **0.55ms/tick avg**
- Goal movement dominates (47% of time)
- Flow computation now ~10% of total (was ~17%)
- Context building very efficient (2.6µs)

**Note:** This baseline used the legacy `--max-upgrades` flag which applies different bonuses than `--upgrades=full`. Not directly comparable to the 2026-02-05 baseline.

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
- `src/game/bot/safety-flow.ts` - Flee path computation for casters
- `src/game/bot/farming.ts` - Tether sweep and farming modes
- `src/game/bot/tick.ts` - Main decision loop
- `docs/BOT-AI-PLAN.md` - Bot architecture overview
