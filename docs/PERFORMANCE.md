# Performance Documentation

## Current State (2026-02-07)

### Tick Budget

| Mode | Target | Measured | Status |
|------|--------|----------|--------|
| Normal (100ms) | <50ms per tick | 0.15ms avg, 4.0ms max | ✅ OK |
| Turbo (5-20ms) | <5ms per tick | 0.15ms avg, 4.0ms max | ✅ OK |
| 4x concurrent | <20ms total | ~0.6ms total | ✅ OK |

**Measurement:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`

### Class Comparison (50k turn limit, upgrades=full, capabilities=full, boosters=class, seed=1000)

| Class | Turns | Total Time | Avg/Tick | Main Cost |
|-------|-------|------------|----------|-----------|
| Warrior | 15.0k | 2269ms | 0.15ms | goalMovement (34%), getFrontierPositions (14%), computeDangerGrid (12%) |
| Mage | 25.6k | 3623ms | 0.14ms | goalMovement (33%), computeDangerGrid (10%), selectGoal (8%) |

### vs Previous Baseline (2026-02-06)

| Class | Old Avg/Tick | New Avg/Tick | Delta | Notes |
|-------|-------------|-------------|-------|-------|
| Warrior | 0.20ms | 0.15ms | **-25%** | Passability bitmap + inlined adjacency |
| Mage | 0.17ms | 0.14ms | **-18%** | Bitmap + inlined adjacency across all flow/exploration |

**Key optimizations:** Pre-computed `Uint8Array` passability bitmap on `DungeonLevel` replaces `getTile()` + `isPassable()` (object lookup + 10 string comparisons) with single array index. Inlined `DX/DY` offset loops replace `getAdjacentPositions()` (8-element `Point[]` allocation per call).

**Per-operation (warrior, seed=1000):** `goalMovement` 55µs (-32%), `getFrontierPositions` 34µs (-33%), `flow.exploration` 17µs (-43%), `flow.singleTarget` 53µs (-28%)

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
| `buildBotContext` | `context.ts` | 2.2µs | 0.44ms | Filters visible entities |
| `computeDangerGrid` | `danger.ts` | 18µs | 0.61ms | Int16Array + FNV-1a hash (Pass 4) |
| `selectGoal` | `goals.ts` | 15µs | 2.6ms | Priority-based selection |
| `flow.singleTarget` | `flow.ts` | 53µs | 1.1ms | Single-target BFS (bitmap passability, Pass 6) |
| `flow.exploration` | `flow.ts` | 17µs | 0.21ms | Dijkstra frontier flow (bitmap shortcircuit) |
| `getFrontierPositions` | `exploration.ts` | 34µs | 0.44ms | Frontier detection (inlined DX/DY, Pass 6) |
| `goalMovement` | `tick.ts` | 55µs | 3.4ms | Goal movement execution (Pass 6) |
| `selectActionByTier` | `tier-actions.ts` | 7µs | 0.73ms | Class-specific action selection |
| `recordVisibleTiles` | `progression.ts` | 4.6µs | 0.11ms | SeenGrid typed array (Pass 5) |

### Mage-Specific Operations (50k turns, seed=1000)

| Operation | File | Avg Time | Max Time | Notes |
|-----------|------|----------|----------|-------|
| `getSweepFrontiers` | `exploration.ts` | 14µs | 0.49ms | SeenGrid typed array + bitmap (Pass 6) |
| `flow.sweep` | `flow.ts` | 40µs | 0.18ms | Multi-target sweep Dijkstra |
| `computeSafetyFlow` | `safety-flow.ts` | 957µs | 1.5ms | Int16Array + binary heap + bitmap (Pass 6) |

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

### Pass 6: 2026-02-07 - Passability Bitmap + Inlined Adjacency

**Problem 1:** Every BFS neighbor check called `getTile(level, nx, ny)` (bounds check + 2D array dereference) followed by `isPassable(tile)` or `isWalkableOrDoor(tile)` — which compared `tile.type` against up to 10 string values. In hot BFS loops running thousands of times per tick, this dominated.

**Problem 2:** `getAdjacentPositions(pos)` allocated a fresh 8-element `Point[]` array per call. In exploration.ts, called inside nested loops (frontier detection, corridor checks, sweep frontiers) — hundreds of allocations per tick creating GC pressure.

**Problem 3:** `countExploredTiles()` did a full `width × height` scan every time it was called (cache validation in `getFrontierPositions`, `findFrontierTiles`). On large levels this was O(n) per call.

**Problem 4:** `selectStep()` in movement.ts built a `Set<string>` of monster positions every call, allocating string keys for each monster. With 8-20 monsters per level, small but avoidable.

**Changes (types.ts + dungeon.ts):**
- Added `passable: Uint8Array` to `DungeonLevel` — pre-computed at generation time
- `buildPassabilityBitmap()`: marks `1` for walkable or `door_closed` tiles, indexed by `y * width + x`
- Bitmap is immutable after generation (both door states are passable for bot pathfinding)
- Added `exploredCount: number` to `DungeonLevel`, incremented in `computeFOV()` when tile first explored
- `countExploredTiles()` now returns the counter directly (O(1) vs O(width × height))

**Changes (dungeon/index.ts + town.ts):**
- Level generation calls `buildPassabilityBitmap()` after tile creation
- Town level generation does the same

**Changes (flow.ts):**
- `computeFlow()`: replaced `getTile() + isPassable()` with `level.passable[ny * width + nx]`
- `computeExplorationFlow()`: bitmap short-circuit before `getTile()` (walls are the common case)
- Removed local `isPassable()` helper (dead code)

**Changes (safety-flow.ts):**
- All three inner loops (BFS distance, Dijkstra safety, escape BFS) use `level.passable[nIdx]`
- Removed `isPassable()` helper and `getTile`/`isWalkable` imports

**Changes (exploration.ts):**
- Module-level `DX/DY` arrays replace `getAdjacentPositions()` in 6 call sites
- `computeFrontierPositions()`, `findSweepFrontierTiles()`, `findNearestWalkableExplored()`, `isLikelyDeadEnd()`, `findCorridorContinuation()`, `isWalkableTile()` — all inlined
- `isWalkableOrDoor()` helper removed, replaced by `level.passable[]` lookups
- `getFrontierPositions()` caches `positions: Point[]` alongside tiles (avoids `.map()` on cache hit)
- `getSweepFrontierPositions()` uses bitmap instead of `isWalkableOrDoor()`

**Changes (movement.ts):**
- `selectStep()`: replaced `Set<string>` monster occupation check with inline linear scan over `game.monsters` (typically 8-20 monsters, linear scan beats hash overhead)

**Results (Warrior, seed=1000, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 3151ms | 2269ms | **-28%** |
| ms/tick | 0.20ms | 0.15ms | **-25%** |
| Turns survived | 15.7k | 15.0k | Normal variance |

**Results (Mage, seed=1000, 50k turns):**
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total tracked | 4656ms | 3623ms | **-22%** |
| ms/tick | 0.17ms | 0.14ms | **-18%** |
| Turns survived | 26.7k | 25.6k | Normal variance |

**Per-operation improvements (warrior):**
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| `goalMovement` | 81µs | 55µs | **-32%** |
| `getFrontierPositions` | 51µs | 34µs | **-33%** |
| `flow.singleTarget` | 74µs | 53µs | **-28%** |
| `flow.exploration` | 30µs | 17µs | **-43%** |
| `goal.descend` | 80µs | 57µs | **-29%** |

**Learnings:**
- `getTile()` + string comparison chains are expensive per-call; a one-time bitmap eliminates both
- `getAdjacentPositions()` looks cheap but allocates — inlined `DX/DY` loops allocate nothing
- Incremental counters beat full scans for metrics that change infrequently
- Linear scan beats `Set<string>` for small collections (monster count) due to allocation overhead
- Bitmap is safe to pre-compute because door state doesn't affect passability for bot pathfinding

---

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

### Baseline: 2026-02-07 (Post Passability Bitmap + Inlined Adjacency)

**Test:** `PROFILE_BOT=1 pnpm diagnose deep --seed=1000 --class=warrior --turns=50000`
**Config:** upgrades=full, capabilities=full, boosters=class (diagnose defaults)

**Warrior (14955 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 34.2% | 775ms | 14009 | 55µs |
| getFrontierPositions | 14.2% | 322ms | 9606 | 34µs |
| computeDangerGrid | 11.5% | 262ms | 14955 | 18µs |
| selectGoal | 9.5% | 215ms | 14009 | 15µs |
| flow.exploration | 6.1% | 138ms | 7912 | 17µs |
| selectActionByTier | 4.5% | 102ms | 14955 | 7µs |
| goal.descend | 4.2% | 96ms | 1699 | 57µs |
| recordVisibleTiles | 3.0% | 69ms | 14955 | 5µs |
| flow.singleTarget | 2.2% | 49ms | 924 | 53µs |
| buildBotContext | 1.5% | 33ms | 14955 | 2µs |

**Summary:**
- Total tracked: 2269ms for ~15.0k turns = **0.15ms/tick avg**
- `goalMovement` 34% (was 37%) — bitmap passability check in BFS inner loop
- `getFrontierPositions` 14% (was 16%) — inlined DX/DY + cached positions array
- `flow.exploration` 6% (was 7%) — bitmap short-circuit before getTile
- All flow operations 23-33% faster across 3-seed average

**Mage (25569 turns, natural death):**

| Operation | % Time | Total | Calls | Avg |
|-----------|--------|-------|-------|-----|
| goalMovement | 33.2% | 1203ms | 21471 | 56µs |
| computeDangerGrid | 10.1% | 367ms | 25569 | 14µs |
| selectGoal | 8.3% | 301ms | 21471 | 14µs |
| getFrontierPositions | 6.7% | 242ms | 9499 | 25µs |
| flow.exploration | 5.4% | 196ms | 6703 | 29µs |
| goal.descend | 5.3% | 192ms | 2112 | 91µs |
| flow.sweep | 5.3% | 190ms | 4735 | 40µs |
| selectActionByTier | 4.6% | 166ms | 25569 | 7µs |
| recordVisibleTiles | 3.1% | 114ms | 25569 | 5µs |
| getSweepFrontiers | 2.9% | 104ms | 7481 | 14µs |
| flow.singleTarget | 2.3% | 83ms | 1462 | 57µs |
| buildBotContext | 1.4% | 50ms | 25569 | 2µs |

**Summary:**
- Total tracked: 3623ms for ~25.6k turns = **0.14ms/tick avg**
- Mage improved from 0.17ms to 0.14ms (18% faster)
- Sweep overhead (frontiers + flow) = 8.2% — higher than previous baseline due to run variance (more sweep turns this run)
- `goalMovement` 33% (was 37%) — bitmap dominates the BFS improvement

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
