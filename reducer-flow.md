## How the Reducer Works & the DB Save Flow

### 1. The Reducer — Central State Manager

The reducer in `AppContext.tsx` is a **React `useReducer`** that manages the entire app's in-memory state (`AppState`):

| Action | What it does |
|---|---|
| `ADD_ALERTS` | Appends new TradingView alert signals to the existing array |
| `UPDATE_ALERT` | Replaces a single alert by `id` (e.g., marking as ACTIONED/IGNORED) |
| `DELETE_ALERT` | Removes an alert by `id` |
| `SET_ALERTS` | Replaces the entire alerts array |
| `SET_ZERODHA_ORDERS` | Replaces all Zerodha orders |
| `ADD_ZERODHA_ORDERS` | Appends new Zerodha orders to existing ones |
| `SET_ZERODHA_HOLDINGS` | Replaces all Zerodha holdings |
| `SET_MATCHED_TRADES` | Replaces all matched trades |
| `SET_PNL_ENTRIES` | Replaces all P&L entries |
| `SET_TICKER_FILTER` | Sets the global ticker filter string |
| `SET_ACTIVE_TAB` | Sets which UI tab is active |
| `CLEAR_ALL` | Resets state to initial empty values |
| `LOAD_ALL` | Bulk-loads multiple state slices at once (used on startup) |

### 2. Data Flow: Component → Reducer → DB

The save-to-DB flow is **automatic and reactive** via `useEffect` hooks that watch state changes:

```
Component calls dispatch({ type: 'ADD_ALERTS', payload: [...] })
        │
        ▼
Reducer updates state.alerts in memory
        │
        ▼
useEffect detects state.alerts changed
        │
        ▼
debouncedSave('alerts', () => saveAlerts(state.alerts))
        │  (waits 500ms to batch rapid changes)
        ▼
apiService.saveAlerts() → PUT /api/data/alerts
        │
        ▼
Server route (data.ts): DELETE all rows → INSERT all alerts → PostgreSQL (Neon DB)
```

### 3. Which state slices auto-save to DB?

| State Slice | Auto-saves? | Mechanism |
|---|---|---|
| `alerts` | ✅ Yes | `useEffect` → `saveAlerts()` → `PUT /api/data/alerts` |
| `matchedTrades` | ✅ Yes | `useEffect` → `saveMatchedTrades()` → `PUT /api/data/matched-trades` |
| `pnlEntries` | ✅ Yes | `useEffect` → `savePnlEntries()` → `PUT /api/data/pnl-entries` |
| `zerodhaOrders` | ❌ No | Managed server-side during Kite sync (to avoid overwriting account-specific data) |
| `zerodhaHoldings` | ❌ No | Same reason — saved server-side per account |
| `globalTickerFilter` | ❌ No | UI-only, not persisted |
| `activeTab` | ❌ No | UI-only, not persisted |

### 4. Startup Load (DB → State)

On mount, if the user is logged in, `useEffect` fires `loadAll()` which calls all 5 fetch APIs in parallel:

```
fetchAlerts()        → GET /api/data/alerts        → PostgreSQL
fetchOrders()        → GET /api/data/orders         → PostgreSQL
fetchHoldingsApi()   → GET /api/data/holdings       → PostgreSQL
fetchMatchedTrades() → GET /api/data/matched-trades → PostgreSQL
fetchPnlEntries()    → GET /api/data/pnl-entries    → PostgreSQL
```

Results are dispatched as a single `LOAD_ALL` action. The `initialLoadDone` ref prevents the `useEffect` save hooks from triggering a write-back to DB for data that was just loaded.

### 5. Debounce Guard

The `debouncedSave` function:
- **Skips** if `initialLoadDone.current` is `false` (prevents saving during the initial load)
- **Debounces** by 500ms — if multiple dispatches happen within 500ms, only the last state is saved
- This avoids hammering the DB with rapid sequential updates
