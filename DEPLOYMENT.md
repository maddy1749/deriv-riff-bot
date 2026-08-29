# Deriv Bot - Deployment Guide

## Overview

This document explains how to deploy the Riff Bot directly on the Deriv platform or run it on your own server.

## Prerequisites

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- **Deriv API Token** (with trade scope)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/maddy1749/deriv-riff-bot.git
cd deriv-riff-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure API Token

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Deriv API token:

```
DERIV_TOKEN=your_token_here
BOT_MODE=demo
```

## Running the Bot

### Local Development

```bash
npm start
```

The bot will connect to Deriv and start trading automatically.

### With Auto-Reload (Development)

```bash
npm run dev
```

This uses nodemon to restart the bot when you make changes.

## Deployment Options

### Option 1: Heroku (Free/Paid)

#### Requirements:
- Heroku account (free tier available)
- Heroku CLI installed

#### Steps:

1. **Login to Heroku**
   ```bash
   heroku login
   ```

2. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

3. **Add environment variables**
   ```bash
   heroku config:set DERIV_TOKEN=your_token_here
   heroku config:set BOT_MODE=demo
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **View logs**
   ```bash
   heroku logs --tail
   ```

### Option 2: AWS Lambda

#### Requirements:
- AWS account
- AWS CLI configured

#### Steps:

1. **Install Serverless Framework**
   ```bash
   npm install -g serverless
   ```

2. **Create serverless function**
   ```bash
   serverless create --template aws-nodejs --path deriv-bot
   ```

3. **Deploy**
   ```bash
   serverless deploy
   ```

### Option 3: DigitalOcean App Platform

#### Requirements:
- DigitalOcean account
- GitHub repo connected

#### Steps:

1. Go to DigitalOcean App Platform
2. Connect your GitHub repository
3. Set environment variables (DERIV_TOKEN, etc.)
4. Deploy

### Option 4: Docker (Any Cloud)

#### Create Dockerfile

```dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "start"]
```

#### Build & Run

```bash
docker build -t deriv-riff-bot .
docker run -e DERIV_TOKEN=your_token deriv-riff-bot
```

### Option 5: VPS (DigitalOcean, Linode, AWS EC2)

#### Steps:

1. **SSH into your VPS**
   ```bash
   ssh root@your_vps_ip
   ```

2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone repository**
   ```bash
   git clone https://github.com/maddy1749/deriv-riff-bot.git
   cd deriv-riff-bot
   npm install
   ```

4. **Run with PM2 (keep bot running)**
   ```bash
   npm install -g pm2
   pm2 start bot.js --name "deriv-bot"
   pm2 startup
   pm2 save
   ```

5. **Check status**
   ```bash
   pm2 logs deriv-bot
   ```

## Using as a Module

You can also import and use the bot in your own Node.js project:

```javascript
const DerivRiffBot = require('./bot');

const bot = new DerivRiffBot({
  token: 'your_token',
  mode: 'demo',
  symbol: 'R_100',
  contractType: 'DIGITDIFF',
  stake: 0.35,
  maxLoss: 6.0,
  maxTrades: 20
});

await bot.connect();
bot.start();

// Stop after 1 hour
setTimeout(() => bot.stop(), 3600000);
```

## Monitoring & Logging

The bot logs all activities to console:
- Connection status
- Ticks received
- Trading signals
- Trade results
- Session statistics

Example output:
```
[BOT] Connecting to Deriv WebSocket...
[BOT] WebSocket connected
[BOT] Authorizing...
[BOT] Authorized: demo12345 | Balance: 1000 USD
[BOT] Subscribing to R_100...
[BOT] Loaded 500 historical ticks
[BOT] Starting in DEMO mode...
[TICK] R_100: 12345.67 (Last digit: 7)
[SIGNAL] DIFFER on digit 7 (8.5%)
[PROPOSAL] ID: 12345 | Ask: 0.35
[BUY] Contract #987654 opened
[WIN] +0.35 | Total P/L: 0.35
```

## Troubleshooting

### Bot not connecting
- Check internet connection
- Verify DERIV_TOKEN is valid and has trade scope
- Check if Deriv API is accessible: `ping ws.binaryws.com`

### Bot not trading
- Verify mode is set correctly (demo vs real)
- Check if authorized successfully (look for "Authorized" in logs)
- Ensure balance is sufficient (minimum stake)
- Check threshold settings

### High CPU/Memory usage
- Reduce analysis window size
- Increase trade delay
- Reduce frequency of updates

## Security Best Practices

1. **Never commit `.env` to Git**
   - Add `.env` to `.gitignore`
   - Use `.env.example` as template

2. **Use environment variables for all secrets**
   - Never hardcode API tokens
   - Use process.env to access tokens

3. **Rotate API tokens regularly**
   - Generate new tokens monthly
   - Revoke old tokens from Deriv settings

4. **Monitor bot activity**
   - Review trade logs regularly
   - Set up alerts for unusual activity
   - Monitor P/L closely

5. **Backup configuration**
   - Keep backup of working .env files
   - Document bot settings

## Performance Optimization

### Reduce WebSocket Memory Usage
- Decrease `analysisWindow` from 500 to 200
- Increase `delay` between trades

### Improve Trade Accuracy
- Increase `analysisWindow` to 1000+
- Fine-tune `threshold` values

### Reduce Costs (Cloud Hosting)
- Use Heroku free tier or auto-scale down
- Use AWS Lambda for event-driven execution
- Use DigitalOcean's $4/month droplet

## Support

For issues or questions:
1. Check the logs: `npm start`
2. Review strategy documentation: `STRATEGY.md`
3. Check Deriv API docs: https://developers.deriv.com/
4. Open an issue on GitHub

---

**Happy trading! Remember to always test in demo mode first.** 🚀
