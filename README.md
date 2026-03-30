# Trade Aggregator & Analysis Dashboard

A comprehensive trade aggregation and analysis dashboard that integrates TradingView alerts with Zerodha Kite Connect for automated trade tracking, matching, and P&L analysis.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  TradingView                                              │
│  (Sends POST webhook alerts)                              │
└───────────┬──────────────────────────────────────────────┘
            │ POST /api/webhook
            ▼
┌──────────────────────────┐     ┌──────────────────────────┐
│  Express Backend (3001)  │◄────│  Zerodha Kite Connect    │
│  - Webhook receiver      │────►│  - OAuth2 flow           │
│  - Kite API proxy        │     │  - Orders/Holdings API   │
│  - Session management    │     └──────────────────────────┘
└───────────┬──────────────┘
            │ /api/*
            ▼
┌──────────────────────────┐
│  React Frontend (3000)   │
│  - Signals dashboard     │
│  - Zerodha trades view   │
│  - Trade matching        │
│  - P&L tracking/charts   │
│  - Global ticker filter  │
└──────────────────────────┘
```

## Features

1. **📡 Webhook Endpoint** — `POST /api/webhook` receives TradingView alert JSON payloads automatically
2. **📊 Quarterly Financials** — Auto-fetches Revenue, EPS YoY%, EBITDA, Op Margin% for past 4 quarters
3. **🎯 Analyst Recommendations** — Individual analyst ratings with consolidated score
4. **🔗 Zerodha Kite Integration** — OAuth login, auto-sync orders & holdings from your Zerodha account
5. **🔄 Trade Matching** — Matches signals with orders (BUY/SELL=full entry/exit, ADD/REMOVE=partial)
6. **💰 P&L Tracking** — Separate actioned vs non-actioned P&L with charts and strategy breakdown
7. **📑 Multi-tab Dashboard** — Signals, Zerodha, Matched Trades, P&L
8. **🔍 Global Ticker Filter** — Filter all views by ticker symbol

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2. Configure Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
WEBHOOK_SECRET=                          # Optional: secure your webhook
KITE_API_KEY=your_api_key_here           # From https://developers.kite.trade/
KITE_API_SECRET=your_api_secret_here     # From https://developers.kite.trade/
```

### 3. Configure Kite Connect App

In [Kite Connect developer portal](https://developers.kite.trade/):
1. Create/select your app
2. Set **Redirect URL** to: `http://localhost:3001/api/zerodha/callback`
3. Copy **API Key** and **API Secret** to `server/.env`

### 4. Run

```bash
npm run dev          # Runs frontend (3000) + backend (3001) together
```

## TradingView Webhook Setup

Set your TradingView alert webhook URL to:
```
http://your-server:3001/api/webhook
```

Alert JSON body format:
```json
[{
  "Exchange": "NSE",
  "Close": {{close}},
  "Ticker": "{{ticker}}",
  "OrderType": "BUY",
  "ProductType": "CNC",
  "InstrumentType": "EQ",
  "Quantity": 1,
  "Strategy": "PRO1",
  "Code": "16D2229D88875U"
}]
```

**OrderType values:** `BUY` | `SELL` | `ADD` | `REMOVE`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/webhook` | Receive TradingView alert |
| `GET` | `/api/webhook/alerts` | Fetch stored alerts (`?since=&limit=`) |
| `GET` | `/api/zerodha/status` | Check Kite connection status |
| `GET` | `/api/zerodha/login` | Redirect to Kite OAuth login |
| `GET` | `/api/zerodha/orders` | Fetch today's orders |
| `GET` | `/api/zerodha/holdings` | Fetch portfolio holdings |
| `GET` | `/api/zerodha/positions` | Fetch day/net positions |
| `GET` | `/api/health` | Server health check |

## Notes

- **Kite tokens expire daily** (~6 AM IST). Re-login required each trading day.
- **Webhook alerts** stored in-memory on server (persist until restart).
- **Frontend data** persisted in browser localStorage with export/import backup.
- CRA `proxy` field forwards `/api/*` from dev server (3000) to Express (3001).
