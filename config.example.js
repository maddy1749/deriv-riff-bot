/**
 * Bot Configuration Examples
 * Copy and modify for your use case
 */

// Conservative strategy (low risk, fewer trades)
const conservativeConfig = {
  mode: 'demo',
  symbol: 'R_25', // Less volatile
  contractType: 'DIGITMATCH',
  stake: 0.35,
  maxLoss: 3.50,
  maxTrades: 10,
  analysisWindow: 1000, // Longer history
  threshold: 0.20, // High threshold = fewer signals
  duration: 1
};

// Aggressive strategy (high risk, many trades)
const aggressiveConfig = {
  mode: 'demo',
  symbol: 'R_100', // Highly volatile
  contractType: 'DIGITDIFF',
  stake: 1.0, // Higher stake
  maxLoss: 15.0, // Higher loss tolerance
  maxTrades: 50, // More trades
  analysisWindow: 200, // Shorter history
  threshold: 0.10, // Low threshold = more signals
  duration: 1
};

// Balanced strategy (medium risk)
const balancedConfig = {
  mode: 'demo',
  symbol: 'R_100',
  contractType: 'DIGITDIFF',
  stake: 0.35,
  maxLoss: 6.0,
  maxTrades: 20,
  analysisWindow: 500,
  threshold: 0.15,
  duration: 1
};

// Scalping strategy (very short-term)
const scalpingConfig = {
  mode: 'demo',
  symbol: 'R_100',
  contractType: 'DIGITDIFF',
  stake: 0.35,
  maxLoss: 2.0, // Stop quickly
  maxTrades: 100, // Many small trades
  analysisWindow: 50, // Very short memory
  threshold: 0.12,
  duration: 1
};

// Trend-following strategy
const trendConfig = {
  mode: 'demo',
  symbol: 'R_75',
  contractType: 'DIGITMATCH', // Follow the trend
  stake: 0.50,
  maxLoss: 5.0,
  maxTrades: 15,
  analysisWindow: 1500, // Very long history
  threshold: 0.18,
  duration: 3 // Longer duration
};

module.exports = {
  conservativeConfig,
  aggressiveConfig,
  balancedConfig,
  scalpingConfig,
  trendConfig
};
