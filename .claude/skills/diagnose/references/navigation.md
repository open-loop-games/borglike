# Navigating Diagnostic Output

The diagnostic toolkit produces verbose output by design. This guide helps you extract relevant information efficiently.

## Output Structure

### Quick Mode (~100-300 lines)
```
Configuration (race, class, personality)
Final State (turn, depth, HP, kills, position)
Issues (all warnings/errors with turn numbers)
Analyzer Sections (stuck, movement, pathing, exploration, combat, goal, etc.)
```

### Deep Mode (5000+ lines for full run)
```
[Same as Quick Mode]
Turn Log (one line per turn with action, position, HP, goal)
```

## Turn Range Strategy

The `--from` and `--to` flags are your most powerful navigation tools.

### Common Ranges

**Initial diagnosis:**
```bash
# Full overview
npx tsx scripts/diagnose.ts quick --seed=12345

# Early game behavior (first 100 turns)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=0 --to=100

# Late game behavior (last 100 turns)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=4900 --to=5000
```

**Investigating specific issues:**
```bash
# Wide context around problem turn (100 turn window)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=3400 --to=3500

# Focused view (40 turn window)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=3410 --to=3450

# Immediate context (20 turn window)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=3420 --to=3440
```

**Level-specific behavior:**
Use Issues section to find turn numbers when bot enters/exits depths, then examine those ranges.

## Grep Patterns

### Finding Issues

```bash
# All issues with turn numbers
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "^\[WARN\|^\[ERROR\]"

# Specific issue types
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Repeated same action"
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Stairs not found"
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Exploration stagnant"
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "oscillation\|jitter"

# Count issues by type
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Repeated same action" | wc -l
```

### Finding Analyzer Sections

```bash
# Jump to specific analyzer
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A20 "Analyzer: stuck"
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A30 "Analyzer: goal"
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A25 "Analyzer: jitter"

# All analyzer metrics (skip details)
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Analyzer:\|^  [a-z].*:"
```

### Turn Log Patterns

```bash
# Find specific turn number
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "Turn.*3432:"

# Find combat actions
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "action=attack:\|action=ranged_attack:"

# Find movement issues
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "\[STUCK:"
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "action=wait"

# Find goal changes
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "goal=EXPLORE"
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "goal=DESCEND"

# Find depth changes
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "\[DESCENDED\]"
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "\[ASCENDED\]"

# Find damage events
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "\[DAMAGE\]"
```

### Filtering Goal Activity

```bash
# Show only turns with goal changes
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | \
  grep -E "goal=(EXPLORE|DESCEND|KILL|FLEE|FARM)"

# Count goal switches
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | \
  grep "goal=" | wc -l

# Find specific goal type
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "goal=FLEE"
```

## Head/Tail Usage

### Quick Triage

```bash
# First 100 lines (config + issues summary + first analyzers)
npx tsx scripts/diagnose.ts quick --seed=12345 | head -100

# Just the issues section
npx tsx scripts/diagnose.ts quick --seed=12345 | head -60

# Final stats only
npx tsx scripts/diagnose.ts quick --seed=12345 | tail -50
```

### Turn Log Navigation

```bash
# First 50 turns
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | head -50

# Last 100 turns
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | tail -100

# Skip header info, show only turn log
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "^  Turn"
```

## Workflow Examples

### Stuck Bot Investigation

```bash
# 1. Check for stuck episodes and get turn numbers
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -E "Repeated|STUCK"

# Output shows: [WARN] Repeated same action 20x (turn 3432)

# 2. Examine that specific turn range
npx tsx scripts/diagnose.ts deep --seed=12345 --from=3400 --to=3460

# 3. Check stuck analyzer metrics
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A15 "Analyzer: stuck"
```

### Oscillation/Jitter Investigation

```bash
# 1. Find jitter episodes and their turn ranges
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A30 "Analyzer: jitter"

# Output shows: Turn 1558-1561: 3 turns, area=19.3, center=(54,3)

# 2. Examine specific episode with map
npx tsx scripts/diagnose.ts deep --seed=12345 --from=1558 --to=1561 --map

# 3. Check oscillation patterns
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A25 "Analyzer: oscillation"
```

### Goal Behavior Investigation

```bash
# 1. Check goal metrics and completion rates
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A50 "Analyzer: goal"

# 2. Find turns where goals persisted too long
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "persisted for"

# 3. Examine goal thrashing (rapid switches)
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A20 "Analyzer: goal-distance"

# 4. See turn-by-turn goal changes in a specific range
npx tsx scripts/diagnose.ts deep --seed=12345 --from=500 --to=600 --log-only | \
  grep "goal="
```

### Exploration Issues

```bash
# 1. Find stairs discovery problems
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Stairs not found"

# 2. Check exploration stagnation
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "Exploration stagnant"

# 3. Review exploration metrics
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A15 "Analyzer: exploration"

# 4. Examine specific depth exploration (e.g., depth 7 issues at turn ~1500)
npx tsx scripts/diagnose.ts deep --seed=12345 --from=1450 --to=1550 --map
```

### Combat Analysis

```bash
# 1. Check combat stats
npx tsx scripts/diagnose.ts quick --seed=12345 | grep -A15 "Analyzer: combat"

# 2. Find all combat turns
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | \
  grep "action=attack:\|action=ranged_attack:"

# 3. Find flee events
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "goal=FLEE"

# 4. Track damage taken
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | grep "\[DAMAGE\]"
```

### Death Investigation

```bash
# 1. Find death turn
npx tsx scripts/diagnose.ts quick --seed=12345 | grep "End reason:"

# 2. Examine final 100 turns leading to death
npx tsx scripts/diagnose.ts deep --seed=12345 --from=DEATH_TURN-100 --to=DEATH_TURN

# 3. Check final HP progression
npx tsx scripts/diagnose.ts deep --seed=12345 --from=DEATH_TURN-50 --to=DEATH_TURN --log-only | \
  grep "HP="
```

### Performance Comparison

```bash
# 1. Run batch mode and save output
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 > baseline.txt

# 2. After code changes, run same seeds
npx tsx scripts/diagnose.ts batch --runs=100 --seed=1000 > modified.txt

# 3. Compare aggregate metrics
diff baseline.txt modified.txt | grep -E "Avg|Success"

# 4. Find which seeds changed behavior
diff baseline.txt modified.txt | grep "seed="
```

## Piping Tips

### Save Full Output for Later Analysis

```bash
# Save full diagnostic for offline review
npx tsx scripts/diagnose.ts deep --seed=12345 > /tmp/diag-12345.txt

# Search it later
grep "Stairs not found" /tmp/diag-12345.txt
grep -A10 "Turn.*2000:" /tmp/diag-12345.txt
```

### Extract Specific Sections

```bash
# Extract just issues to a file
npx tsx scripts/diagnose.ts quick --seed=12345 | \
  grep "^\[WARN\|^\[ERROR\]" > issues.txt

# Extract turn log only
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only | \
  grep "^  Turn" > turns.txt
```

### Multiple Seeds Investigation

```bash
# Check multiple seeds for common issues
for seed in 1000 1001 1002 1003; do
  echo "=== Seed $seed ==="
  npx tsx scripts/diagnose.ts quick --seed=$seed | grep -c "Stairs not found"
done

# Find which seed has the worst stuck rate
for seed in 1000 1001 1002 1003; do
  rate=$(npx tsx scripts/diagnose.ts quick --seed=$seed | grep "Wait rate:" | grep -o "[0-9.]*%")
  echo "Seed $seed: $rate"
done
```

## Performance Tips

### Minimize Output Volume

```bash
# Use quick mode for metrics only (10x faster)
npx tsx scripts/diagnose.ts quick --seed=12345

# Use --log-only to skip analyzer processing
npx tsx scripts/diagnose.ts deep --seed=12345 --log-only

# Use narrow turn ranges
npx tsx scripts/diagnose.ts deep --seed=12345 --from=100 --to=200
```

### Reduce Run Time

```bash
# Lower max turns for faster iteration
npx tsx scripts/diagnose.ts quick --seed=12345 --turns=1000

# Use fewer runs in batch mode
npx tsx scripts/diagnose.ts batch --runs=20 --seed=1000

# Reduce thread count to avoid CPU saturation
npx tsx scripts/diagnose.ts batch --runs=100 --threads=4
```

## Common Turn Range Calculations

When Issues section shows a problem at turn N:

| Context Needed | Range | Example (turn 3432) |
|----------------|-------|---------------------|
| Immediate | N-10 to N+10 | 3422-3442 |
| Local | N-25 to N+25 | 3407-3457 |
| Context | N-50 to N+50 | 3382-3482 |
| Full episode | N-100 to N+100 | 3332-3532 |

## Turn Log Flags Reference

When reading turn logs, these flags indicate special events:

- `[MOVED]` - Position changed this turn
- `[DAMAGE]` - Took damage this turn
- `[DESCENDED]` - Went down stairs
- `[ASCENDED]` - Went up stairs
- `[STUCK:N]` - Stuck counter triggered (N consecutive waits/ineffective moves)

## Quick Reference Card

```bash
# Typical investigation workflow
npx tsx scripts/diagnose.ts quick --seed=X                    # Get overview
npx tsx scripts/diagnose.ts quick --seed=X | head -60         # See issues
npx tsx scripts/diagnose.ts deep --seed=X --from=N-50 --to=N+50  # Investigate
npx tsx scripts/diagnose.ts deep --seed=X --from=N-20 --to=N+20 --map  # With map

# Common greps
| grep "^\[WARN\|^\[ERROR\]"          # All issues
| grep -A20 "Analyzer: stuck"         # Stuck metrics
| grep "Stairs not found"              # Exploration failures
| grep "action=wait"                   # Wait actions
| grep "goal=FLEE"                     # Flee events

# Turn log extraction
--log-only | grep "^  Turn"            # Just turns
--log-only | grep "Turn.*3432:"        # Specific turn
--log-only | grep "action=attack:"     # Combat
--log-only | grep "\[STUCK:"           # Stuck episodes
```
