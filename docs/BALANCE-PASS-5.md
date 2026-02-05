# Balance Pass 5 — Historical Baselines & Archived Test Data

Archived from `docs/BALANCE-TEST-PLAN.md` to reduce file size. Data here is for reference only.

---

## Historical Full Baselines

### Full Baseline @ `d56d88f` (100 runs, 50k turns, seed=1000, max-upgrades)

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 49.4 | 50 | 0% | 22068 | 646 | 8 | ✅ Endgame |
| **Blackguard** | 49.0 | 50 | 0% | 15228 | 562 | 1 | ✅ Endgame |
| **Paladin** | 48.9 | 50 | 0% | 22046 | 676 | 3 | ✅ Endgame |
| **Berserker** | 48.5 | 50 | 0% | 14564 | 508 | 9 | ✅ Endgame |
| **Archmage** | 48.2 | 50 | 2% | 26589 | 650 | 2 | ✅ Endgame |
| **Mage** | 48.1 | 50 | 0% | 26968 | 650 | 1 | ✅ Endgame |
| **Warrior** | 48.0 | 50 | 0% | 15643 | 525 | 4 | ✅ Endgame |
| **Necromancer** | 47.8 | 50 | 0% | 23519 | 662 | 0 | ✅ Endgame |
| **Rogue** | 47.1 | 50 | 0% | 22500 | 614 | 1 | ✅ Endgame |
| **Priest** | 46.0 | 50 | 0% | 23827 | 723 | 3 | ✅ Endgame |
| **Druid** | 45.9 | 50 | 0% | 22106 | 585 | 0 | ✅ Endgame |

**Summary:** Town capability decomposition and feed system update. **32 Morgoth kills**. All CB rates ≤2%.

### Raw Baseline @ `d56d88f` (100 runs, 50k turns, seed=1000, no-upgrades, no-capabilities, no-boosters)

⚠️ **Invalid:** `diagnose baseline` wasn't passing `--capabilities` through — capabilities were always `full`.

| Class | Avg Depth | Max Depth | CB Rate | Avg Turns | Kills | Morgoth | Status |
|-------|-----------|-----------|---------|-----------|-------|---------|--------|
| **Ranger** | 48.5 | 50 | 0% | 25537 | 723 | 2 | ✅ Endgame |
| **Necromancer** | 44.6 | 50 | 0% | 42923 | 943 | 0 | ✅ Endgame |
| **Archmage** | 41.2 | 50 | 0% | 41222 | 857 | 0 | ✅ Endgame |
| **Mage** | 41.2 | 50 | 0% | 41193 | 857 | 0 | ✅ Endgame |
| **Rogue** | 37.4 | 50 | 0% | 21750 | 555 | 0 | ⚠️ Mid-game |
| **Paladin** | 34.2 | 50 | 0% | 20368 | 539 | 0 | ⚠️ Mid-game |
| **Priest** | 32.1 | 50 | 0% | 21197 | 544 | 0 | ⚠️ Mid-game |
| **Berserker** | 27.6 | 50 | 0% | 10521 | 296 | 0 | ⚠️ Early-game |
| **Druid** | 27.0 | 50 | 0% | 19751 | 418 | 0 | ⚠️ Early-game |
| **Warrior** | 25.9 | 50 | 0% | 10085 | 273 | 0 | ⚠️ Early-game |
| **Blackguard** | 22.6 | 50 | 0% | 8256 | 236 | 0 | ⚠️ Early-game |

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

**Summary:** Melee class balance pass. Reduced max attacks: Berserker 7→5, Warrior 6→4, Paladin 5→4. Reduced Berserker STR +4→+3. **30 Morgoth kills**. Win rate spread now 0-7% (was 0-23%). All CB rates ≤1%.

### Full Baseline @ `41de49e` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Fixed Morgoth hunt sweep and D50 circuit breaker exemption. **67 Morgoth kills**. All CB rates ≤1%.

### Full Baseline @ `95ece86` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Added Rogue Shadow Step + Sneak Attack. **63 Morgoth kills**. All CB rates ≤3%.

### Full Baseline @ `e48b77c` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Added goal-based MP pot usage and debuff duration check. **41 Morgoth kills**. All CB rates ≤2%.

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

**Summary:** Fixed caster CB bugs: sweep timeout reset loop, town shopping bypass. **40 Morgoth kills**. Mage CB 14%→2%, Archmage 13%→1%, Necromancer 9%→0%.

### Full Baseline @ `12fa009` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Fixed KILL goal persistence bug. CB rates: Necro 21%→16%, Archmage 19%→16%, Mage 6%→8%.

### Full Baseline @ `3672f59` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Caster CB rates worsened (Necro 21%, Archmage 19%, Mage 6%). **13 Morgoth kills**.

### Full Baseline @ `4113ace` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Balance Testing Plan baseline. Caster CB rates persist. **13 Morgoth kills**.

### Full Baseline @ `9bba82b` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Post artifact abilities. Caster CB rates regressed. **13 Morgoth kills**. Implemented slays, status protections, Free Action, equipment Regeneration.

### Full Baseline @ `b6ccc40` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Post gold economy rebalance. **21 Morgoth kills**. CB rates 0-3%.

### Full Baseline @ `54a9e7a` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** Post upgrade rebalance. **36 Morgoth kills**. CB rates 0-1%. Nerfed Swiftness (25%→10% dodge), buffed Resilience (5→10 armor).

### Full Baseline @ `9b151af` (100 runs, 50k turns, seed=1000, max-upgrades)

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

**Summary:** All 11 classes 45+ avg depth. **37 Morgoth kills**. CB rates 0-4%.

---

## Resolved Known Issues

### Caster CB Rate Regression @ `9bba82b`

Pure casters showed elevated circuit breaker rates after artifact ability implementation:
- Archmage: 2% → 17% CB
- Necromancer: 3% → 14% CB
- Mage: 1% → 11% CB

**Resolved:** Fixed in `e2e8144` (sweep timeout reset loop, town shopping bypass). All CB rates ≤2% as of `e2e8144`.

---

## Historical Race Baselines

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

**Summary:** **59 Morgoth kills**. CB rates 0-3%.

---

## Historical Capability Progression

### Capability Progression @ `b4c83bc` (50 runs, seed=1000, class=warrior, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Delta |
|--------|-----------|-----------|---------|-------|
| `none` | 30.6 | 50 | 0% | baseline |
| `early` | 37.1 | 50 | 0% | +6.5 |
| `mid` | 41.9 | 50 | 0% | +11.3 |
| `late` | 43.2 | 50 | 0% | +12.6 |
| `full` | 44.5 | 50 | 0% | +13.9 |

**Summary:** Smooth progression with old preparedness toggle.

### Capability Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, upgrades=mid)

| Preset | Avg Depth | Max Depth | CB Rate | Delta |
|--------|-----------|-----------|---------|-------|
| `none` | 31.8 | 50 | 0% | baseline |
| `early` | 30.1 | 50 | 0% | -1.7 |
| `mid` | 31.4 | 50 | 0% | -0.4 |
| `late` | 43.8 | 50 | 0% | +12.0 |
| `full` | 43.7 | 50 | 2% | +11.9 |

**Summary:** Early/mid tiers were broken (worse than none). Big jump only at late tier.

### Surf Upgrade Refactor @ `298daa9`

Testing revealed surf upgrades (HP thresholds) had inverted value — surf_3 was WORSE than surf_2. Refactored to control tether radii instead.

**After (tether radii):**

| Level | Radii | Avg Depth | Delta from L0 |
|-------|-------|-----------|---------------|
| L0 (no surf) | [] | 30.1 | baseline |
| surf_1 | [2] (5x5) | 40.7 | +10.6 |
| surf_2 | [2, 4] (+9x9) | 41.9 | +11.8 |
| surf_3 | [2, 4, 10] (+21x21) | 44.2 | +14.1 |

---

## Historical Upgrade Progression

### Upgrade Progression @ `4113ace` (50 runs, 40k turns, seed=1000, class=warrior, capabilities=full)

| Preset | Upgrades | Avg Depth | Max Depth | CB Rate | Delta | Morgoth |
|--------|----------|-----------|-----------|---------|-------|---------|
| `none` | No upgrades | 37.2 | 50 | 0% | baseline | 0 |
| `early` | vitality 2, might 2, resilience 1 | 42.4 | 50 | 2% | +5.2 | 0 |
| `mid` | vit 5, mgt 5, res 3, swf 2, prc 2, cel 2 | 43.7 | 50 | 2% | +6.5 | 0 |
| `late` | vit 8, mgt 8, res 4, swf 4, prc 4, cel 4 | 45.9 | 50 | 0% | +8.7 | 1 |
| `full` | All maxed | 46.5 | 50 | 0% | +9.3 | 0 |

**Summary:** Early upgrades provided biggest boost (+5.2). Clear diminishing returns.
