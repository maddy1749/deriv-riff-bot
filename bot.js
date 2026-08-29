/**
 * Deriv Riff Bot - Native Node.js Implementation
 * Runs directly on Deriv platform via API
 * Connects via WebSocket and executes automated trades
 */

const WebSocket = require('ws');
const dotenv = require('dotenv');

dotenv.config();

class DerivRiffBot {
  constructor(config = {}) {
    this.config = {
      wsUrl: config.wsUrl || 'wss://ws.binaryws.com/websockets/v3',
      token: config.token || process.env.DERIV_TOKEN,
      appId: config.appId || process.env.DERIV_APP_ID,
      symbol: config.symbol || 'R_100',
      contractType: config.contractType || 'DIGITDIFF', // DIGITMATCH or DIGITDIFF
      stake: config.stake || 0.35,
      maxLoss: config.maxLoss || 6.0,
      maxTrades: config.maxTrades || 20,
      analysisWindow: config.analysisWindow || 500,
      threshold: config.threshold || 0.15,
      duration: config.duration || 1,
      mode: config.mode || 'demo' // demo or real
    };

    this.ws = null;
    this.connected = false;
    this.authorized = false;
    this.running = false;
    this.reqId = 1;

    this.session = {
      trades: 0,
      wins: 0,
      losses: 0,
      pl: 0
    };

    this.digits = [];
    this.activeContract = null;
    this.balance = 0;
    this.currency = 'USD';
  }

  /**
   * Connect to Deriv WebSocket API
   */
  connect() {
    return new Promise((resolve, reject) => {
      let url = this.config.wsUrl;
      if (this.config.appId) {
        url += (url.includes('?') ? '&' : '?') + 'app_id=' + this.config.appId;
      }

      console.log('[BOT] Connecting to Deriv WebSocket...');
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[BOT] WebSocket connected');
        this.connected = true;
        this.authorize();
        resolve();
      });

      this.ws.on('message', (data) => this.handleMessage(JSON.parse(data)));

      this.ws.on('error', (error) => {
        console.error('[ERROR] WebSocket error:', error.message);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[BOT] WebSocket closed');
        this.connected = false;
        this.authorized = false;
      });
    });
  }

  /**
   * Authorize with Deriv API token
   */
  authorize() {
    if (!this.config.token) {
      console.warn('[WARN] No API token provided. Running in analysis-only mode.');
      this.subscribeToSymbol();
      return;
    }

    console.log('[BOT] Authorizing...');
    this.send({
      authorize: this.config.token
    });
  }

  /**
   * Subscribe to symbol ticks
   */
  subscribeToSymbol() {
    console.log(`[BOT] Subscribing to ${this.config.symbol}...`);
    
    // Get historical data
    this.send({
      ticks_history: this.config.symbol,
      count: this.config.analysisWindow,
      end: 'latest',
      style: 'ticks'
    });

    // Subscribe to live ticks
    this.send({
      ticks: this.config.symbol,
      subscribe: 1
    });
  }

  /**
   * Send message to Deriv API
   */
  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    payload.req_id = this.reqId++;
    this.ws.send(JSON.stringify(payload));
  }

  /**
   * Handle incoming messages from Deriv API
   */
  handleMessage(data) {
    if (data.error) {
      console.error('[ERROR]', data.error.message);
      return;
    }

    const msgType = data.msg_type;

    if (msgType === 'authorize') {
      this.handleAuthorize(data);
    } else if (msgType === 'history') {
      this.handleHistory(data);
    } else if (msgType === 'tick') {
      this.handleTick(data);
    } else if (msgType === 'proposal') {
      this.handleProposal(data);
    } else if (msgType === 'buy') {
      this.handleBuy(data);
    } else if (msgType === 'proposal_open_contract') {
      this.handleOpenContract(data);
    }
  }

  /**
   * Handle authorization response
   */
  handleAuthorize(data) {
    this.authorized = true;
    this.balance = data.authorize.balance;
    this.currency = data.authorize.currency;
    console.log(`[BOT] Authorized: ${data.authorize.loginid} | Balance: ${this.balance} ${this.currency}`);
    this.subscribeToSymbol();
  }

  /**
   * Handle historical tick data
   */
  handleHistory(data) {
    const prices = data.history.prices || [];
    this.digits = prices.map(p => this.extractLastDigit(p));
    console.log(`[BOT] Loaded ${this.digits.length} historical ticks`);
    this.printStats();
  }

  /**
   * Handle new tick
   */
  handleTick(data) {
    const quote = data.tick.quote;
    const digit = this.extractLastDigit(quote);
    this.digits.push(digit);

    if (this.digits.length > this.config.analysisWindow) {
      this.digits.shift();
    }

    console.log(`[TICK] ${this.config.symbol}: ${quote} (Last digit: ${digit})`);

    if (this.running && !this.activeContract) {
      const signal = this.analyzeFrequency();
      if (signal) {
        this.maybeTrade(signal);
      }
    }
  }

  /**
   * Handle proposal response
   */
  handleProposal(data) {
    const proposal = data.proposal;
    if (this.running && !this.activeContract) {
      console.log(`[PROPOSAL] ID: ${proposal.id} | Ask: ${proposal.ask_price}`);
      this.activeContract = {
        stage: 'proposal',
        target: proposal.barrier
      };
      this.send({
        buy: proposal.id,
        price: proposal.ask_price
      });
    }
  }

  /**
   * Handle buy confirmation
   */
  handleBuy(data) {
    this.activeContract = {
      stage: 'open',
      id: data.buy.contract_id
    };
    this.session.trades++;
    console.log(`[BUY] Contract #${this.activeContract.id} opened`);
    
    this.send({
      proposal_open_contract: 1,
      contract_id: this.activeContract.id,
      subscribe: 1
    });
  }

  /**
   * Handle open contract update
   */
  handleOpenContract(data) {
    const contract = data.proposal_open_contract;
    if (contract.is_sold) {
      const profit = Number(contract.profit) || 0;
      this.session.pl += profit;
      if (profit > 0) {
        this.session.wins++;
        console.log(`[WIN] +${profit.toFixed(2)} | Total P/L: ${this.session.pl.toFixed(2)}`);
      } else {
        this.session.losses++;
        console.log(`[LOSS] ${profit.toFixed(2)} | Total P/L: ${this.session.pl.toFixed(2)}`);
      }
      this.activeContract = null;
      this.checkRiskLimits();
    }
  }

  /**
   * Extract last digit from price
   */
  extractLastDigit(price) {
    const str = String(price);
    const match = str.match(/(\d)(?!.*\d)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * Analyze digit frequency and generate signal
   */
  analyzeFrequency() {
    if (this.digits.length < 50) return null;

    const counts = Array(10).fill(0);
    this.digits.forEach(d => counts[d]++);

    const max = Math.max(...counts);
    const min = Math.min(...counts);
    const total = this.digits.length;

    let signal = null;

    if (this.config.contractType === 'DIGITMATCH') {
      const maxDigit = counts.indexOf(max);
      const maxShare = max / total;
      if (maxShare >= this.config.threshold) {
        signal = { target: maxDigit, share: maxShare, type: 'MATCH' };
      }
    } else if (this.config.contractType === 'DIGITDIFF') {
      const minDigit = counts.indexOf(min);
      const minShare = min / total;
      if (minShare <= this.config.threshold) {
        signal = { target: minDigit, share: minShare, type: 'DIFFER' };
      }
    }

    return signal;
  }

  /**
   * Execute trade if signal is valid
   */
  maybeTrade(signal) {
    if (!this.authorized) {
      console.warn('[WARN] Trading blocked: not authorized');
      return;
    }

    if (!this.checkRiskLimits()) {
      return;
    }

    console.log(`[SIGNAL] ${signal.type} on digit ${signal.target} (${(signal.share * 100).toFixed(1)}%)`);

    this.activeContract = {
      stage: 'requesting',
      target: signal.target
    };

    this.send({
      proposal: 1,
      amount: this.config.stake,
      basis: 'stake',
      contract_type: this.config.contractType,
      currency: this.currency,
      duration: this.config.duration,
      duration_unit: 't',
      barrier: String(signal.target),
      underlying_symbol: this.config.symbol
    });
  }

  /**
   * Check risk management limits
   */
  checkRiskLimits() {
    if (this.session.pl <= -Math.abs(this.config.maxLoss)) {
      console.warn('[RISK] Maximum loss reached. Stopping bot.');
      this.stop();
      return false;
    }

    if (this.session.trades >= this.config.maxTrades) {
      console.warn('[RISK] Maximum trades reached. Stopping bot.');
      this.stop();
      return false;
    }

    return true;
  }

  /**
   * Start the bot
   */
  start() {
    if (!this.connected) {
      console.error('[ERROR] Not connected. Call connect() first.');
      return;
    }

    console.log(`\n[BOT] Starting in ${this.config.mode.toUpperCase()} mode...`);
    console.log(`[BOT] Symbol: ${this.config.symbol}`);
    console.log(`[BOT] Type: ${this.config.contractType}`);
    console.log(`[BOT] Stake: ${this.config.stake}`);
    console.log(`[BOT] Max Loss: ${this.config.maxLoss}`);
    console.log(`[BOT] Max Trades: ${this.config.maxTrades}\n`);

    this.running = true;
  }

  /**
   * Stop the bot
   */
  stop() {
    this.running = false;
    this.activeContract = null;
    console.log('[BOT] Bot stopped.');
    this.printStats();
  }

  /**
   * Print session statistics
   */
  printStats() {
    console.log('\n--- SESSION STATS ---');
    console.log(`Trades: ${this.session.trades}`);
    console.log(`Wins: ${this.session.wins}`);
    console.log(`Losses: ${this.session.losses}`);
    console.log(`P/L: ${this.session.pl.toFixed(2)} ${this.currency}`);
    if (this.session.trades > 0) {
      const winRate = ((this.session.wins / this.session.trades) * 100).toFixed(1);
      console.log(`Win Rate: ${winRate}%`);
    }
    console.log('---------------------\n');
  }

  /**
   * Disconnect from Deriv
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
    console.log('[BOT] Disconnected.');
  }
}

// Export for use as module
module.exports = DerivRiffBot;

// Run bot if executed directly
if (require.main === module) {
  const bot = new DerivRiffBot({
    token: process.env.DERIV_TOKEN,
    mode: 'demo',
    symbol: 'R_100',
    contractType: 'DIGITDIFF',
    stake: 0.35,
    maxLoss: 6.0,
    maxTrades: 20,
    analysisWindow: 500,
    threshold: 0.15,
    duration: 1
  });

  bot.connect().then(() => {
    // Give it time to subscribe, then start trading
    setTimeout(() => {
      bot.start();
    }, 3000);
  }).catch(err => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    bot.stop();
    bot.disconnect();
    process.exit(0);
  });
}
