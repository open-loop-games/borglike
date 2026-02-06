# Performance Documentation

## Current State (2026-02-06)

### Tick Budget

| Mode | Target | Measured | Status |
|------|--------|----------|--------|
| Normal (100ms) | <50ms per tick | 0.20ms avg, 3.8ms max | ✅ OK |
| Turbo (5-20ms) | <5ms per tick | 0.20ms avg, 3.8ms max | ✅ OK |
| 4x concurrent | <20ms total | ~0.8ms total | ✅ OK |

**Measurement:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`

### Class Comparison (50k turn limit, upgrades=full, capabilities=full, boosters=class, seed=1000)

| Class | Turns | Total Time | Avg/Tick | Main Cost |
|-------|-------|------------|----------|-----------|
| Warrior | 15.7k | 3151ms | 0.20ms | goalMovement (37%), getFrontierPositions (16%) |
| Mage | 26.7k | 4656ms | 0.17ms | goalMovement (37%), flow.exploration (12%), computeDangerGrid (8%) |

Mage per-tick is now slightly faster than warrior due to longer runs amortizing fixed costs.

### vs Previous Baseline (2026-02-05)

| Class | Old Avg/Tick | New Avg/Tick | Delta | Notes |
|-------|-------------|-------------|-------|-------|
| Warrior | 0.47ms | 0.20ms | **-53%** | FlowAvoidance + SeenGrid typed arrays |
| Mage | 0.60ms | 0.17ms | **-75%** | flow.singleTarget 637µs→61µs (BFS avoid set elimination) |

**Key insight:** String key creation (`"x,y"`) in BFS inner loops was the dominant cost. Replacing `Set<string>.has()` with typed-array indexing (`data[y*w+x]`) eliminated it.

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
| `buildBotContext` | `context.ts` | 2.2µs | 0.34ms | Filters visible entities |
| `computeDangerGrid` | `danger.ts` | 17µs | 0.66ms | Int16Array + FNV-1a hash (Pass 4) |
| `selectGoal` | `goals.ts` | 16µs | 3.0ms | Priority-based selection |
| `flow.singleTarget` | `flow.ts` | 74µs | 0.76ms | Single-target BFS (typed array, Pass 5) |
| `flow.exploration` | `flow.ts` | 30µs | 0.37ms | Dijkstra frontier flow (typed array) |
| `getFrontierPositions` | `exploration.ts` | 51µs | 1.2ms | Frontier tile detection |
| `goalMovement` | `tick.ts` | 81µs | 3.8ms | Goal movement execution (Pass 5) |
| `selectActionByTier` | `tier-actions.ts` | 11µs | 0.54ms | Class-specific action selection |
| `recordVisibleTiles` | `progression.ts` | 4.7µs | 0.18ms | SeenGrid typed array (Pass 5) |

### Mage-Specific Operations (50k turns, seed=1000)

| Operation | File | Avg Time | Max Time | Notes |
|-----------|------|----------|----------|-------|
| `getSweepFrontiers` | `exploration.ts` | 15µs | 0.45ms | SeenGrid typed array (Pass 5) |
| `flow.sweep` | `flow.ts` | 54µs | 0.24ms | Multi-target sweep Dijkstra |
| `computeSafetyFlow` | `safety-flow.ts` | 212µs | 1.5ms | Int16Array + binary heap (Pass 4) |

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
| Sweep flow | seenThisVisit.count changes | 0.5-1ms |
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

### Pass 5: 2026-02-06 - FlowAvoidance + SeenGrid Typed Arrays

**Problem 1:** `computeFlow` and `computeExplorationFlow` accepted `Set<string>` avoid parameter. The BFS inner loop called `avoid.has(\`${nx},${ny}\`)` — string key creation on every neighbor check, thousands of times per flow computation.

**Problem 2:** `seenThisVisit` was `Set<string>` with `"x,y"` keys. Every FOV tile recorded via `.add()`, every sweep/tether check via `.has()`, and `.size` for cache invalidation — all with string allocation overhead.

**Changes (flow.ts):**
- Added `FlowAvoidance` interface: `{ grid: DangerGrid, threshold: number }`
- BFS inner loop now uses `avoidData[ny * avoidWidth + nx] > avoidThreshold` (typed array indexing)
- Pre-extracts `avoidData`, `avoidWidth`, `avoidThreshold` outside loop for cache locality

**Changes (danger.ts):**
- Extracted `getScaledDangerThreshold()` from `buildAvoidSet` for direct use by tick.ts
- `buildAvoidSet` retained for diagnostic scripts only

**Changes (types.ts + state.ts):**
- Added `SeenGrid` type: `{ data: Uint8Array, width: number, count: number }`
- Helper functions: `createSeenGrid`, `seenGridHas`, `seenGridAdd`, `seenGridClear`
- `BotState.seenThisVisit` changed from `Set<string>` to `SeenGrid`

**Changes (tick.ts):**
- `handleGoalMovement` constructs `FlowAvoidance` directly from danger grid + scaled threshold
- Eliminated `buildAvoidSet` call from game loop entirely

**Changes (6 consumer files):**
- `progression.ts`: `seenGridAdd` for FOV recording, `.count` for Morgoth sweep
- `exploration.ts`: `seenGridHas` for sweep frontier detection
- `farming.ts`: `SeenGrid` parameter in `countTilesInBounds`, `seenGridHas`/`seenGridClear`
- `preparation.ts`: `.count` for unique hunt flip threshold

**Results (Warrior, seed=1000, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 6837ms | 3151ms | **-54%** |
| ms/tick | 0.43ms | 0.20ms | **-53%** |
| `goalMovement` avg | 120µs | 81µs | **-33%** |
| `recordVisibleTiles` avg | 11µs | 4.7µs | **-57%** |

**Results (Mage, seed=1000, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 18732ms | 4656ms | **-75%** |
| ms/tick | 0.70ms | 0.17ms | **-75%** |
| `flow.singleTarget` avg | 637µs | 61µs | **-90%** |
| `getSweepFrontiers` avg | 155µs | 15µs | **-90%** |
| `flow.sweep` avg | 157µs | 54µs | **-66%** |

**Key insight:** The mage's `flow.singleTarget` appeared to regress from 216µs to 637µs between baselines, but this was behavioral — the combat formula fix caused mages to spend more time at deep cavern levels (3x more walkable tiles). The `Set<string>` avoid check dominated the BFS on large levels. With typed-array avoidance, the cost is now 61µs regardless of level size.

**Learnings:**
- Same typed-array pattern from Pass 3 (FlowGrid) applied to BFS avoidance and FOV tracking
- `Set<string>.has()` with template literal keys is the most expensive common operation in hot loops
- Behavioral regressions (different game trajectory) can masquerade as code regressions — always test multiple seeds
- Bimodal performance (185µs vs 637µs on same code) indicates data-dependent cost, not algorithmic regression

---

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

**Note:** `goalMovement.buildAvoidSet` slightly regressed (4.5µs → 6.2µs) due to typed array → string key conversion for flow.ts `avoid` set compatibility. Net win far exceeds this. (Fully eliminated in Pass 5 via FlowAvoidance.)

**Learnings:**
- Same typed-array pattern from Pass 3 (flow.ts) applied to danger + safety grids
- Binary heap eliminates the worst algorithmic issue (sort-inside-loop)
- Integer scaling (×5) avoids float precision issues while preserving exact ratios
- Pre-allocated module-level structures (BFS buffer, heap arrays) avoid per-call allocation

---

### Baseline: 2026-02-06 (Post FlowAvoidance + SeenGrid)

**Test:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`
**Config:** upgrades=full, capabilities=full, boosters=class (diagnose defaults)

**Warrior (15743 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 36.5% | 1197ms | 14761 | 81µs |
| getFrontierPositions | 15.7% | 516ms | 10050 | 51µs |
| computeDangerGrid | 8.0% | 261ms | 15743 | 17µs |
| selectGoal | 7.2% | 234ms | 14761 | 16µs |
| flow.exploration | 6.5% | 213ms | 7095 | 30µs |
| selectActionByTier | 5.4% | 176ms | 15743 | 11µs |
| goal.descend | 4.3% | 140ms | 1746 | 80µs |
| flow.singleTarget | 2.7% | 88ms | 1194 | 74µs |
| recordVisibleTiles | 2.2% | 73ms | 15743 | 4.7µs |
| buildBotContext | 1.1% | 35ms | 15743 | 2.2µs |

**Summary:**
- Total tracked: 3151ms for ~15.7k turns = **0.20ms/tick avg**
- `goalMovement` dominates at 37% but absolute cost halved (81µs vs 120µs)
- `computeDangerGrid` dropped from 17% to 8% (typed array avoidance eliminated buildAvoidSet)
- `recordVisibleTiles` 57% faster (SeenGrid typed array)

**Mage (26716 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 36.5% | 1877ms | 20787 | 90µs |
| flow.exploration | 11.9% | 609ms | 5951 | 102µs |
| computeDangerGrid | 8.1% | 415ms | 26716 | 16µs |
| getFrontierPositions | 7.3% | 375ms | 9213 | 41µs |
| selectGoal | 6.5% | 332ms | 20787 | 16µs |
| selectActionByTier | 5.5% | 280ms | 26716 | 11µs |
| goal.descend | 4.1% | 208ms | 2031 | 103µs |
| flow.sweep | 3.4% | 177ms | 3251 | 54µs |
| flow.singleTarget | 2.1% | 107ms | 1758 | 61µs |
| getSweepFrontiers | 1.8% | 91ms | 6131 | 15µs |
| recordVisibleTiles | 2.3% | 118ms | 26716 | 4.4µs |

**Summary:**
- Total tracked: 4656ms for ~26.7k turns = **0.17ms/tick avg**
- `flow.singleTarget` avg dropped from 637µs to 61µs (typed-array avoidance)
- `getSweepFrontiers` 90% faster (SeenGrid typed array replaces Set<string>)
- Sweep overhead (frontiers + flow) = 5.2% (was 8.3%)

---

### Baseline: 2026-02-05 (Post Farming/Capabilities/Balance Rework, Pre-Pass 5)

**Test:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`
**Config:** upgrades=full, capabilities=full, boosters=class (diagnose defaults)

**Warrior:** 6572ms for ~13.9k turns = **0.47ms/tick avg**
**Mage:** 17459ms for ~29.3k turns = **0.60ms/tick avg**

See Pass 5 optimization entry for detailed before/after comparison.

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
