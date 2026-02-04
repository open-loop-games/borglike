# Balance Test Plan

## Current State (2026-02-03)

> **Note:** Update commit hash with `git rev-parse --short HEAD` after each baseline run.

### Full Baseline @ `b4c83bc` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.6 | 50 | 0% | 21799 | 651 | 7 | ✅ Endgame |
| **Blackguard** | 48.9 | 50 | 0% | 15532 | 558 | 1 | ✅ Endgame |
| **Mage** | 48.7 | 50 | 1% | 26725 | 665 | 1 | ✅ Endgame |
| **Paladin** | 48.7 | 50 | 0% | 21988 | 668 | 2 | ✅ Endgame |
| **Archmage** | 48.3 | 50 | 1% | 26771 | 647 | 3 | ✅ Endgame |
| **Berserker** | 48.2 | 50 | 0% | 14668 | 508 | 6 | ✅ Endgame |
| **Warrior** | 48.1 | 50 | 0% | 16176 | 522 | 3 | ✅ Endgame |
| **Necromancer** | 47.7 | 50 | 0% | 23470 | 662 | 0 | ✅ Endgame |
| **Rogue** | 47.5 | 50 | 0% | 22856 | 621 | 3 | ✅ Endgame |
| **Priest** | 46.7 | 50 | 0% | 24396 | 719 | 4 | ✅ Endgame |
| **Druid** | 46.5 | 50 | 0% | 22610 | 595 | 0 | ✅ Endgame |

**Summary:** Melee class balance pass. Reduced max attacks: Berserker 7→5, Warrior 6→4, Paladin 5→4. Reduced Berserker STR +4→+3. **30 Morgoth kills** (7 ranger, 6 berserker, 4 priest, 3 warrior, 3 rogue, 3 archmage, 2 paladin, 1 mage, 1 blackguard). Win rate spread now 0-7% (was 0-23%). All CB rates ≤1%.

### Previous Baseline @ `41de49e` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.6 | 50 | 0% | 21799 | 651 | 7 | ✅ Endgame |
| **Berserker** | 49.4 | 50 | 0% | 14701 | 530 | 23 | ✅ Endgame |
| **Warrior** | 49.4 | 50 | 0% | 16214 | 548 | 13 | ✅ Endgame |
| **Paladin** | 48.9 | 50 | 0% | 21985 | 675 | 12 | ✅ Endgame |
| **Blackguard** | 48.9 | 50 | 0% | 15532 | 558 | 1 | ✅ Endgame |
| **Mage** | 48.7 | 50 | 1% | 26725 | 665 | 1 | ✅ Endgame |
| **Archmage** | 48.3 | 50 | 1% | 26771 | 647 | 3 | ✅ Endgame |
| **Necromancer** | 47.7 | 50 | 0% | 23470 | 662 | 0 | ✅ Endgame |
| **Rogue** | 47.5 | 50 | 0% | 22856 | 621 | 3 | ✅ Endgame |
| **Priest** | 46.7 | 50 | 0% | 24396 | 719 | 4 | ✅ Endgame |
| **Druid** | 46.5 | 50 | 0% | 22610 | 595 | 0 | ✅ Endgame |

**Summary:** All classes healthy. Fixed Morgoth hunt sweep and D50 circuit breaker exemption. **67 Morgoth kills** (23 berserker, 13 warrior, 12 paladin, 7 ranger, 4 priest, 3 rogue, 3 archmage, 1 mage, 1 blackguard). Berserker 20→23, Warrior 8→13, Paladin 10→12. Ranger CB 2%→0%, Mage CB 3%→1%. All CB rates ≤1%.

### Previous Baseline @ `95ece86` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.6 | 50 | 2% | 22093 | 650 | 8 | ✅ Endgame |
| **Berserker** | 49.4 | 50 | 0% | 14710 | 530 | 20 | ✅ Endgame |
| **Warrior** | 49.4 | 50 | 0% | 16774 | 548 | 8 | ✅ Endgame |
| **Paladin** | 48.9 | 50 | 0% | 22035 | 675 | 10 | ✅ Endgame |
| **Blackguard** | 48.9 | 50 | 0% | 15372 | 558 | 2 | ✅ Endgame |
| **Mage** | 48.1 | 50 | 3% | 27231 | 655 | 3 | ✅ Endgame |
| **Archmage** | 48.0 | 50 | 0% | 26244 | 642 | 2 | ✅ Endgame |
| **Necromancer** | 47.6 | 50 | 0% | 23453 | 660 | 1 | ✅ Endgame |
| **Rogue** | 47.5 | 50 | 0% | 22289 | 619 | 4 | ✅ Endgame |
| **Priest** | 46.7 | 50 | 0% | 24352 | 719 | 4 | ✅ Endgame |
| **Druid** | 46.5 | 50 | 0% | 22817 | 596 | 1 | ✅ Endgame |

**Summary:** All classes healthy. Added Rogue Shadow Step + Sneak Attack (2.5x damage after teleport). **63 Morgoth kills** (20 berserker, 10 paladin, 8 warrior, 8 ranger, 4 rogue, 4 priest, 3 mage, 2 blackguard, 2 archmage, 1 necromancer, 1 druid). Rogue 0→4 kills, Paladin 3→10, Priest 0→4, Druid 0→1. Total +34% from 47→63. All CB rates ≤3%.

### Previous Baseline @ `bdd0fe4` (100 runs, 50k turns, seed=1000, max-upgrades)

### Previous Baseline @ `e48b77c` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.6 | 50 | 2% | 22093 | 650 | 8 | ✅ Endgame |
| **Berserker** | 49.4 | 50 | 0% | 14710 | 530 | 20 | ✅ Endgame |
| **Warrior** | 49.4 | 50 | 0% | 16774 | 548 | 8 | ✅ Endgame |
| **Paladin** | 49.0 | 50 | 0% | 21880 | 665 | 3 | ✅ Endgame |
| **Blackguard** | 48.9 | 50 | 0% | 15372 | 558 | 2 | ✅ Endgame |
| **Rogue** | 48.0 | 50 | 0% | 22278 | 626 | 0 | ✅ Endgame |
| **Necromancer** | 47.2 | 50 | 0% | 22541 | 637 | 0 | ✅ Endgame |
| **Druid** | 47.0 | 50 | 0% | 21315 | 616 | 0 | ✅ Endgame |
| **Priest** | 46.5 | 50 | 0% | 24104 | 726 | 0 | ✅ Endgame |
| **Mage** | 46.4 | 50 | 0% | 25317 | 601 | 0 | ✅ Endgame |
| **Archmage** | 45.8 | 50 | 1% | 25451 | 588 | 0 | ✅ Endgame |

**Summary:** All classes healthy. Added goal-based MP pot usage (KITE/FLEE only) and debuff duration check (MIN_SLOW_DURATION=4). **41 Morgoth kills** (20 berserker, 8 warrior, 8 ranger, 3 paladin, 2 blackguard). All CB rates ≤2%. Pure casters still at 0 Morgoth kills.

### Previous Baseline @ `e2e8144` (100 runs, 50k turns, seed=1000, max-upgrades)

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

### Race Baseline @ `b4c83bc` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

| Race | Avg Depth | Max Depth | CB Rate | Turns | Kills | Morgoth | Status |
|------|-----------|-----------|---------|-------|-------|---------|--------|
| **Half-Troll** | 49.2 | 50 | 0% | 15627 | 558 | 7 | ✅ Endgame |
| **Kobold** | 49.1 | 50 | 0% | 15470 | 568 | 4 | ✅ Endgame |
| **Dwarf** | 48.4 | 50 | 0% | 16013 | 552 | 11 | ✅ Endgame |
| **High-Elf** | 48.4 | 50 | 0% | 15564 | 553 | 3 | ✅ Endgame |
| **Half-Orc** | 48.3 | 50 | 0% | 16647 | 543 | 7 | ✅ Endgame |
| **Gnome** | 48.1 | 50 | 0% | 15073 | 547 | 5 | ✅ Endgame |
| **Human** | 48.1 | 50 | 0% | 16176 | 522 | 3 | ✅ Endgame |
| **Dunadan** | 47.9 | 50 | 0% | 15769 | 529 | 4 | ✅ Endgame |
| **Elf** | 47.9 | 50 | 0% | 15572 | 536 | 2 | ✅ Endgame |
| **Hobbit** | 47.7 | 50 | 0% | 15322 | 540 | 4 | ✅ Endgame |
| **Half-Elf** | 47.6 | 50 | 0% | 15303 | 533 | 4 | ✅ Endgame |

**Summary:** All 11 races endgame-viable (47.6-49.2 avg depth). **54 Morgoth kills** (11 dwarf, 7 half-troll, 7 half-orc, 5 gnome, 4 kobold, 4 dunadan, 4 hobbit, 4 half-elf, 3 human, 3 high-elf, 2 elf). **All CB rates 0%** - perfect stability after melee balance pass. Spread of 1.6 depth between best/worst.

**Observed Tiers:**
- **Top** (half-troll, kobold): 49.1-49.2 avg, +1 above human
- **Middle** (dwarf, high-elf, half-orc, gnome, human): 48.1-48.4 avg, baseline cluster
- **Bottom** (dunadan, elf, hobbit, half-elf): 47.6-47.9 avg, slightly below but viable

**Success Criteria:** ✅ All passed
- ✅ All races reach depth 40+ average (lowest: 47.6)
- ✅ No race exceeds human by >5 avg depth (max delta: +1.1)
- ✅ No race falls below human by >8 avg depth (max delta: -0.5)
- ✅ CB rates <5% (all 0%)

### Previous Race Baseline @ `4113ace` (100 runs, 50k turns, seed=1000, class=warrior, max-upgrades)

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

**Summary:** All 11 races endgame-viable (47.6-49.3 avg depth). **59 Morgoth kills** (12 half-troll, 8 dunadan, 6 human, 6 gnome, 5 dwarf, 5 half-orc, 4 high-elf, 4 elf, 4 half-elf, 3 hobbit, 2 kobold). CB rates 0-3%.

---

## Capability Progression (Phase 2)

Tests bot performance at different unlock stages.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Capability Presets

| Preset | Capabilities | Expected Depth |
|--------|--------------|----------------|
| `none` | (all disabled) | 5-10 (face-rush) |
| `early` | town, farming, preparedness, targeting_1, retreat_1 | 15-20 |
| `mid` | town, farming, preparedness, sweep_1, surf_1, targeting_2, retreat_2 | 25-35 |
| `late` | town, farming, preparedness, sweep_2, surf_2, kiting_1, targeting_3, retreat_3 | 40-45 |
| `full` | (all maxed) | 45+ (endgame) |

**Targeting Levels:**
- L0: Attack closest monster only (no scoring)
- L1: + Low HP bonus, can-win bonus (prioritize wounded)
- L2: + Awake bonus, threat penalty, distance penalty (threat-aware)
- L3: + Class-aware optimal range (class mastery)

**Retreat Levels:**
- L0: Panic at 25% HP only (no status awareness)
- L1: + Personality caution threshold
- L2: + Status effect detection (paralyzed, poison, confused)
- L3: + Outnumbered, combat advantage, local danger, class mods

### Progression Test Commands

```bash
# Test each progression stage
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=none --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=early --turns=20000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=mid --turns=30000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=late --turns=40000
pnpm diagnose batch --runs=50 --seed=1000 --class=warrior --max-upgrades --capabilities=full --turns=50000
```

### Capability Progression @ `b4c83bc` (50 runs, seed=1000, class=warrior, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 30.6 | 50 | 0% | baseline |
| `early` | town, farming, preparedness | 37.1 | 50 | 0% | +6.5 |
| `mid` | +sweep_1, surf_1 | 41.9 | 50 | 0% | +11.3 |
| `late` | +sweep_2, surf_2, kiting_1 | 43.2 | 50 | 0% | +12.6 |
| `full` | (all maxed) | 44.5 | 50 | 0% | +13.9 |

**Observations:**
- Smooth linear progression: 30.6 → 37.1 → 41.9 → 43.2 → 44.5
- Each tier provides meaningful improvement
- Early tier now works (+6.5 depth vs -1.7 previously)
- Bot far exceeds expected depths at all tiers (preparedness in early helps)

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression each tier (each tier > previous by 1+ depth)
- ❌ Expected depth ranges not matched (all tiers ~20 depth above expected)
- Note: Expected depths were set before preparedness added to early/mid

### Previous Capability Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, upgrades=mid)

| Preset | Capabilities | Avg Depth | Max Depth | CB Rate | Delta |
|--------|--------------|-----------|-----------|---------|-------|
| `none` | (all disabled) | 31.8 | 50 | 0% | baseline |
| `early` | town | 30.1 | 50 | 0% | -1.7 |
| `mid` | town, farming, sweep_1, surf_1 | 31.4 | 50 | 0% | -0.4 |
| `late` | +preparedness, sweep_2, surf_2, kiting_1 | 43.8 | 50 | 0% | +12.0 |
| `full` | (all maxed) | 43.7 | 50 | 2% | +11.9 |

**Summary:** Early/mid tiers were broken (worse than none). Big jump only at late tier.

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

### Upgrade Progression @ `b4c83bc` (50 runs, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Victories |
|--------|----------|-----------|-----------|---------|-------|-----------|
| `none` | No upgrades | 42.6 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 44.9 | 50 | 0% | +2.3 | 0 |
| `mid` | vit 5, mgt 5, res 3, swf 2, prc 2, cel 2 | 44.5 | 50 | 0% | +1.9 | 1 |
| `late` | vit 8, mgt 8, res 4, swf 4, prc 4, cel 4 | 45.6 | 50 | 0% | +3.0 | 2 |
| `full` | All maxed | 45.3 | 50 | 0% | +2.7 | 1 |

**Observations:**
- Base game much stronger: 42.6 without upgrades (was 37.2)
- Progression curve flatter: +2.7 total spread (was +9.3)
- Upgrades still help but less dramatically
- Some noise in mid/full tiers (within margin of error)

**Success Criteria:** ✅ Passed
- ✅ Upgrades provide improvement at all tiers
- ✅ Bot viable even without upgrades (42.6 depth)

### Previous Upgrade Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Morgoth |
|--------|----------|-----------|-----------|---------|-------|---------|
| `none` | No upgrades | 37.2 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 42.4 | 50 | 2% | +5.2 | 0 |
| `mid` | vit 5, mgt 5, res 3, swf 2, prc 2, cel 2 | 43.7 | 50 | 2% | +6.5 | 0 |
| `late` | vit 8, mgt 8, res 4, swf 4, prc 4, cel 4 | 45.9 | 50 | 0% | +8.7 | 1 |
| `full` | All maxed | 46.5 | 50 | 0% | +9.3 | 0 |

**Summary:** Early upgrades provided biggest boost (+5.2). Clear diminishing returns.

### Paired Progression @ `b4c83bc` (50 runs, seed=1000)

Tests realistic player progression with matching capability and upgrade tiers.

**Warrior:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 23.1 | 174 | 0% | baseline |
| early/early | 35.1 | 327 | 0% | +12.0 |
| mid/mid | 41.9 | 466 | 0% | +6.8 |
| late/late | 45.8 | 533 | 0% | +3.9 |
| full/full | 45.3 | 479 | 0% | -0.5 |

**Mage:**

| Tier | Avg Depth | Kills | CB | Delta |
|------|-----------|-------|-----|-------|
| none/none | 14.1 | 73 | 6% | baseline |
| early/early | 24.9 | 196 | 0% | +10.8 |
| mid/mid | 43.8 | 820 | 0% | +18.9 |
| late/late | 48.1 | 784 | 0% | +4.3 |
| full/full | 47.9 | 648 | 0% | -0.2 |

**Cross-Class Comparison:**

| Tier | Warrior | Mage | Mage vs Warrior |
|------|---------|------|-----------------|
| none/none | 23.1 | 14.1 | -9.0 (mage struggles) |
| early/early | 35.1 | 24.9 | -10.2 (mage struggles) |
| mid/mid | 41.9 | 43.8 | +1.9 (mage catches up) |
| late/late | 45.8 | 48.1 | +2.3 (mage exceeds) |
| full/full | 45.3 | 47.9 | +2.6 (mage exceeds) |

**Cost Breakdown:**

| Component | none | early | mid | late | full |
|-----------|------|-------|-----|------|------|
| Capabilities | 0 | 600 | 950 | 1,830 | 4,464 |
| Upgrades | 0 | 412 | 3,309 | 11,997 | 25,421 |
| **Total** | 0 | 1,012 | 4,259 | 13,827 | 29,885 |

**Progression Economics (Warrior):**

| Transition | Depth Gain | Essence Cost | Runs at Current Tier |
|------------|------------|--------------|----------------------|
| none → early | +12.0 | 1,012 | ~2 runs |
| early → mid | +6.8 | 3,247 | ~2-3 runs |
| mid → late | +3.9 | 9,568 | ~4 runs |
| late → full | -0.5 | 16,058 | ~5-6 runs |

**Observations:**
- Warrior: Smooth progression, early tiers best value (+12 depth for ~2 runs)
- Mage: Struggles at none/early (14.1, 24.9 depth), needs mid tier to be viable
- Mage mid tier is critical: +18.9 depth jump (vitality 5 + sweep/surf kick in)
- Both classes: late → full provides no benefit (-0.5 warrior, -0.2 mage)
- Mage exceeds warrior at mid+ tiers once HP threshold is reached

**Success Criteria:** ⚠️ Partial
- ✅ Clear progression through late tier for both classes
- ✅ Reasonable time-to-tier (2-6 runs per tier)
- ⚠️ Mage early game harsh (6% CB at none, -10 depth vs warrior)
- ❌ Full tier provides no benefit over late for either class

---

## Upgrade Sensitivity (Phase 4)

Measures per-upgrade impact on bot performance.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

> **Run:** `pnpm diagnose sensitivity --seed=1000 --class=CLASS`

### Warrior Sensitivity @ `b4c83bc` (50 runs, 30k turns, seed=1000)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🟢 Vitality (+HP) | 48.5 | 47.3 | -1.3 | -2.6% |
| 🟢 Celerity (+Speed) | 48.5 | 47.4 | -1.1 | -2.3% |
| 🟢 Swiftness (+Dodge) | 48.5 | 47.8 | -0.7 | -1.5% |
| 🟢 Resilience (+Armor) | 48.5 | 48.1 | -0.4 | -0.8% |
| 🟢 Might (+Dmg%) | 48.5 | 48.6 | +0.0 | +0.0% |
| 🟢 Precision (+Acc) | 48.5 | 48.6 | +0.1 | +0.2% |

### Mage Sensitivity @ `b4c83bc` (50 runs, 30k turns, seed=1000)

| Upgrade | Baseline | Excluded | Delta | Impact |
|---------|----------|----------|-------|--------|
| 🔴 Vitality (+HP) | 49.0 | 38.4 | -10.6 | -21.6% |
| 🟢 Might (+Dmg%) | 49.0 | 48.0 | -1.1 | -2.2% |
| 🟢 Resilience (+Armor) | 49.0 | 48.0 | -1.0 | -2.1% |
| 🟢 Celerity (+Speed) | 49.0 | 48.1 | -1.0 | -2.0% |
| 🟢 Swiftness (+Dodge) | 49.0 | 48.6 | -0.4 | -0.9% |
| 🟢 Precision (+Acc) | 49.0 | 48.8 | -0.3 | -0.6% |

### Cross-Class Comparison

| Upgrade | Warrior | Mage | Notes |
|---------|---------|------|-------|
| **Vitality** | -2.6% | -21.6% | Critical for casters (low base HP) |
| Celerity | -2.3% | -2.0% | Consistent across classes |
| Might | +0.0% | -2.2% | Only helps casters |
| Resilience | -0.8% | -2.1% | Slightly more for casters |
| Swiftness | -1.5% | -0.9% | Consistent |
| Precision | +0.2% | -0.6% | Minimal impact |

**Summary:** Vitality is the most impactful upgrade, especially for casters (8x more critical for mage than warrior). Offensive upgrades (Might, Precision) provide minimal benefit for warrior but help mage. Game is balanced for max upgrades, so high single-upgrade impact is expected for progression feel.

**Interpretation:**
- 🔴 High impact (>10% loss): Critical upgrade, prioritize early
- 🟡 Medium impact (5-10%): Important but not blocking
- 🟢 Low impact (<5%): Nice-to-have, can defer

---

## Cross-Class Race Testing (Phase 5)

Tests race/class synergies across archetypes.
> **Guide:** See `docs/BALANCE-TESTING-GUIDE.md` for methodology

### Cross-Class Race @ `b4c83bc` (100 runs, 50k turns, seed=1000, max-upgrades)

| Race | Warrior | Mage | Ranger | Spread | Notes |
|------|---------|------|--------|--------|-------|
| **Half-Troll** | **49.2** | 45.5 | 49.5 | 3.7 | Best melee, worst caster |
| **Kobold** | 49.1 | 48.7 | **49.8** | 1.1 | Consistent top performer |
| **Dwarf** | 48.4 | 48.3 | 49.5 | 1.2 | Steady across all |
| **Hobbit** | 47.7 | 48.5 | **49.8** | 2.1 | DEX shines on ranger |
| **Gnome** | 48.1 | 48.2 | **49.8** | 1.7 | DEX shines on ranger |
| **Half-Orc** | 48.3 | 48.1 | 49.6 | 1.5 | Balanced |
| **Human** | 48.1 | 48.1 | 49.5 | 1.4 | True baseline |
| **Dunadan** | 47.9 | **48.8** | 48.9 | 1.0 | INT bonus helps caster |
| **High-Elf** | 48.4 | 47.3 | 49.7 | 2.4 | Best on ranger, weak mage |
| **Elf** | 47.9 | 46.7 | 49.6 | 2.9 | DEX class specialist |
| **Half-Elf** | 47.6 | 46.9 | 49.3 | 2.4 | DEX class specialist |

**Summary:** Race/class synergies working as intended. Half-troll shows largest swing (3.7 depth between warrior and mage) due to INT penalty. DEX races (hobbit, gnome, kobold) excel on ranger. Ranger has tightest spread (0.9 depth) acting as equalizer. All 33 race/class combos viable (45.5+ avg depth).

**Class Spread:**
- Warrior: 1.6 depth spread (49.2 to 47.6)
- Mage: 3.3 depth spread (48.8 to 45.5) - race matters most
- Ranger: 0.9 depth spread (49.8 to 48.9) - most forgiving

**Success Criteria:** ✅ All passed
- ✅ No race/class combo >10% better than human/same-class (max: +2.9% ranger/hobbit)
- ✅ No race/class combo >15% worse than human/same-class (max: -5.4% mage/half-troll)
- ✅ Synergies feel intentional (STR→melee, INT→caster, DEX→ranger)

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
