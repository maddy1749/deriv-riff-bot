// Deriv Bot Builder - Riff Bot (Digit Frequency Strategy)
// This bot uses the official Deriv Bot Builder format
// Compatible with Deriv's native bot platform

function initiate() {
  // Initialize variables
  let digits = [];
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let totalPL = 0;
  
  // Configuration
  const CONFIG = {
    symbol: 'R_100',
    contractType: 'DIGITDIFF',
    stake: 0.35,
    duration: 1,
    durationUnit: 't',
    maxLoss: 6.00,
    maxTrades: 20,
    analysisWindow: 500,
    threshold: 0.15,
    tradeDelay: 500
  };
  
  // State tracking
  let state = {
    connected: false,
    authorized: false,
    running: true,
    activeContract: null,
    lastTradeTime: 0,
    balance: 0,
    currency: 'USD'
  };

  return {
    init: function() {
      console.log('[BOT] Deriv Riff Bot Initialized');
      console.log('[BOT] Strategy: Digit Frequency Analysis');
      console.log('[BOT] Contract Type: ' + CONFIG.contractType);
      console.log('[BOT] Symbol: ' + CONFIG.symbol);
      console.log('[BOT] Stake: ' + CONFIG.stake);
      console.log('[BOT] Max Loss: ' + CONFIG.maxLoss);
      console.log('[BOT] Max Trades: ' + CONFIG.maxTrades);
    },

    onTick: function(tick) {
      if (!state.running || !state.authorized) return;

      // Extract last digit from price
      const price = tick.quote;
      const lastDigit = this.extractDigit(price);
      
      // Add to analysis window
      digits.push(lastDigit);
      if (digits.length > CONFIG.analysisWindow) {
        digits.shift();
      }

      // Check if enough data to analyze
      if (digits.length >= 50) {
        const signal = this.analyzeFrequency();
        
        if (signal && !state.activeContract) {
          const now = Date.now();
          if (now - state.lastTradeTime > CONFIG.tradeDelay) {
            this.executeTrade(signal);
            state.lastTradeTime = now;
          }
        }
      }
    },

    extractDigit: function(price) {
      // Get last digit from price
      const str = String(price);
      const match = str.match(/(\\d)(?!.*\\d)/);
      return match ? parseInt(match[1]) : 0;
    },

    analyzeFrequency: function() {
      // Count digit frequencies
      const counts = Array(10).fill(0);
      for (let i = 0; i < digits.length; i++) {
        counts[digits[i]]++;
      }

      const max = Math.max(...counts);
      const min = Math.min(...counts);
      const total = digits.length;

      let signal = null;

      if (CONFIG.contractType === 'DIGITDIFF') {
        // Find least frequent digit
        const minDigit = counts.indexOf(min);
        const minFreq = min / total;
        
        if (minFreq <= CONFIG.threshold) {
          signal = {
            target: minDigit,
            frequency: minFreq,
            type: 'DIFFER'
          };
          console.log('[SIGNAL] DIGITDIFF: Least frequent digit is ' + minDigit + ' (' + (minFreq * 100).toFixed(1) + '%)');
        }
      } else if (CONFIG.contractType === 'DIGITMATCH') {
        // Find most frequent digit
        const maxDigit = counts.indexOf(max);
        const maxFreq = max / total;
        
        if (maxFreq >= CONFIG.threshold) {
          signal = {
            target: maxDigit,
            frequency: maxFreq,
            type: 'MATCH'
          };
          console.log('[SIGNAL] DIGITMATCH: Most frequent digit is ' + maxDigit + ' (' + (maxFreq * 100).toFixed(1) + '%)');
        }
      }

      return signal;
    },

    executeTrade: function(signal) {
      // Check risk limits
      if (totalPL <= -Math.abs(CONFIG.maxLoss)) {
        console.log('[RISK] Max loss reached. Stopping bot.');
        state.running = false;
        return;
      }

      if (trades >= CONFIG.maxTrades) {
        console.log('[RISK] Max trades reached. Stopping bot.');
        state.running = false;
        return;
      }

      if (!state.authorized) {
        console.log('[ERROR] Not authorized. Cannot execute trade.');
        return;
      }

      // Prepare trade parameters
      const tradeParams = {
        proposal: 1,
        amount: CONFIG.stake,
        basis: 'stake',
        contract_type: CONFIG.contractType,
        currency: state.currency,
        duration: CONFIG.duration,
        duration_unit: CONFIG.durationUnit,
        barrier: String(signal.target),
        underlying_symbol: CONFIG.symbol
      };

      console.log('[TRADE] Executing ' + CONFIG.contractType + ' on digit ' + signal.target);
      
      // Send trade to Deriv API
      Bot.trade(tradeParams);
      
      trades++;
      state.activeContract = {
        id: null,
        signal: signal,
        time: Date.now()
      };
    },

    onTrade: function(trade) {
      // Trade execution confirmation
      console.log('[TRADE OPEN] Contract ID: ' + trade.contract_id);
      state.activeContract.id = trade.contract_id;
    },

    onContractResult: function(result) {
      // Contract settlement
      if (state.activeContract) {
        const profit = result.profit || 0;
        totalPL += profit;

        if (profit > 0) {
          wins++;
          console.log('[WIN] +' + profit.toFixed(2) + ' | Total P/L: ' + totalPL.toFixed(2));
        } else {
          losses++;
          console.log('[LOSS] ' + profit.toFixed(2) + ' | Total P/L: ' + totalPL.toFixed(2));
        }

        state.activeContract = null;

        // Check if should stop
        if (totalPL <= -Math.abs(CONFIG.maxLoss) || trades >= CONFIG.maxTrades) {
          this.stop();
        }
      }
    },

    onBalance: function(balance) {
      state.balance = balance.balance;
      state.currency = balance.currency;
      console.log('[BALANCE] ' + balance.balance + ' ' + balance.currency);
    },

    onConnect: function() {
      state.connected = true;
      console.log('[BOT] Connected to Deriv API');
    },

    onAuthorize: function(auth) {
      state.authorized = true;
      state.balance = auth.balance;
      state.currency = auth.currency;
      console.log('[BOT] Authorized: ' + auth.loginid);
      console.log('[BOT] Balance: ' + auth.balance + ' ' + auth.currency);
    },

    onDisconnect: function() {
      state.connected = false;
      state.authorized = false;
      console.log('[BOT] Disconnected from Deriv API');
    },

    start: function() {
      state.running = true;
      console.log('[BOT] Bot started');
      this.printStats();
    },

    stop: function() {
      state.running = false;
      console.log('[BOT] Bot stopped');
      this.printStats();
    },

    printStats: function() {
      console.log('\\n--- SESSION STATISTICS ---');
      console.log('Total Trades: ' + trades);
      console.log('Wins: ' + wins);
      console.log('Losses: ' + losses);
      console.log('Profit/Loss: ' + totalPL.toFixed(2) + ' ' + state.currency);
      if (trades > 0) {
        const winRate = ((wins / trades) * 100).toFixed(1);
        console.log('Win Rate: ' + winRate + '%');
      }
      console.log('---------------------------\\n');
    },

    getStats: function() {
      return {
        trades: trades,
        wins: wins,
        losses: losses,
        profitLoss: totalPL,
        balance: state.balance,
        currency: state.currency,
        running: state.running
      };
    }
  };
}

// Bot initialization
const RiffBot = initiate();
RiffBot.init();
