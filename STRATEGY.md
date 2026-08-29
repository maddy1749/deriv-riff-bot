# Riff Bot Trading Strategy

## Overview

The Riff Bot uses **digit frequency analysis** on Deriv's volatility indices to generate trading signals for **Digit Matches** and **Digit Differs** contracts.

## Core Concept

### Digit Extraction

Each price quote has a last digit (0–9). For example:
- Price: `12345.67` → Last digit: `7`
- Price: `1000.50` → Last digit: `0`

The bot collects the last digits from historical ticks and analyzes their distribution.

### Frequency Analysis

Over a rolling window (default: 500 ticks), the bot counts how many times each digit appears:

```
Digit 0: ███████ (67 times)   13.4%
Digit 1: ████████ (72 times)  14.4%
Digit 2: ██████ (58 times)    11.6%
Digit 3: ████ (45 times)      9.0%
Digit 4: ██████████ (98 times) 19.6% ← Most frequent
Digit 5: ██ (32 times)        6.4%
Digit 6: ████ (43 times)      8.6%
Digit 7: █ (22 times)         4.4%  ← Least frequent
Digit 8: ████ (45 times)      9.0%
Digit 9: ████ (43 times)      8.6%
```

## Trading Modes

### Mode 1: DIGITMATCH (Most Frequent)

**Hypothesis**: The most frequently occurring digit is "hot" and will repeat.

**Entry Signal**:
- Find the digit with highest count
- Check if its frequency ≥ threshold (default: 15%)
- If yes, place a **DIGITMATCH** contract betting this digit will appear on the next tick

**Example**:
- Digit 4 appears 98/500 times (19.6%)
- Threshold is 15%
- 19.6% ≥ 15% ✓
- **Trade Signal**: MATCH on digit 4

### Mode 2: DIGITDIFF (Least Frequent)

**Hypothesis**: The least frequently occurring digit is "cold" and due to revert.

**Entry Signal**:
- Find the digit with lowest count
- Check if its frequency ≤ threshold (default: 15%)
- If yes, place a **DIGITDIFF** contract betting this digit will NOT appear on the next tick

**Example**:
- Digit 7 appears 22/500 times (4.4%)
- Threshold is 15%
- 4.4% ≤ 15% ✓
- **Trade Signal**: DIFFER on digit 7 (predicting 0,1,2,3,4,5,6,8,9 will appear instead)

## Decision Flowchart

```
┌─────────────────────────────┐
│  New tick received          │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Extract last digit          │
│ Update digit history        │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Count frequency 0-9         │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│ Is bot running?             │──NO──> Wait for next tick
└──────────┬──────────────────┘
           │ YES
           ▼
┌─────────────────────────────┐
│ Is contract already open?   │──YES─> Wait for settlement
└──────────┬──────────────────┘
           │ NO
           ▼
┌─────────────────────────────┐
│ Mode = DIGITMATCH or DIFFER?│
└──────────┬──────────────────┘
           │
      ┌────┴────┐
      │          │
    MATCH      DIFFER
      │          │
      ▼          ▼
┌──────────┐  ┌──────────────┐
│Max freq? │  │Min freq?     │
│≥ thresh? │  │≤ thresh?     │
└────┬─────┘  └───────┬──────┘
     │                │
    YES              YES
     │                │
     ▼                ▼
┌──────────────────────────────┐
│ Request proposal for digit   │
│ Auto-buy at market price     │
│ Wait for contract settlement │
└──────────────────────────────┘
     │
     └──> Record win/loss
          Update P/L
          Check risk limits
```

## Risk Management Features

### 1. Maximum Loss Limit

- **Setting**: `Max Loss` (default: $6.00)
- **Logic**: If cumulative P/L ≤ -$6.00, bot stops automatically
- **Purpose**: Prevents catastrophic loss accumulation

### 2. Maximum Trades Limit

- **Setting**: `Max Trades` (default: 20)
- **Logic**: After N trades, bot stops regardless of P/L
- **Purpose**: Controls session exposure and reduces overtrading

### 3. Stake Size & Duration

- **Setting**: `Stake` (default: $0.35)
- **Duration**: How long contract runs (in ticks, default: 1)
- **Purpose**: Controls position size and payout structure

### 4. Trade Delay

- **Setting**: `Delay` (default: 500ms)
- **Purpose**: Prevents rapid-fire trades; gives market time to settle

## Why This Strategy?

### Statistical Basis

The assumption is that **recent digit frequencies reflect market behavior**. If a digit has been rare, it may be "due" to occur. If a digit has been common, it may continue.

**Reality Check**:
- ✓ Frequency analysis is mathematically sound
- ✓ Works better on volatile/synthetic indices than on forex
- ✗ **Does NOT guarantee profit** — each tick is independently distributed
- ✗ Historical frequency is no guarantee of future outcomes

### When It Works

- **High volatility**: More price movement = clearer frequency patterns
- **Synthetic indices**: Less correlation with world events; more random
- **Short-term trades**: Ticks are fast; statistical patterns emerge quickly

### When It Fails

- **Low frequency**: Very few trades with the same digit appear randomly
- **Market shifts**: Sudden trend changes invalidate historical frequency
- **Slippage**: Difference between quote and execution price

## Adjusting Parameters

| Parameter | Effect | Recommendation |
|-----------|--------|-----------------|
| **Threshold** ↑ | Fewer trades, higher win rate | Start at 0.15; increase for conservative approach |
| **Threshold** ↓ | More trades, lower win rate | Decrease to 0.10 for aggressive approach |
| **Ticks** ↑ | Longer history, smoother trends | 1000+ ticks for stable analysis |
| **Ticks** ↓ | Shorter memory, faster adaptation | 100–200 for quick trend-following |
| **Stake** ↑ | Higher reward/risk per trade | Increase only if P/L is positive |
| **Stake** ↓ | Lower risk; smaller wins | Decrease for testing or high drawdown |
| **Max Loss** ↓ | Stop sooner when losing | Useful for risk-averse trading |
| **Duration** ↑ | Longer wait for contract | 5–10 ticks for trends; 1–2 for mean reversion |

## Example Session

```
Time    Quote    Last Digit    Frequency (4)    Signal         Action       P/L
10:00   12000.4  4             4/50 (8%)        —               —            $0.00
10:01   12001.7  7             4/50 (8%)        —               —            $0.00
10:02   12002.2  2             4/50 (8%)        —               —            $0.00
...
10:30   12045.4  4             48/50 (96%)      MATCH 4 ≥ 15% ✓ BUY          $0.00
10:31   12046.4  4             ⬆ Frequency     WIN! Last digit ✓ +$0.35      $0.35
10:32   12047.1  1             49/51 (96%)      MATCH 4 ≥ 15% ✓ BUY          $0.35
10:33   12048.8  8             ⬇ Frequency     LOSS! Expected 4  -$0.35      $0.00
10:34   12049.3  3             48/52 (92%)      MATCH 4 ≥ 15% ✓ BUY          $0.00
10:35   12050.4  4             ⬆ Frequency     WIN! Last digit ✓ +$0.35      $0.35
```

## Important Notes

🚨 **This is a statistical strategy, not a guaranteed system.**

- Digit frequencies are random in nature
- No trading strategy works 100% of the time
- Always use risk management (stop losses, position sizing)
- Demo trade first before going live
- Never trade with money you cannot afford to lose

---

**Happy trading! Remember: frequency analysis is a tool, not a crystal ball.** 🎲
