import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router: ReturnType<typeof Router> = Router();

// Cache TTL: 24 hours — financials don't change intraday
const CACHE_TTL_HOURS = 24;

/**
 * GET /api/financials/:ticker
 * Returns cached financial data + analyst recommendations for a ticker.
 * If cached data is stale (> CACHE_TTL_HOURS), returns it with a stale flag.
 */
router.get('/:ticker', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker || '').toUpperCase().trim();
  if (!ticker) {
    res.status(400).json({ error: 'Ticker is required' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT * FROM ticker_financials WHERE ticker = $1',
      [ticker]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      const fetchedAt = new Date(row.fetched_at);
      const ageHours = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
      const stale = ageHours > CACHE_TTL_HOURS;

      res.json({
        ticker,
        financials: row.financials,
        analystRecommendation: row.analyst_recommendation,
        fetchedAt: row.fetched_at,
        stale,
      });
    } else {
      res.json({ ticker, financials: null, analystRecommendation: null, fetchedAt: null, stale: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/financials/:ticker
 * Save/update financial data + analyst recommendations for a ticker.
 * Called from the frontend after TradingView widget data is captured.
 */
router.put('/:ticker', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker || '').toUpperCase().trim();
  if (!ticker) {
    res.status(400).json({ error: 'Ticker is required' });
    return;
  }

  const { financials, analystRecommendation } = req.body;

  try {
    await pool.query(
      `INSERT INTO ticker_financials (ticker, financials, analyst_recommendation, fetched_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         financials = COALESCE($2, ticker_financials.financials),
         analyst_recommendation = COALESCE($3, ticker_financials.analyst_recommendation),
         fetched_at = NOW(),
         updated_at = NOW()`,
      [ticker, JSON.stringify(financials || null), JSON.stringify(analystRecommendation || null)]
    );

    res.json({ success: true, ticker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/financials
 * List all cached ticker financials
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM ticker_financials ORDER BY updated_at DESC');
    const data = result.rows.map((row: any) => ({
      ticker: row.ticker,
      financials: row.financials,
      analystRecommendation: row.analyst_recommendation,
      fetchedAt: row.fetched_at,
    }));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as financialsRouter };

