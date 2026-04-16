import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router: ReturnType<typeof Router> = Router();

// ==========================================
// ALERTS — full CRUD
// ==========================================

router.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM alerts ORDER BY timestamp DESC");
    const alerts = result.rows.map(rowToAlert);
    res.json(alerts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/alerts', async (req: Request, res: Response) => {
  const alerts = req.body;
  if (!Array.isArray(alerts)) { res.status(400).json({ error: 'Expected an array' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM alerts');
    for (const a of alerts) {
      await client.query(
        `INSERT INTO alerts (id, timestamp, exchange, close, ticker, order_type, product_type, instrument_type, quantity, strategy, code, status, received_at, financials, analyst_recommendation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [a.id, a.timestamp, a.Exchange, a.Close, a.Ticker, a.OrderType, a.ProductType, a.InstrumentType, a.Quantity, a.Strategy, a.Code, a.status, a.timestamp, JSON.stringify(a.financials || null), JSON.stringify(a.analystRecommendation || null)]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: alerts.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// ZERODHA ORDERS — per account
// ==========================================

router.get('/orders', async (req: Request, res: Response) => {
  const account = (req.query.account as string) || null;
  try {
    let result;
    if (account) {
      result = await pool.query('SELECT * FROM zerodha_orders WHERE account_type = $1 ORDER BY timestamp DESC', [account]);
    } else {
      result = await pool.query('SELECT * FROM zerodha_orders ORDER BY timestamp DESC');
    }
    const orders = result.rows.map(rowToOrder);
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/orders', async (req: Request, res: Response) => {
  const orders = req.body;
  const account = (req.query.account as string) || 'primary';
  if (!Array.isArray(orders)) { res.status(400).json({ error: 'Expected an array' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM zerodha_orders WHERE account_type = $1', [account]);
    for (const o of orders) {
      await client.query(
        `INSERT INTO zerodha_orders (id, order_id, ticker, exchange, type, quantity, price, timestamp, status, product_type, instrument_type, account_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.id, o.orderId, o.ticker, o.exchange, o.type, o.quantity, o.price, o.timestamp, o.status, o.productType, o.instrumentType, account]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: orders.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// ZERODHA HOLDINGS — per account
// ==========================================

router.get('/holdings', async (req: Request, res: Response) => {
  const account = (req.query.account as string) || null;
  try {
    let result;
    if (account) {
      result = await pool.query('SELECT * FROM zerodha_holdings WHERE account_type = $1 ORDER BY created_at DESC', [account]);
    } else {
      result = await pool.query('SELECT * FROM zerodha_holdings ORDER BY created_at DESC');
    }
    const holdings = result.rows.map(rowToHolding);
    res.json(holdings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/holdings', async (req: Request, res: Response) => {
  const holdings = req.body;
  const account = (req.query.account as string) || 'primary';
  if (!Array.isArray(holdings)) { res.status(400).json({ error: 'Expected an array' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM zerodha_holdings WHERE account_type = $1', [account]);
    for (const h of holdings) {
      await client.query(
        `INSERT INTO zerodha_holdings (ticker, exchange, quantity, average_price, last_price, pnl, day_change, day_change_percent, account_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [h.ticker, h.exchange, h.quantity, h.averagePrice, h.lastPrice, h.pnl, h.dayChange, h.dayChangePercent, account]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: holdings.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// MATCHED TRADES — append-only, never delete matched
// ==========================================

router.get('/matched-trades', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM matched_trades ORDER BY timestamp DESC');
    const trades = result.rows.map(rowToMatchedTrade);
    res.json(trades);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Append new matched trades (upsert — skip existing)
router.post('/matched-trades', async (req: Request, res: Response) => {
  const trades = req.body;
  if (!Array.isArray(trades)) { res.status(400).json({ error: 'Expected an array' }); return; }
  let inserted = 0;
  for (const t of trades) {
    try {
      await pool.query(
        `INSERT INTO matched_trades (id, alert_id, zerodha_order_id, ticker, match_type, direction, alert_quantity, zerodha_quantity, zerodha_price, alert_close, timestamp, pnl, status, account_type, holding_avg_buy_price, partial_exit_amount, actual_partial_buy_amount, full_exit_amount, actual_full_buy_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO NOTHING`,
        [t.id, t.alertId, t.zerodhaOrderId, t.ticker, t.matchType, t.direction, t.alertQuantity, t.zerodhaQuantity, t.zerodhaPrice, t.alertClose, t.timestamp, t.pnl || null, t.status, t.accountType || 'primary', t.holdingAvgBuyPrice || null, t.partialExitAmount || 0, t.actualPartialBuyAmount || 0, t.fullExitAmount || 0, t.actualFullBuyAmount || 0]
      );
      inserted++;
    } catch {
      // skip duplicates
    }
  }
  res.json({ success: true, inserted });
});

// Legacy PUT — only used for full replacement (backwards compat)
router.put('/matched-trades', async (req: Request, res: Response) => {
  const trades = req.body;
  if (!Array.isArray(trades)) { res.status(400).json({ error: 'Expected an array' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    //This should not be deleting
    //await client.query('DELETE FROM matched_trades');
    for (const t of trades) {
      await client.query(
        `INSERT INTO matched_trades (id, alert_id, zerodha_order_id, ticker, match_type, direction, alert_quantity, zerodha_quantity, zerodha_price, alert_close, timestamp, pnl, status, account_type, holding_avg_buy_price, partial_exit_amount, actual_partial_buy_amount, full_exit_amount, actual_full_buy_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [t.id, t.alertId, t.zerodhaOrderId, t.ticker, t.matchType, t.direction, t.alertQuantity, t.zerodhaQuantity, t.zerodhaPrice, t.alertClose, t.timestamp, t.pnl || null, t.status, t.accountType || 'primary', t.holdingAvgBuyPrice || null, t.partialExitAmount || 0, t.actualPartialBuyAmount || 0, t.fullExitAmount || 0, t.actualFullBuyAmount || 0]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: trades.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// PNL ENTRIES
// ==========================================

router.get('/pnl-entries', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM pnl_entries ORDER BY created_at DESC');
    const entries = result.rows.map(rowToPnlEntry);
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/pnl-entries', async (req: Request, res: Response) => {
  const entries = req.body;
  if (!Array.isArray(entries)) { res.status(400).json({ error: 'Expected an array' }); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM pnl_entries');
    for (const e of entries) {
      await client.query(
        `INSERT INTO pnl_entries (ticker, strategy, realised_pnl, unrealised_pnl, total_invested, current_value, quantity, average_buy_price, last_price, actioned, trades)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [e.ticker, e.strategy, e.realisedPnl, e.unrealisedPnl, e.totalInvested, e.currentValue, e.quantity, e.averageBuyPrice, e.lastPrice, e.actioned, e.trades]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: entries.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// CLEAR ALL
// ==========================================
// EXIT SUMMARY by ticker
// ==========================================

router.get('/exit-summary/:ticker', async (req: Request, res: Response) => {
  const ticker = req.params.ticker.toUpperCase();
  try {
    const result = await pool.query(
      `SELECT 
         COALESCE(SUM(partial_exit_amount), 0) AS total_partial_exit_amount,
         COALESCE(SUM(actual_partial_buy_amount), 0) AS total_actual_partial_buy_amount,
         COALESCE(MAX(CASE WHEN match_type = 'FULL_EXIT' THEN full_exit_amount ELSE 0 END), 0) AS full_exit_amount,
         COALESCE(MAX(CASE WHEN match_type = 'FULL_EXIT' THEN actual_full_buy_amount ELSE 0 END), 0) AS actual_full_buy_amount
       FROM matched_trades
       WHERE UPPER(ticker) = $1 AND match_type IN ('PARTIAL_EXIT', 'FULL_EXIT')`,
      [ticker]
    );
    const row = result.rows[0] || {};
    res.json({
      ticker,
      totalPartialExitAmount: parseFloat(row.total_partial_exit_amount) || 0,
      totalActualPartialBuyAmount: parseFloat(row.total_actual_partial_buy_amount) || 0,
      fullExitAmount: parseFloat(row.full_exit_amount) || 0,
      actualFullBuyAmount: parseFloat(row.actual_full_buy_amount) || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================

router.delete('/all', async (_req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM pnl_entries');
    await pool.query('DELETE FROM matched_trades');
    await pool.query('DELETE FROM zerodha_holdings');
    await pool.query('DELETE FROM zerodha_orders');
    await pool.query('DELETE FROM alerts');
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Row mappers
// ==========================================

function rowToAlert(row: any) {
  return {
    id: row.id,
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    Exchange: row.exchange,
    Close: parseFloat(row.close),
    Ticker: row.ticker,
    OrderType: row.order_type,
    ProductType: row.product_type,
    InstrumentType: row.instrument_type,
    Quantity: row.quantity,
    Strategy: row.strategy,
    Code: row.code,
    status: row.status,
    financials: row.financials || undefined,
    analystRecommendation: row.analyst_recommendation || undefined,
  };
}

function rowToOrder(row: any) {
  return {
    id: row.id,
    orderId: row.order_id,
    ticker: row.ticker,
    exchange: row.exchange,
    type: row.type,
    quantity: row.quantity,
    price: parseFloat(row.price),
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    status: row.status,
    productType: row.product_type,
    instrumentType: row.instrument_type,
    accountType: row.account_type,
  };
}

function rowToHolding(row: any) {
  return {
    ticker: row.ticker,
    exchange: row.exchange,
    quantity: row.quantity,
    averagePrice: parseFloat(row.average_price),
    lastPrice: parseFloat(row.last_price),
    pnl: parseFloat(row.pnl),
    dayChange: parseFloat(row.day_change),
    dayChangePercent: parseFloat(row.day_change_percent),
    accountType: row.account_type,
  };
}

function rowToMatchedTrade(row: any) {
  return {
    id: row.id,
    alertId: row.alert_id,
    zerodhaOrderId: row.zerodha_order_id,
    ticker: row.ticker,
    matchType: row.match_type,
    direction: row.direction,
    alertQuantity: row.alert_quantity,
    zerodhaQuantity: row.zerodha_quantity,
    zerodhaPrice: parseFloat(row.zerodha_price),
    alertClose: parseFloat(row.alert_close),
    timestamp: row.timestamp instanceof Date ? row.timestamp.toISOString() : row.timestamp,
    pnl: row.pnl ? parseFloat(row.pnl) : undefined,
    holdingAvgBuyPrice: row.holding_avg_buy_price ? parseFloat(row.holding_avg_buy_price) : undefined,
    partialExitAmount: row.partial_exit_amount ? parseFloat(row.partial_exit_amount) : 0,
    actualPartialBuyAmount: row.actual_partial_buy_amount ? parseFloat(row.actual_partial_buy_amount) : 0,
    fullExitAmount: row.full_exit_amount ? parseFloat(row.full_exit_amount) : 0,
    actualFullBuyAmount: row.actual_full_buy_amount ? parseFloat(row.actual_full_buy_amount) : 0,
    status: row.status,
    accountType: row.account_type,
  };
}

function rowToPnlEntry(row: any) {
  return {
    ticker: row.ticker,
    strategy: row.strategy,
    realisedPnl: parseFloat(row.realised_pnl),
    unrealisedPnl: parseFloat(row.unrealised_pnl),
    totalInvested: parseFloat(row.total_invested),
    currentValue: parseFloat(row.current_value),
    quantity: row.quantity,
    averageBuyPrice: parseFloat(row.average_buy_price),
    lastPrice: parseFloat(row.last_price),
    actioned: row.actioned,
    trades: row.trades,
  };
}

export { router as dataRouter };

