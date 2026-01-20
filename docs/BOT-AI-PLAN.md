# Bot AI Design v2

## Overview

A robust auto-playing bot for Borglike, inspired by Angband's mature borg implementation. This design prioritizes correctness and testability over simplicity.

## Core Concepts from Angband Borg

### 1. Flow-Based Navigation
Instead of A* from player to goal, the borg uses **reverse BFS** from destination spreading outward. Each grid stores its "cost" (distance from goal). The bot simply follows decreasing costs.

**Why it matters:** Single BFS computation can be reused for multiple steps. No need to recompute path each turn if goal hasn't changed.

### 2. Danger Grid
Every walkable tile has a danger score based on nearby monsters. High-danger tiles are marked "icky" and excluded from pathfinding.

**Why it matters:** The bot naturally routes around threats without explicit avoidance logic.

### 3. Stuck Detection (Twitching)
A counter increments when no meaningful progress is made. Escalating responses:
- Low twitch: Try random movement
- Medium twitch: Force combat or ignore items
- High twitch: Abandon goal, force descent

**Why it matters:** Prevents infinite loops and oscillation without complex state machines.

### 4. Step History (Anti-Oscillation)
Track last N positions. Prefer tiles not recently visited.

**Why it matters:** Breaks A-B-A-B movement patterns that pure greedy algorithms create.

### 5. Happy Grid Preference
Prefer certain tile types for safety: corridors (1 entry/exit), corners, pillars.

**Why it matters:** Strategic positioning reduces danger from multiple angles.

### 6. Goal Type System
Explicit enumeration of what the bot is trying to do:
```
KILL     - Hunt a specific monster
TAKE     - Collect a specific item
DESCEND  - Reach stairs
FLEE     - Run from danger
EXPLORE  - Find unexplored areas
RECOVER  - Rest to heal
```

**Why it matters:** Clear goal tracking enables better debugging and prevents goal thrashing.

## Architecture

```
src/game/bot/
├── index.ts          # Main decision function + exports
├── types.ts          # All bot-specific types
├── state.ts          # BotState management
├── flow.ts           # Reverse-BFS flow computation
├── danger.ts         # Per-grid danger calculation
├── goals.ts          # Goal selection and priority
├── movement.ts       # Step selection from flow
├── stuck.ts          # Twitching detection/response
├── combat.ts         # Fight vs flee decisions
├── items.ts          # Item evaluation and pickup
├── survival.ts       # Health monitoring, healing
├── exploration.ts    # Frontier detection
└── personality.ts    # Personality parameter sets
```

## Types

```typescript
// Goal types
type GoalType = 'KILL' | 'TAKE' | 'DESCEND' | 'FLEE' | 'EXPLORE' | 'RECOVER' | 'WAIT'

interface Goal {
  type: GoalType
  target?: Point           // Where we're going
  targetId?: string        // Monster/item ID if applicable
  reason: string           // For debugging
}

// Per-grid data
interface GridData {
  cost: number             // Steps from goal (255 = unreachable)
  danger: number           // Threat level at this tile
  icky: boolean            // Excluded from pathing
  lastVisited: number      // Turn when last stepped on
}

// Flow state (reusable across turns)
interface FlowState {
  goal: Point
  goalType: GoalType
  grid: Map<string, GridData>  // "x,y" -> data
  computed: number             // Turn when computed
}

// Persistent bot state (per-run)
interface BotState {
  // Stuck detection
  twitchCounter: number
  lastProgress: number      // Turn of last meaningful action

  // Step history (anti-oscillation)
  recentPositions: Point[]  // Last 25 positions

  // Goal tracking
  currentGoal: Goal | null
  goalStartTurn: number

  // Level tracking
  turnsOnLevel: number
  levelEnterTurn: number

  // Knowledge
  knownStairs: Point | null
  exploredCount: number

  // Cached flow
  flow: FlowState | null
}

// Personality parameters (0-100 scale)
interface PersonalityParams {
  aggression: number      // How readily to engage (vs flee)
  greed: number           // Detour distance for items
  caution: number         // HP threshold for retreat (as %)
  exploration: number     // How much to explore before descending
  patience: number        // Turns before forcing descent
}
```

## Implementation Phases

### Phase 1: Flow and Movement (Foundation)

**Goal:** Move reliably to any reachable point without oscillation.

**Files:** `types.ts`, `state.ts`, `flow.ts`, `movement.ts`, `index.ts`

**Implementation:**

1. **flow.ts - Reverse BFS**
   ```typescript
   function computeFlow(level: DungeonLevel, goal: Point, avoid: Set<string>): Map<string, number>
   ```
   - BFS from goal outward
   - Respect `avoid` set (danger/icky tiles)
   - Return cost map (distance from goal)
   - Max cost 255 (unreachable)

2. **movement.ts - Step Selection**
   ```typescript
   function selectStep(pos: Point, flow: Map<string, number>, history: Point[]): Point | null
   ```
   - Find adjacent tile with lowest cost
   - Prefer cardinal directions (less diagonal wiggle)
   - Prefer tiles not in recent history
   - Return null if stuck

3. **state.ts - State Management**
   ```typescript
   function createBotState(): BotState
   function updateAfterMove(state: BotState, newPos: Point, turn: number): void
   function recordProgress(state: BotState, turn: number): void
   ```

4. **index.ts - Main Loop**
   ```typescript
   function decideBotAction(game: GameState, state: BotState, personality: PersonalityParams): GameAction
   ```
   - For Phase 1: Just pathfind to a target position

**Tests:**
- Bot reaches target from various starting positions
- Bot navigates around obstacles
- Bot doesn't oscillate between two points
- Bot correctly identifies unreachable targets

**Success Criteria:**
- 100% success reaching reachable targets
- Zero oscillation in 1000-turn test runs
- <5% turn overhead vs optimal path length

---

### Phase 2: Danger and Avoidance

**Goal:** Route around threats, not through them.

**Files:** `danger.ts`, updates to `flow.ts`

**Implementation:**

1. **danger.ts - Threat Calculation**
   ```typescript
   function computeDangerGrid(game: GameState): Map<string, number>
   function getTileDanger(pos: Point, monsters: Monster[], character: Character): number
   ```
   - Per-monster threat based on: distance, damage potential, speed
   - Sum threats from all visible monsters
   - Apply character's resistances/armor to reduce perceived threat
   - Mark tiles adjacent to monsters as high-danger

2. **Flow Integration**
   - Tiles with danger > threshold marked as "icky"
   - Flow computation excludes icky tiles
   - Threshold scales with character HP %

**Tests:**
- Bot routes around single monster
- Bot routes around monster group
- Bot takes risky path when no safe path exists
- Danger calculation matches expected values

**Success Criteria:**
- Zero deaths from walking into monster groups unnecessarily
- Routes add <30% path length for safety

---

### Phase 3: Stuck Detection and Recovery

**Goal:** Detect and escape stuck situations.

**Files:** `stuck.ts`, updates to `movement.ts`

**Implementation:**

1. **stuck.ts - Detection**
   ```typescript
   function detectStuck(state: BotState, game: GameState): number  // Returns twitch level 0-3
   function getStuckResponse(twitchLevel: number): 'random' | 'force_combat' | 'force_descent' | 'wait'
   ```

   Twitch triggers:
   - No progress for N turns
   - Same position for N turns
   - Goal unreachable for N turns
   - Oscillating between 2-3 positions

2. **Recovery Actions**
   - Level 1: Random movement (break local minima)
   - Level 2: Fight nearest monster (clear blockage)
   - Level 3: Force descent if stairs known
   - Level 4: Wait and accept fate

**Tests:**
- Bot escapes dead-end corridors
- Bot breaks oscillation patterns
- Bot descends when truly stuck
- Twitch counter resets on progress

**Success Criteria:**
- <2% of turns spent twitching
- Zero infinite loops in 10000-turn test runs

---

### Phase 4: Goals and Priorities

**Goal:** Smart goal selection with clear priority order.

**Files:** `goals.ts`, updates to `index.ts`

**Implementation:**

1. **goals.ts - Goal Selection**
   ```typescript
   function selectGoal(game: GameState, state: BotState, personality: PersonalityParams): Goal
   ```

   Priority order:
   1. **FLEE** - HP < caution threshold AND enemies visible
   2. **RECOVER** - HP < 50% AND no enemies AND healing available
   3. **KILL** - Adjacent enemy (always attack what's next to you)
   4. **TAKE** - Valuable item within greed radius
   5. **DESCEND** - Explored enough OR patience exceeded
   6. **EXPLORE** - Default
   7. **WAIT** - Nothing else possible

2. **Goal Persistence**
   - Keep current goal if still valid
   - Only switch for higher priority
   - Force re-evaluate every N turns

**Tests:**
- Goal priority order respected
- Goals persist appropriately
- Goals switch when conditions change
- Each personality produces different goal patterns

**Success Criteria:**
- Clear goal at all times
- <10% goal thrashing (switches per turn)

---

### Phase 5: Combat Logic

**Goal:** Fight effectively, retreat when appropriate.

**Files:** `combat.ts`, `survival.ts`

**Implementation:**

1. **combat.ts - Engagement**
   ```typescript
   function shouldEngage(game: GameState, monster: Monster, personality: PersonalityParams): boolean
   function selectTarget(monsters: Monster[], character: Character): Monster | null
   ```

   Target selection:
   - Prefer low HP monsters (secure kills)
   - Prefer high threat monsters (remove danger)
   - Weight by personality aggression

2. **survival.ts - Retreat**
   ```typescript
   function shouldRetreat(game: GameState, personality: PersonalityParams): boolean
   function findRetreatDirection(game: GameState): Direction | null
   ```

   Retreat triggers:
   - HP below threshold
   - Outnumbered significantly
   - Fighting losing battle

**Tests:**
- Bot attacks adjacent enemies
- Bot retreats at appropriate HP levels
- Bot focuses correct targets
- Different personalities produce different combat patterns

**Success Criteria:**
- Average depth > 3
- Deaths from "smart retreat" > deaths from "fought too long"

---

### Phase 6: Items and Equipment

**Goal:** Pick up useful items, equip upgrades.

**Files:** `items.ts`

**Implementation:**

1. **items.ts - Evaluation**
   ```typescript
   function evaluateItem(item: Item, character: Character): number  // Value score
   function shouldPickup(item: GroundItem, character: Character, personality: PersonalityParams): boolean
   function shouldEquip(item: Item, character: Character): boolean
   ```

   Item value:
   - Equipment: Compare to current slot
   - Consumables: Healing value, tactical value
   - Gold: Always positive value

   Pickup decision:
   - Is it worth detouring for?
   - Do we have inventory space?
   - Is it safe to pick up?

**Tests:**
- Bot picks up gold
- Bot equips upgrades
- Bot uses healing potions
- Greedy personality collects more items

**Success Criteria:**
- Gold collection > 80% of available
- Equipment upgraded when better found

---

### Phase 7: Exploration

**Goal:** Efficiently explore to find stairs and items.

**Files:** `exploration.ts`

**Implementation:**

1. **exploration.ts - Frontier Detection**
   ```typescript
   function findExplorationTarget(game: GameState, state: BotState): Point | null
   function getExplorationProgress(game: GameState): number  // 0-100%
   ```

   Frontier: Unexplored tiles adjacent to explored tiles

   Target selection:
   - Nearest reachable frontier tile
   - Prefer areas with more unexplored neighbors
   - Avoid recently explored areas (spread out)

**Tests:**
- Bot explores entire reachable area
- Bot doesn't revisit explored areas
- Bot finds stairs reliably
- Exploration progress tracks correctly

**Success Criteria:**
- Finds stairs in >95% of levels
- Explores >80% of reachable area before descending (per personality)

---

### Phase 8: Personality System

**Goal:** Distinct, tunable play styles.

**Files:** `personality.ts`

**Personalities:**

```typescript
const PERSONALITIES: Record<BotPersonality, PersonalityParams> = {
  cautious: {
    aggression: 30,
    greed: 40,
    caution: 50,      // Retreat at 50% HP
    exploration: 80,   // Explore 80% before descending
    patience: 200,
  },
  aggressive: {
    aggression: 80,
    greed: 30,
    caution: 20,      // Fight to 20% HP
    exploration: 60,
    patience: 150,
  },
  greedy: {
    aggression: 50,
    greed: 80,        // Detour far for items
    caution: 40,
    exploration: 90,   // Explore thoroughly for loot
    patience: 300,
  },
  speedrunner: {
    aggression: 40,
    greed: 20,        // Ignore most items
    caution: 35,
    exploration: 30,   // Beeline for stairs
    patience: 100,
  },
}
```

**Tests:**
- Each personality reaches different average depth
- Each personality has distinct behavior patterns
- Parameters affect decisions as expected

**Success Criteria:**
- Measurable differences between personalities
- All personalities achieve minimum viable performance

---

## Testing Strategy

### Unit Tests (per module)
- `flow.test.ts` - BFS correctness, cost accuracy
- `danger.test.ts` - Threat calculation accuracy
- `stuck.test.ts` - Detection triggers correctly
- `goals.test.ts` - Priority ordering
- `combat.test.ts` - Target selection, retreat triggers
- `items.test.ts` - Value calculation, pickup decisions
- `exploration.test.ts` - Frontier detection

### Integration Tests
- `bot-movement.test.ts` - Pathfinding + anti-oscillation
- `bot-combat.test.ts` - Full combat loop
- `bot-level.test.ts` - Complete level clearance

### Performance Tests
- Run 100 games, measure:
  - Average depth reached
  - Average turns per level
  - Death causes distribution
  - Items collected
  - Stuck/twitch frequency

### Regression Tests
- Specific scenarios that previously caused issues
- Record seed + actions, replay to verify fix

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Stairs found | >95% | Levels where stairs reached / total levels |
| Average depth | >5 | Mean depth at death/victory |
| Oscillation rate | <1% | Turns with A-B-A pattern / total turns |
| Stuck rate | <2% | Turns at twitch level >0 / total turns |
| Path efficiency | >90% | Optimal path length / actual path length |
| Combat deaths | >80% | Deaths from monsters / total deaths |

---

## Key Differences from v1

1. **Flow-based pathfinding** instead of per-turn A*
2. **Danger grid** integrated into movement
3. **Explicit stuck detection** with escalating responses
4. **Step history** for anti-oscillation
5. **Goal type system** with persistence
6. **Personality parameters** instead of if/else branches
7. **Modular architecture** with clear file boundaries
8. **Comprehensive testing** at each phase

---

## Development Order

1. Types and state management
2. Flow computation (BFS)
3. Basic movement (no danger)
4. Danger grid integration
5. Stuck detection
6. Goal system
7. Combat logic
8. Item handling
9. Exploration
10. Personality tuning

Each phase builds on the previous. Each phase has tests that must pass before proceeding.
