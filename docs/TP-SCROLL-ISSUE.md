# TP Scroll Issue Investigation

## Problem Statement

Bots reach deep depths (45-49) without TP scrolls, get stuck, and hit circuit breakers.

**Baseline:** 5/30 CB (16.7%) for Necromancer with `--max-upgrades --turns=50000`

## Root Causes Identified

### 1. Readiness Gate Bypass (progression.ts)

When `initiateFarmingLoop` returns null, code falls through to `getDescendGoal()`:

```typescript
if (readinessIssue) {
  const farmingGoal = initiateFarmingLoop(context)
  if (farmingGoal) return farmingGoal
  // BUG: Falls through to descent when farming returns null!
}
return getDescendGoal(context)  // No readiness check here
```

**Why farming returns null:**
- `getTownTripGoal()` - null if no TP scroll or gold/level not met
- `getAscendToFarmGoal()` - null if not under-leveled
- `getFarmGoal()` - null if no monsters/items visible in tether

### 2. Town Replenishment Failure

Shop marked "visited" BEFORE purchase success verified (tick.ts:664-666):
```typescript
if (goal.type === 'BUY_FROM_MERCHANT' && goal.targetId) {
  botState.shopsVisitedForBuying.add(goal.targetId)  // Marked before purchase!
}
```

When purchase fails (out of stock, insufficient gold), shop can't be retried that trip.

### 3. Chicken-and-Egg Problem

- Bot needs TP scroll to go to town
- Bot needs gold to buy TP scroll
- If bot uses TP to visit town without enough gold, it leaves with fewer TP
- Eventually bot has 0 TP and can't restock

## Approaches Tried

### Approach 1: Return null when not ready
**Result:** 29/30 CB at depth 1
**Problem:** Bot can't progress at all - EXPLORE has nothing to do on fully explored map

### Approach 2: Early-game level variance
**Result:** Helps squishy classes meet requirements at depths 1-5
**Problem:** Doesn't address the core consumable issue

### Approach 3: Ascend when stuck (immediate)
**Result:** 30/30 stuck at depths 10-11 with max_turns
**Problem:** Bot oscillates up/down instead of farming, spends thousands of turns walking

### Approach 4: Emergency ascent after 500 turns (from reverted commit)
**Result:** CB rate similar to baseline (no improvement)
**Problem:** 500 turns too long, only triggers at depth 30+

## Key Insights

1. **Handle early, not late** - Bot should never reach deep depths without TP in the first place

2. **EXPLORE won't help** - When map is explored and farming returns null, returning null just leads to CB

3. **Aggressive ascent backfires** - Ascending every time farming fails causes oscillation

4. **The real issue is replenishment** - Bot uses TP scrolls but doesn't reliably buy replacements

5. **Multiple failure points** - Single fix won't work because failure can occur at:
   - TP purchase failure (unknown cause - need logging)
   - Gold/level requirements not met for town trip
   - Progression gate bypass

6. **Need layered defense** - Multiple fallback mechanisms at different depths and states

## Ideas Evaluated

| Idea | Status | Notes |
|------|--------|-------|
| Fix shop stock | Not the issue | Shops always have 4-6 TP at 75g each |
| Increase TP buy target | Not needed | Cap is 2, target is 2, they match |
| Walk to town at shallow depths | Viable | Currently only works at depth 1 |
| Fix progression gate | Needs prereqs | Everything else must work first |
| Conditional ascent | Rejected | Caused oscillation at depths 10-11 |
| Random farming for TP | Wrong approach | Bot should never need this |

## Key Principle

**The bot should NEVER be in a position where it needs to randomly farm and hope for TP drops.**

The fix must be PREVENTIVE, not reactive.

## Potential Solutions

### Solution A: Extend Walk-to-Town (Confirmed Viable)
Extend `getTownWalkGoal` to work at depths 1-5 instead of just depth 1.

**Pros:** Provides fallback when bot has no TP at shallow depths
**Cons:** Only helps if bot is already at shallow depth

### Solution B: Fix Progression Gate (Structural, Complex)
When `readinessIssue` exists and farming returns null, DON'T fall through to descent.

Options attempted:
1. Return null → (Failed: 29/30 CB at depth 1)
2. Ascend immediately → (Failed: 30/30 oscillation at depths 10-11)

**Requires:** Everything else working correctly first, otherwise causes oscillation or surface walks from depth 40.

### Need More Data

Before proposing more solutions, need to understand why TP buying failed at turn 18006:
1. Add logging to track TP count, gold, inventory size at town entry/exit
2. Determine which condition prevented purchase
3. Fix the specific failure point

## Investigation Results (Seed 1007)

### TP Scroll Lifecycle Trace

**Town Trips Made:**
| Turn | Depth From | Action |
|------|------------|--------|
| 4831 | 0→2 | Town trip |
| 6097 | 0→2 | Town trip |
| 7419 | 0→2 | Town trip |
| 8423 | 0→3 | Town trip |
| 9427 | 0→2 | Town trip |
| 11355 | 0→4 | Town trip |
| 12766 | 0→4 | Town trip |
| 16067 | 0→8 | Town trip |
| 18006 | 0→12 | **LAST town trip** |

**After Turn 18006:**
- No more town trips for the next 12,000 turns
- Bot continued descending from depth 12 to depth 46
- Hit circuit breaker at turn 30137, depth 46

### What Happened at Last Town Trip (Turn 18006)

```
Turn 18006: Used Scroll of Town Portal → arrived in town
Turn 18007-18032: Walked to SELL_TO_MERCHANT@(4,12), sold items
Turn 18033-18072: Walked to VISIT_HEALER@(43,3), healed
Turn 18073-18091: Walked to BUY_FROM_MERCHANT@(43,11), bought ONE item
Turn 18092-18107: Returned through portal to depth 12
```

**Critical observation:** Only ONE shop visited for buying (`town_magic` at 43,11), then immediately returned.

**Note:** Shops always have 4-6 TP scrolls in stock at 75g each. TP cap = 2, target = 2. The buying logic should work correctly. Unknown why TP wasn't purchased - need logging to diagnose.

### Why Bot Stopped Going to Town

After returning from town trip at turn 18006:
1. Bot had 0 TP scrolls (used the last one for the trip, didn't buy replacement)
2. `getTownTripGoal()` requires `findTownPortalScroll()` to return a scroll
3. With no TP scroll, `getTownTripGoal()` returns null
4. `initiateFarmingLoop()` returns null (no town trip possible, not under-leveled, no farm targets)
5. Falls through to `getDescendGoal()` which has no consumable check
6. Bot descends from depth 12 to depth 46 without ever visiting town

### Root Cause Chain

```
1. Bot uses TP scroll to go to town (now has 0-1 TP)
       ↓
2. Something prevents buying TP (unknown - need logging)
       ↓
3. Bot returns to dungeon without replenishing TP
       ↓
4. Eventually runs out of TP scrolls
       ↓
5. getTownTripGoal() returns null (no TP = can't go to town)
       ↓
6. initiateFarmingLoop() returns null (can't farm, not under-leveled)
       ↓
7. getProgressionGoal() falls through to getDescendGoal()
       ↓
8. Bot descends despite not having required consumables
       ↓
9. Eventually circuit breaker triggers at depth 46
```

**The critical unknown:** What prevented TP purchase at turn 18006?

## Specific Bugs Identified

### Bug 1: Shop Visit Timing (tick.ts:513)
```typescript
// In getGoalArrivalAction():
updateTownState(botState, goal, game)  // Marks shop visited FIRST
return executeGoalAction(goal, game, botState, config)  // Then tries to buy
```

Shop is marked visited BEFORE `botBuySupplies()` runs. If purchase fails (can't afford), shop is still marked visited and won't be retried.

**Note:** Shops always have 4-6 TP scrolls in stock (regenerated on entry). Stock availability is NOT the issue.

### Bug 2: Progression Gate Bypass (progression.ts:341-351)
```typescript
if (readinessIssue) {
  const farmingGoal = initiateFarmingLoop(context)
  if (farmingGoal) return farmingGoal
  // Falls through when farming returns null!
}
return getDescendGoal(context)  // No consumable check!
```

### Bug 3: No Shallow-Depth Walk-to-Town
`getTownWalkGoal()` only works at depth 1:
```typescript
if (character.depth !== 1) return null  // Only works at depth 1
```

At depths 2-3, bot could walk to town but doesn't try.

### Inventory Caps (Working as Designed)
```typescript
// preparation.ts - Consumable caps
CONSUMABLE_CAPS.townPortal = 2  // Max TP scrolls bot will hold

// merchant.ts - Buy target
const baseTP = 2
const wantedTP = Math.max(0, baseTP + goldBonus - tpScrollCount)
```

Bot targets 2 TP and caps at 2 TP. These match.

**If bot uses 1 TP for trip:**
- Had 2 TP → arrives with 1 → buys 1 → leaves with 2 ✓
- Had 1 TP → arrives with 0 → buys 2 → leaves with 2 ✓

The replenishment logic is correct. The failure must be elsewhere.

## Failure Mode Summary

The bot can get stuck via multiple paths:

```
Path A: TP Exhaustion
  Bot uses TP for town trip
  → Can't afford replacement (gold < 75 after healing)
  → Returns with fewer TP than before
  → Eventually runs out of TP
  → Can't trigger town trip
  → Falls through progression gate → descends → CB

Path B: Gold/Level Requirements Not Met
  Bot at depth N with TP scrolls
  → Doesn't meet gold target OR level < depth
  → Town trip returns null
  → Falls through progression gate → descends → CB

All paths converge at: progression gate bypass (Bug 2)
```

**Unknown:** Why did the bot at turn 18006 fail to buy TP? Need inventory state logging to determine the cause. Consumables have separate caps (TP cap = 2), so inventory slot limits shouldn't be the issue.

## Questions Answered

1. **Why does bot end up deep without TP?**
   - Used last TP for town trip, couldn't afford replacement OR already had 2 (didn't need more)
   - No TP = can't trigger another town trip
   - Falls through progression gate to descent

2. **Is bot using TP for emergencies?**
   - No evidence in this trace - all TP usage was for town trips
   - Emergency escape at turn 26639 used Teleportation scroll, not TP

3. **Are getTownWalkGoal and gold checks working?**
   - `getTownWalkGoal` only fires at depth 1, not depths 2-3
   - Gold check in `getTownTripGoal` works but requires having a TP scroll first

4. **What is the TP usage pattern?**
   - 9 town trips total, one TP per trip
   - Last trip at turn 18006 from depth 12
   - Bot failed to restock TP on that trip
   - Never went to town again (couldn't - no TP)

## Test Commands

```bash
# Baseline test
pnpm diagnose find --runs=30 --seed=1000 --class=necromancer --max-upgrades --turns=50000

# Deep analysis of specific seed
pnpm diagnose deep --seed=1007 --class=necromancer --max-upgrades --turns=50000 --from=29000 --to=30200

# Check town trip behavior
pnpm diagnose deep --seed=1000 --class=necromancer --max-upgrades | grep -E "(TOWN|town|TP|portal)"
```

## What Works vs What Doesn't

### Working Correctly:
- Shop inventory: Always has 4-6 TP scrolls at 75g each
- Shop regeneration: Restocks on every town entry
- Consumable caps: TP cap = 2, target = 2 (match)
- TP usage for emergencies: Preserved at early depths (1-4)
- Readiness checks: Correctly identify when bot needs consumables
- Town trip flow: SELL → HEAL → BUY → RETURN works correctly

### Not Working:
- TP replenishment: Bot may leave town without buying replacement TP (see Root Causes below)
- Progression gate: Falls through to descent when farming returns null
- Walk-to-town: Only works at depth 1, not depths 2-5

## Root Causes Identified (Session 2)

### Bug 4: Wrong Shop Selection (FIXED)
`botBuySupplies` used `findAdjacentMerchant(game)` which returns the FIRST adjacent merchant found. Since `town_alchemy` (43,12) is initialized before `town_magic` (43,11) in the merchant array, when bot stands at town_magic position, both shops are adjacent (within 1 tile) and alchemy is found first.

**Fix applied:** Modified `botBuySupplies` to accept optional `targetMerchantId` parameter and find the specific merchant by ID instead of any adjacent one.

### Bug 5: Engine Inventory Limit Blocks Consumable Purchases (FIXED)
`buyFromMerchant` in features.ts had a hard 20-item inventory limit that counted ALL items:
```typescript
if (game.character.inventory.length >= 20) {
  return false
}
```

Bot had 27+ items when trying to buy TP scrolls. The engine wasn't aligned with the bot's design where consumables are separate from equipment.

**Fix applied:** Modified `buyFromMerchant` to only count equipment (non-consumables) toward the 20-item limit. Consumables (potions/scrolls) bypass this check - they have their own caps enforced by bot logic.

```typescript
const isConsumable = item.template.type === 'potion' || item.template.type === 'scroll'
if (!isConsumable) {
  const equipmentCount = game.character.inventory.filter(
    (i) => i.template.type !== 'potion' && i.template.type !== 'scroll'
  ).length
  if (equipmentCount >= 20) {
    return false
  }
}
```

## Results

**Before fixes:** 5/30 CB (16.7%) - Baseline
**After fixes:** 1/30 CB (3.3%) - 80% reduction in circuit breakers

## Remaining Issues

1. **Progression gate bypass (Bug 2)** - Still falls through to descent when farming returns null
2. **Walk-to-town depth limit (Bug 3)** - Only works at depth 1, not depths 2-5

## Files Involved

- `src/game/bot/progression.ts` - Descent gating, emergency ascent
- `src/game/bot/farming.ts` - Town trips, farming loops
- `src/game/bot/preparation.ts` - Readiness checks, consumable requirements
- `src/game/bot/survival-retreat.ts` - TP preservation logic (lines 558-573)
- `src/game/bot/goals.ts` - Town needs, shop selection
- `src/game/bot/merchant.ts` - Purchase logic
- `src/game/bot/tick.ts` - Shop visit tracking
