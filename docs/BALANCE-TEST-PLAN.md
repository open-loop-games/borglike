# Balance Test Plan

## Current State (2026-02-02)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `e2e8144` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.6 | 50 | 2% | 22099 | 650 | 7 | ✅ Endgame |
| **Berserker** | 49.4 | 50 | 0% | 14715 | 530 | 20 | ✅ Endgame |
| **Warrior** | 49.4 | 50 | 0% | 16774 | 548 | 8 | ✅ Endgame |
| **Paladin** | 49.0 | 50 | 0% | 21880 | 665 | 3 | ✅ Endgame |
| **Blackguard** | 48.9 | 50 | 0% | 15681 | 558 | 2 | ✅ Endgame |
| **Rogue** | 47.9 | 50 | 1% | 22257 | 625 | 0 | ✅ Endgame |
| **Necromancer** | 47.5 | 50 | 0% | 22782 | 649 | 0 | ✅ Endgame |
| **Mage** | 47.1 | 50 | 2% | 25396 | 616 | 0 | ✅ Endgame |
| **Druid** | 47.1 | 50 | 0% | 21348 | 619 | 0 | ✅ Endgame |
| **Archmage** | 46.6 | 50 | 1% | 25441 | 603 | 0 | ✅ Endgame |
| **Priest** | 46.5 | 50 | 0% | 24121 | 727 | 0 | ✅ Endgame |

**Summary:** All classes healthy. Fixed two caster CB bugs: (1) sweep timeout reset loop (sweepExhausted flag prevents re-enabling after timeout), (2) town shopping bypass (RETURN_PORTAL moved after sell/heal/buy steps). **40 Morgoth kills** (20 berserker, 8 warrior, 7 ranger, 3 paladin, 2 blackguard). Mage CB 14%→2%, Archmage 13%→1%, Necromancer 9%→0%. All CB rates now ≤2%.

### Previous Baseline @ `12fa009` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Status |
|-------|-----------|-----------|---------|-----------|-------|--------|
| **Ranger** | 47.3 | 50 | 0% | 19279 | 575 | ✅ Endgame |
| **Berserker** | 46.4 | 50 | 1% | 13490 | 474 | ✅ Endgame |
| **Warrior** | 45.6 | 50 | 0% | 13773 | 459 | ✅ Endgame |
| **Paladin** | 44.0 | 50 | 0% | 18191 | 556 | ✅ Endgame |
| **Priest** | 42.7 | 50 | 0% | 20181 | 578 | ✅ Endgame |
| **Necromancer** | 41.0 | 47 | 16% | 18780 | 511 | ✅ Endgame |
| **Blackguard** | 40.4 | 50 | 3% | 12067 | 410 | ✅ Endgame |
| **Mage** | 40.3 | 48 | 8% | 20039 | 468 | ✅ Endgame |
| **Rogue** | 39.4 | 50 | 0% | 17202 | 462 | ✅ Endgame |
| **Archmage** | 38.7 | 47 | 16% | 19280 | 445 | ✅ Endgame |
| **Druid** | 36.6 | 49 | 0% | 16202 | 431 | ✅ Endgame |

**Summary:** All classes endgame-viable. Fixed KILL goal persistence bug (goals persisted after teleport due to stale visibility check). CB rates improved: Necro 21%→16%, Archmage 19%→16%, Mage 6%→8%.

### Previous Baseline @ `3672f59` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Warrior** | 48.5 | 50 | 1% | 14383 | 505 | 6 | ✅ Endgame |
| **Ranger** | 48.5 | 50 | 0% | 19627 | 596 | 1 | ✅ Endgame |
| **Berserker** | 48.4 | 50 | 0% | 13846 | 505 | 5 | ✅ Endgame |
| **Paladin** | 47.0 | 50 | 0% | 18788 | 596 | 0 | ✅ Endgame |
| **Blackguard** | 46.6 | 50 | 0% | 13694 | 499 | 1 | ✅ Endgame |
| **Priest** | 44.8 | 50 | 1% | 20822 | 626 | 0 | ✅ Endgame |
| **Rogue** | 44.8 | 50 | 2% | 19047 | 535 | 0 | ✅ Endgame |
| **Druid** | 43.3 | 50 | 0% | 18143 | 522 | 0 | ✅ Endgame |
| **Mage** | 41.9 | 50 | 6% | 20420 | 488 | 0 | ⚠️ CB Regression |
| **Necromancer** | 41.6 | 50 | 21% | 19156 | 524 | 0 | ⚠️ CB Regression |
| **Archmage** | 39.7 | 48 | 19% | 19596 | 461 | 0 | ⚠️ CB Regression |

**Summary:** All classes endgame-viable. Caster CB rates worsened (Necro 21%, Archmage 19%, Mage 6%). **13 Morgoth kills** (6 warrior, 5 berserker, 1 ranger, 1 blackguard). Archmage max depth dropped to 48.

### Previous Baseline @ `4113ace` (100 runs, 50k turns, seed=1000, max-upgrades) - Balance Testing Plan

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Warrior** | 48.5 | 50 | 1% | 14383 | 505 | 6 | ✅ Endgame |
| **Ranger** | 48.5 | 50 | 0% | 19627 | 596 | 1 | ✅ Endgame |
| **Berserker** | 48.4 | 50 | 0% | 13846 | 505 | 5 | ✅ Endgame |
| **Paladin** | 47.0 | 50 | 0% | 18788 | 596 | 0 | ✅ Endgame |
| **Blackguard** | 46.6 | 50 | 0% | 13694 | 499 | 1 | ✅ Endgame |
| **Priest** | 44.8 | 50 | 1% | 20822 | 626 | 0 | ✅ Endgame |
| **Rogue** | 44.8 | 50 | 2% | 19047 | 535 | 0 | ✅ Endgame |
| **Necromancer** | 43.5 | 48 | 14% | 19199 | 540 | 0 | ⚠️ CB Regression |
| **Druid** | 43.3 | 50 | 0% | 18143 | 522 | 0 | ✅ Endgame |
| **Mage** | 42.6 | 48 | 9% | 20174 | 485 | 0 | ⚠️ CB Regression |
| **Archmage** | 40.7 | 49 | 10% | 19242 | 460 | 0 | ⚠️ CB Regression |

**Summary:** All classes endgame-viable. Caster CB rates persist (Necro 14%, Mage 9%, Archmage 10%). **13 Morgoth kills** (6 warrior, 5 berserker, 1 ranger, 1 blackguard). Rogue CB at 2%.

### Previous Baseline @ `9bba82b` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Artifact Abilities

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 48.3 | 50 | 0% | 19404 | 594 | 3 | ✅ Endgame |
| **Warrior** | 48.1 | 50 | 1% | 14311 | 498 | 5 | ✅ Endgame |
| **Berserker** | 47.8 | 50 | 1% | 13610 | 496 | 2 | ✅ Endgame |
| **Blackguard** | 46.8 | 50 | 0% | 13719 | 500 | 2 | ✅ Endgame |
| **Paladin** | 46.4 | 50 | 0% | 18576 | 592 | 0 | ✅ Endgame |
| **Necromancer** | 43.9 | 49 | 14% | 29585 | 701 | 0 | ⚠️ CB Regression |
| **Priest** | 43.9 | 50 | 0% | 20406 | 598 | 0 | ✅ Endgame |
| **Druid** | 43.7 | 50 | 0% | 18210 | 522 | 0 | ✅ Endgame |
| **Rogue** | 43.5 | 50 | 0% | 18602 | 517 | 1 | ✅ Endgame |
| **Mage** | 42.2 | 50 | 11% | 30713 | 642 | 0 | ⚠️ CB Regression |
| **Archmage** | 41.1 | 48 | 17% | 30078 | 629 | 0 | ⚠️ CB Regression |

**Summary:** All classes endgame-viable but caster CB rates regressed (Mage 11%, Necro 14%, Archmage 17%). **13 Morgoth kills** (5 warrior, 3 ranger, 2 berserker, 2 blackguard, 1 rogue). Implemented: slays, status protections, Free Action, equipment Regeneration. Removed unimplemented Telepathy.

### Previous Baseline @ `b6ccc40` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Gold Economy Rebalance

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.0 | 50 | 0% | 22017 | 652 | 2 | ✅ Endgame |
| **Blackguard** | 48.5 | 50 | 0% | 15771 | 556 | 1 | ✅ Endgame |
| **Berserker** | 48.5 | 50 | 0% | 14651 | 526 | 9 | ✅ Endgame |
| **Paladin** | 48.1 | 50 | 1% | 22120 | 663 | 0 | ✅ Endgame |
| **Warrior** | 47.8 | 50 | 0% | 16170 | 535 | 6 | ✅ Endgame |
| **Rogue** | 47.1 | 50 | 0% | 22391 | 627 | 0 | ✅ Endgame |
| **Mage** | 46.8 | 50 | 1% | 36863 | 780 | 2 | ✅ Endgame |
| **Necromancer** | 46.5 | 50 | 3% | 32986 | 797 | 0 | ✅ Endgame |
| **Archmage** | 45.8 | 50 | 2% | 35744 | 764 | 0 | ✅ Endgame |
| **Druid** | 45.6 | 50 | 0% | 21477 | 604 | 0 | ✅ Endgame |
| **Priest** | 44.9 | 50 | 0% | 24132 | 689 | 1 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (44.9-49.0 avg depth). **21 Morgoth kills** (9 berserker, 6 warrior, 2 ranger, 2 mage, 1 blackguard, 1 priest). CB rates 0-3%. Gold economy rebalanced: quadratic equipment pricing, reduced late-game gold drops, depth-aware bot shopping logic.

### Previous Baseline @ `54a9e7a` (100 runs, 50k turns, seed=1000, max-upgrades) - Post Upgrade Rebalance

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.3 | 50 | 1% | 22588 | 658 | 4 | ✅ Endgame |
| **Berserker** | 48.7 | 50 | 0% | 14700 | 531 | 16 | ✅ Endgame |
| **Warrior** | 48.2 | 50 | 0% | 16505 | 536 | 11 | ✅ Endgame |
| **Paladin** | 48.0 | 50 | 0% | 22478 | 660 | 2 | ✅ Endgame |
| **Blackguard** | 47.5 | 50 | 0% | 15480 | 544 | 2 | ✅ Endgame |
| **Rogue** | 47.1 | 50 | 0% | 22919 | 621 | 0 | ✅ Endgame |
| **Mage** | 46.6 | 50 | 1% | 36755 | 778 | 1 | ✅ Endgame |
| **Necromancer** | 46.6 | 50 | 1% | 33407 | 800 | 0 | ✅ Endgame |
| **Archmage** | 45.8 | 50 | 1% | 35933 | 764 | 0 | ✅ Endgame |
| **Druid** | 45.5 | 50 | 0% | 21567 | 607 | 0 | ✅ Endgame |
| **Priest** | 45.5 | 50 | 0% | 24259 | 709 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (45+ avg depth). **36 Morgoth kills** (16 berserker, 11 warrior, 4 ranger, 2 paladin, 2 blackguard, 1 mage). CB rates excellent (0-1%). Nerfed Swiftness (25%→10% dodge) and buffed Resilience (5→10 armor) with no measurable impact.

### Baseline @ `9b151af` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-------|-------|---------|--------|
| **Ranger** | 49.4 | 50 | 1% | 22369 | 652 | 3 | ✅ Endgame |
| **Blackguard** | 48.3 | 50 | 0% | 16802 | 557 | 5 | ✅ Endgame |
| **Warrior** | 48.3 | 50 | 0% | 16259 | 538 | 11 | ✅ Endgame |
| **Berserker** | 48.3 | 50 | 0% | 14854 | 516 | 14 | ✅ Endgame |
| **Paladin** | 48.0 | 50 | 0% | 22131 | 657 | 3 | ✅ Endgame |
| **Necromancer** | 46.8 | 50 | 4% | 33386 | 806 | 0 | ✅ Endgame |
| **Mage** | 46.8 | 50 | 1% | 36757 | 783 | 0 | ✅ Endgame |
| **Rogue** | 46.6 | 50 | 1% | 22774 | 614 | 1 | ✅ Endgame |
| **Druid** | 45.7 | 50 | 0% | 21626 | 607 | 0 | ✅ Endgame |
| **Archmage** | 45.4 | 50 | 0% | 35478 | 758 | 0 | ✅ Endgame |
| **Priest** | 45.3 | 50 | 0% | 24291 | 695 | 0 | ✅ Endgame |

**Summary:** All 11 classes endgame-viable (45+ avg depth). **37 Morgoth kills** (14 berserker, 11 warrior, 5 blackguard, 3 ranger, 3 paladin, 1 rogue). CB rates excellent across all classes (0-4%).

---

## Known Issues

### Caster CB Rate Regression @ `9bba82b`

Pure casters show elevated circuit breaker rates after artifact ability implementation:
- Archmage: 2% → 17% CB
- Necromancer: 3% → 14% CB
- Mage: 1% → 11% CB

**Likely unrelated to artifact changes** (slays/protections/regen should help, not hurt). May be coincidental with other unstaged changes or seed interaction. Needs investigation.

---

## Race Baseline (Phase 1)

> **Run:** `pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades`
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Race Baseline @ `4113ace` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

| Race | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-------|-------|---------|--------|
| **Kobold** | 49.3 | 50 | 2% | 14010 | 550 | 2 | ✅ Endgame |
| **Half-Troll** | 48.9 | 50 | 1% | 14142 | 525 | 12 | ✅ Endgame |
| **Dwarf** | 48.8 | 50 | 2% | 13755 | 534 | 5 | ✅ Endgame |
| **Dunadan** | 48.6 | 50 | 2% | 14739 | 520 | 8 | ✅ Endgame |
| **Human** | 48.5 | 50 | 1% | 14383 | 505 | 6 | ✅ Endgame |
| **High-Elf** | 48.3 | 50 | 2% | 13809 | 527 | 4 | ✅ Endgame |
| **Hobbit** | 48.0 | 50 | 1% | 13727 | 526 | 3 | ✅ Endgame |
| **Elf** | 48.0 | 50 | 0% | 14128 | 507 | 4 | ✅ Endgame |
| **Half-Orc** | 48.0 | 50 | 0% | 13942 | 514 | 5 | ✅ Endgame |
| **Gnome** | 47.8 | 50 | 3% | 13644 | 515 | 6 | ✅ Endgame |
| **Half-Elf** | 47.6 | 50 | 0% | 13963 | 503 | 4 | ✅ Endgame |

**Summary:** All 11 races endgame-viable (47.6-49.3 avg depth). **59 Morgoth kills** (12 half-troll, 8 dunadan, 6 human, 6 gnome, 5 dwarf, 5 half-orc, 4 high-elf, 4 elf, 4 half-elf, 3 hobbit, 2 kobold). CB rates 0-3%. Excellent race balance - spread of only 1.7 depth between best/worst.

**Observed Tiers:**
- **Top** (kobold, half-troll, dwarf, dunadan): 48.6-49.3 avg, slightly above human
- **Middle** (human, high-elf, hobbit, elf, half-orc): 48.0-48.5 avg, baseline
- **Bottom** (gnome, half-elf): 47.6-47.8 avg, slightly below but viable

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 47.6)
- ✅ No race exceeds human by >5 avg depth (max delta: +0.8)
- ✅ No race falls below human by >8 avg depth (max delta: -0.9)
- ✅ CB rates <5% (max: 3%)

---

## Capability Progression (Phase 2)

Tests bot performance at different unlock stages.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Capability Presets

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town | 15-20 |
| `mid` | town, farming, sweep_1, surf_1 | 25-35 |
| `late` | town, farming, preparedness, sweep_2, surf_2, kiting_1 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

### Progression Test Commands

```bash
# Test each progression stage
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=none --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=early --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=mid --turns=30000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=late --turns=40000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=full --turns=50000
```

### Capability Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 31.8 | 50 | 0% | baseline |
| `early` | town | 30.1 | 50 | 0% | -1.7 |
| `mid` | town, farming, sweep_1, surf_1 | 31.4 | 50 | 0% | -0.4 |
| `late` | +preparedness, sweep_2, surf_2, kiting_1 | 43.8 | 50 | 0% | +12.0 |
| `full` | (all maxed) | 43.7 | 50 | 2% | +11.9 |

**Observations:**
- Big jump happens at `late` tier (+12 depth from mid)
- Early/mid tiers don't differentiate well (town/farming/basic sweep+surf insufficient)
- Key capabilities: preparedness, surf_2, kiting_1 drive the major improvement
- Expected progression didn't materialize - late/full are the meaningful thresholds

**Success Criteria:** ⚠️ Partial
- ❌ Clear progression each tier (early/mid same as none)
- ✅ Late tier provides major boost (+12 depth)

### Surf Upgrade Refactor @ `298daa9`

Testing revealed surf upgrades (HP thresholds) had inverted value - surf_3 was WORSE than surf_2. Refactored to control tether radii instead.

**Before (HP thresholds):**
| Level | HP Threshold | Result |
|-------|--------------|--------|
| surf_2 | 40% | Optimal |
| surf_3 | 50% | **Worse** - too cautious |

**After (tether radii) @ `298daa9` (30 runs, 30k turns, seed=1000, class=warrior, caps=town,farming,preparedness,surf_X, upgrades=mid):**

| Level | Radii | Avg Depth | Delta from L0 |
|-------|-------|-----------|---------------|
| L0 (no surf) | [] | 30.1 | baseline |
| surf_1 | [2] (5×5) | 40.7 | +10.6 |
| surf_2 | [2, 4] (+9×9) | 41.9 | +11.8 |
| surf_3 | [2, 4, 10] (+21×21) | 44.2 | +14.1 |

**Result:** Linear progression restored. Each tier provides genuine value.

---

## Upgrade Progression (Phase 3)

Tests meta-upgrade impact on bot performance.

### Upgrade Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Morgoth |
|--------|----------|-----------|-----------|---------|-------|---------|
| `none` | No upgrades | 37.2 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 42.4 | 50 | 2% | +5.2 | 0 |
| `mid` | vit 5, mgt 5, res 3, swf 2, prc 2, cel 2 | 43.7 | 50 | 2% | +6.5 | 0 |
| `late` | vit 8, mgt 8, res 4, swf 4, prc 4, cel 4 | 45.9 | 50 | 0% | +8.7 | 1 |
| `full` | All maxed | 46.5 | 50 | 0% | +9.3 | 0 |

**Observations:**
- Clear progression: 37.2 → 42.4 → 43.7 → 45.9 → 46.5
- Early upgrades provide biggest single boost (+5.2 depth)
- Diminishing returns after early tier
- Morgoth kill only at late tier (1/50 runs)

**Success Criteria:** ✅ Passed
- ✅ Clear progression curve (each tier > previous)
- ✅ Upgrades compound well with capabilities

---

## Upgrade Sensitivity (Phase 4)

Measures per-upgrade impact on bot performance.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

> **Run:** `pnpm diagnose sensitivity --seed=1000 --class=warrior`

### Upgrade Impact @ `<commit>` (50 runs, 30k turns, seed=1000, class=warrior)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| *Run sensitivity to populate* | | | | |

**Interpretation:**
- 🔴 High impact (>10% loss): Critical upgrade, prioritize early
- 🟡 Medium impact (5-10%): Important but not blocking
- 🟢 Low impact (<5%): Nice-to-have, can defer

**Success Criteria:**
- No single upgrade > 15% impact (too dominant)
- Stat upgrades roughly equal impact across classes
- QoL upgrades < 5% impact (convenience, not power)

---

## Cross-Class Race Testing (Phase 5)

Tests race/class synergies across archetypes.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Cross-Class Race @ `<commit>` (50 runs, 50k turns, seed=1000, max-upgrades)

| Race | Warrior | Mage | Ranger | Notes |
|------|---------|------|--------|-------|
| human | (baseline) | (baseline) | (baseline) | Reference |
| *top race* | | | | |
| *bottom race* | | | | |

**Success Criteria:**
- No race/class combo > 10% better than human/same-class
- No race/class combo > 15% worse than human/same-class

---

## Personality Comparison (Phase 6 - Low Priority)

Tests personality impact across class archetypes.

```bash
pnpm diagnose compare --runs=50 --seed=1000 --class=CLASS --turns=50000
```

### Personality @ `<commit>` (50 runs, 50k turns, seed=1000)

| Personality | Warrior | Mage | Ranger | Notes |
|-------------|---------|------|--------|-------|
| cautious | (baseline) | (baseline) | (baseline) | Reference |
| aggressive | | | | Higher variance expected |
| greedy | | | | More gold, lower depth |
| speedrunner | | | | Faster, lower depth |

**Success Criteria:**
- All personalities viable (reach depth 35+)
- No personality strictly dominates cautious

---

## Standard Test Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `--turns` | 50,000 | Catches caster CB issues that emerge at higher turn counts |
| `--runs` | 100 | Statistical significance, ~2-3 min per class |
| `--seed` | 1000 | Reproducibility baseline |
| `--upgrades` | full | Consistent meta-progression state (or use `--max-upgrades`) |
| `--boosters` | class | Class-optimized booster loadout |

**Standard command:**
```bash
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000 > /tmp/[name].txt 2>&1
```

**Full baseline (all 11 classes):**
```bash
pnpm diagnose baseline --seed=1000 --turns=50000 --max-upgrades  # ~16 min
```

**Parallel execution:** Run only 2 batch commands simultaneously (8 threads each = 16 total).

---

## Diagnostic Tooling

```bash
# Quick single run
pnpm diagnose quick --seed=12345 --class=warrior

# Deep dive with turn log
pnpm diagnose deep --seed=12345 --class=warrior --map

# Standard batch test
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=50000 > /tmp/[name].txt 2>&1

# Find problematic seeds
pnpm diagnose find --runs=100 --seed=1000 --class=mage --turns=50000 > /tmp/[name].txt 2>&1

# Full baseline across all 11 classes (100 runs, 50k turns, max-upgrades)
# ~16 min runtime
pnpm diagnose baseline --seed=1000 --turns=50000 --max-upgrades > /tmp/[name].txt 2>&1

# Race baseline across all 11 races (~16 min)
pnpm diagnose baseline-races --seed=1000 --turns=50000 --max-upgrades > /tmp/[name].txt 2>&1

# Upgrade sensitivity test (~10 min)
pnpm diagnose sensitivity --seed=1000 --class=warrior > /tmp/[name].txt 2>&1

# Test with capability preset
pnpm diagnose batch --runs=50 --seed=1000 --capabilities=mid --class=warrior
```

### Balance Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--max-upgrades` | off | Apply all upgrades at max (includes 25% bestiary) |
| `--turns=N` | 20000 | Max turns per run |
| `--monster-hp=N` | 100 | Monster HP % |
| `--monster-damage=N` | 100 | Monster damage % |
| `--bestiary=N` | 0 | Fixed bestiary bonus % (0=use kills) |
| `--start-potions=N` | 3 | Starting healing potions |
| `--potion-rate=N` | 100 | Potion spawn rate % |
| `--regen=N` | 0 | HP regen per 10 turns (OOC) |
| `--armor-pen=N` | 0 | Flat armor penetration |
| `--enchant-rate=N` | 100 | Enchantment chance % |
| `--item-rate=N` | 100 | Items per level % |
| `--xp-rate=N` | 100 | XP gain % |

### Upgrade & Booster Presets

| Flag | Default | Options | Description |
|------|---------|---------|-------------|
| `--upgrades=X` | full | none, early, mid, late, full | Meta-progression upgrade level |
| `--boosters=X` | class | none, class, IDs | Per-run booster loadout |

**Upgrade Presets:**
| Preset | Upgrades |
|--------|----------|
| `none` | No upgrades |
| `early` | vitality 2, might 2, resilience 1 |
| `mid` | vitality 5, might 5, resilience 3, swiftness 2, precision 2, celerity 2 |
| `late` | vitality 8, might 8, resilience 4, swiftness 4, precision 4, celerity 4 |
| `full` | All upgrades at max level |

**Booster Presets:**
| Preset | Description |
|--------|-------------|
| `none` | No boosters |
| `class` | Primary stat (superior) + CON (superior) based on class |
| `str_superior,con_superior` | Custom comma-separated booster IDs |

**Class Booster Defaults (--boosters=class):**
- STR classes (warrior, berserker, blackguard): `str_superior + con_superior`
- INT classes (mage, archmage, necromancer, bard): `int_superior + con_superior`
- WIS classes (priest, paladin, druid): `wis_superior + con_superior`
- DEX classes (rogue, ranger, monk): `dex_superior + con_superior`

---

## Test Matrix Template

```bash
# Baseline (seeded for reproducibility)
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000  > /tmp/[name].txt 2>&1

# With change (same seed for A/B comparison)
pnpm diagnose batch --runs=100 --seed=1000 --class=CLASS --max-upgrades --turns=50000 [flags]  > /tmp/[name].txt 2>&1

# Verify no regression on warrior
pnpm diagnose batch --runs=100 --seed=1000 --class=warrior --max-upgrades --turns=50000 [flags]  > /tmp/[name].txt 2>&1
```

**Success criteria:**
- Target class improves by 1+ avg depth
- No regression on other classes
- Circuit breaker rate doesn't increase significantly

---

## References

- `docs/BALANCE-PASS-1.md` - Monster spawn rate tuning
- `docs/BALANCE-PASS-2.md` - Multi-attack, deadliness, combat formulas
- `docs/BALANCE-PASS-3.md` - Pure caster fixes (vision, stair-surf, phase door)
- `docs/BALANCE-PASS-4.md` - Goal oscillation, caution threshold, vault fixes, TP scroll fixes
