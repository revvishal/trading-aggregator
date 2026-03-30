import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ReturnType<typeof Router> = Router();

// In-memory store for webhook alerts
interface StoredAlert {
  id: string;
  timestamp: string;
  Exchange: string;
  Close: number;
  Ticker: string;
  OrderType: string;
  ProductType: string;
  InstrumentType: string;
  Quantity: number;
  Strategy: string;
  Code: string;
  status: 'PENDING';
  receivedAt: string;
}

const alertStore: StoredAlert[] = [];
const MAX_ALERTS = 1000; // Keep last 1000 alerts in memory

/**
 * POST /api/webhook
 * Receives TradingView alert JSON payload.
 * Supports single object or array of objects.
 *
 * Optional authentication via X-Webhook-Secret header.
 *
 * TradingView payload format:
 * [{
 *   "Exchange": "NSE",
 *   "Close": 846,
 *   "Ticker": "GANECOS",
 *   "OrderType": "ADD",
 *   "ProductType": "CNC",
 *   "InstrumentType": "EQ",
 *   "Quantity": 1,
 *   "Strategy": "PRO1",
 *   "Code": "16D2229D88875U"
 * }]
 */
router.post('/', (req: Request, res: Response) => {
  // Validate webhook secret if configured
  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = req.body?.[0].Code as string;
    console.log("Code:", req.body?.[0].Code);
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
    const newAlerts: StoredAlert[] = [];

    for (const item of alertsArray) {
      if (!item.Ticker) {
        console.warn('[WEBHOOK] Skipping alert without Ticker:', item);
        continue;
      }

      const alert: StoredAlert = {
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

      alertStore.push(alert);
      newAlerts.push(alert);

      console.log(`[WEBHOOK] ✓ Received: ${alert.OrderType} ${alert.Ticker} @ ₹${alert.Close} (${alert.Strategy})`);
    }

    // Trim store if too large
    while (alertStore.length > MAX_ALERTS) {
      alertStore.shift();
    }

    res.status(200).json({
      success: true,
      received: newAlerts.length,
      alerts: newAlerts,
    });
  } catch (error) {
    console.error('[WEBHOOK] Error processing alert:', error);
    res.status(400).json({ error: 'Invalid payload format' });
  }
});

/**
 * GET /api/webhook/alerts
 * Fetch stored webhook alerts.
 * Query params:
 *   - since: ISO timestamp to get alerts after (for polling)
 *   - limit: max number of alerts (default: 100)
 */
router.get('/alerts', (req: Request, res: Response) => {
  const since = req.query.since as string | undefined;
  const limit = Math.min(Number(req.query.limit) || 100, MAX_ALERTS);

  let results = [...alertStore];

  if (since) {
    const sinceTime = new Date(since).getTime();
    results = results.filter((a) => new Date(a.receivedAt).getTime() > sinceTime);
  }

  // Return most recent first, limited
  results = results
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, limit);

  res.json({
    count: results.length,
    total: alertStore.length,
    alerts: results,
  });
});

/**
 * GET /api/webhook/alerts/count
 * Quick count of pending alerts (for badge/polling)
 */
router.get('/alerts/count', (req: Request, res: Response) => {
  const since = req.query.since as string | undefined;

  let count = alertStore.length;
  if (since) {
    const sinceTime = new Date(since).getTime();
    count = alertStore.filter((a) => new Date(a.receivedAt).getTime() > sinceTime).length;
  }

  res.json({ count, total: alertStore.length });
});

/**
 * DELETE /api/webhook/alerts
 * Clear all stored alerts
 */
router.delete('/alerts', (_req: Request, res: Response) => {
  const cleared = alertStore.length;
  alertStore.length = 0;
  res.json({ success: true, cleared });
});

export { router as webhookRouter };


