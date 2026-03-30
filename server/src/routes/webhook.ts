import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db';

const router: ReturnType<typeof Router> = Router();

/**
 * POST /api/webhook
 * Receives TradingView alert JSON payload.
 * Supports single object or array of objects.
 * Authenticated via Code field matching WEBHOOK_SECRET.
 */
router.post('/', async (req: Request, res: Response) => {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = req.body?.[0]?.Code as string;
    if (providedSecret !== webhookSecret) {
      console.warn(`[WEBHOOK] Unauthorized request from ${req.ip}`);
      res.status(401).json({ error: 'Invalid webhook secret' });
      return;
    }
  }

  try {
    const body = req.body;
    const alertsArray = Array.isArray(body) ? body : [body];
    if (alertsArray.length === 0) {
      res.status(400).json({ error: 'Empty payload' });
      return;
    }

    const receivedAt = new Date().toISOString();
    const newAlerts: any[] = [];

    for (const item of alertsArray) {
      if (!item.Ticker) { continue; }
      const alert = {
        id: uuidv4(),
        timestamp: receivedAt,
        Exchange: (item.Exchange || 'NSE').trim(),
        Close: Number(item.Close) || 0,
        Ticker: (item.Ticker || '').trim(),
        OrderType: (item.OrderType || 'BUY').trim(),
        ProductType: (item.ProductType || 'CNC').trim(),
        InstrumentType: (item.InstrumentType || 'EQ').trim(),
        Quantity: Number(item.Quantity) || 1,
        Strategy: (item.Strategy || '').trim(),
        Code: (item.Code || '').trim(),
        status: 'PENDING',
        receivedAt,
      };

      await pool.query(
        `INSERT INTO alerts (id, timestamp, exchange, close, ticker, order_type, product_type, instrument_type, quantity, strategy, code, status, received_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [alert.id, alert.timestamp, alert.Exchange, alert.Close, alert.Ticker, alert.OrderType, alert.ProductType, alert.InstrumentType, alert.Quantity, alert.Strategy, alert.Code, alert.status, alert.receivedAt]
      );

      newAlerts.push(alert);
      console.log(`[WEBHOOK] ✓ Received: ${alert.OrderType} ${alert.Ticker} @ ₹${alert.Close} (${alert.Strategy})`);
    }

    res.status(200).json({ success: true, received: newAlerts.length, alerts: newAlerts });
  } catch (error) {
    console.error('[WEBHOOK] Error processing alert:', error);
    res.status(400).json({ error: 'Invalid payload format' });
  }
});

/**
 * GET /api/webhook/alerts
 * Fetch stored webhook alerts from DB.
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);

    let query = 'SELECT * FROM alerts';
    const params: any[] = [];

    if (since) {
      query += ' WHERE received_at > $1';
      params.push(since);
    }
    query += ' ORDER BY received_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(query, params);
    const alerts = result.rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
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
      receivedAt: row.received_at,
    }));

    const countResult = await pool.query('SELECT COUNT(*) FROM alerts');
    res.json({ count: alerts.length, total: parseInt(countResult.rows[0].count), alerts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/webhook/alerts/count
 */
router.get('/alerts/count', async (req: Request, res: Response) => {
  try {
    const since = req.query.since as string | undefined;
    let count: number;
    if (since) {
      const r = await pool.query('SELECT COUNT(*) FROM alerts WHERE received_at > $1', [since]);
      count = parseInt(r.rows[0].count);
    } else {
      const r = await pool.query('SELECT COUNT(*) FROM alerts');
      count = parseInt(r.rows[0].count);
    }
    const totalR = await pool.query('SELECT COUNT(*) FROM alerts');
    res.json({ count, total: parseInt(totalR.rows[0].count) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/webhook/alerts
 */
router.delete('/alerts', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM alerts');
    res.json({ success: true, cleared: result.rowCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as webhookRouter };

