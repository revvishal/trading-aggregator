import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router: ReturnType<typeof Router> = Router();

/**
 * Parse a single CSV line respecting quoted fields (which may contain commas)
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Parse CSV format:
 * Company,Ticker,Dates,Revenue,EPS YoY,EBITDA,Op Margin,Summary
 * ACC,ACC,"28-Mar-25→30-Jun-25→...","59.92→60.36→...","...","...","...","Volatile earnings"
 */
function parseFundamentalsCSV(csvText: string): Array<{
  company: string; ticker: string; financials: any; summary: string;
}> {
  const lines = csvText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const results: Array<{ company: string; ticker: string; financials: any; summary: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const fields = parseCSVLine(lines[i]);
      if (fields.length < 7) continue;

      const company = fields[0].trim();
      const ticker = fields[1].trim().toUpperCase();
      const datesStr = fields[2].trim();
      const revenueStr = fields[3].trim();
      const epsStr = fields[4].trim();
      const ebitdaStr = fields[5].trim();
      const opMarginStr = fields[6].trim();
      const summary = (fields[7] || '').trim();

      const dates = datesStr.split('→').map(d => d.trim());
      const revenues = revenueStr.split('→').map(v => parseFloat(v.trim()));
      const eps = epsStr.split('→').map(v => parseFloat(v.trim()));
      const ebitda = ebitdaStr.split('→').map(v => parseFloat(v.trim()));
      const opMargin = opMarginStr.split('→').map(v => parseFloat(v.trim()));

      const quarters = dates.map((date, idx) => {
        const prevRev = idx > 0 ? revenues[idx - 1] : 0;
        const curRev = revenues[idx] || 0;
        const revenueChange = idx > 0 && prevRev > 0
          ? parseFloat((((curRev - prevRev) / prevRev) * 100).toFixed(2))
          : 0;
        return {
          quarter: date,
          revenue: revenues[idx] || 0,
          revenueChange,
          epsYoY: eps[idx] || 0,
          ebitda: ebitda[idx] || 0,
          opMargin: opMargin[idx] || 0,
        };
      });

      results.push({
        company,
        ticker,
        financials: { ticker, company, quarters, summary, fetchedAt: new Date().toISOString() },
        summary,
      });
    } catch (err) {
      console.error(`[FINANCIALS] Failed to parse CSV line ${i}:`, err);
    }
  }
  return results;
}

// ==========================================
// CSV Upload — bulk import fundamentals
// ==========================================

router.post('/upload-csv', async (req: Request, res: Response) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    res.status(400).json({ error: 'CSV text is required in body as { csv: "..." }' });
    return;
  }

  try {
    const parsed = parseFundamentalsCSV(csv);
    if (parsed.length === 0) {
      res.status(400).json({ error: 'No valid rows found in CSV' });
      return;
    }

    let upserted = 0;
    for (const item of parsed) {
      await pool.query(
        `INSERT INTO ticker_financials (ticker, company, financials, summary, fetched_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (ticker) DO UPDATE SET
           company = $2,
           financials = $3,
           summary = $4,
           fetched_at = NOW(),
           updated_at = NOW()`,
        [item.ticker, item.company, JSON.stringify(item.financials), item.summary]
      );
      upserted++;
    }

    console.log(`[FINANCIALS] CSV upload: ${upserted} tickers upserted`);
    res.json({ success: true, count: upserted, tickers: parsed.map(p => p.ticker) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Single ticker CRUD
// ==========================================

// List all — must be before /:ticker
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM ticker_financials ORDER BY updated_at DESC');
    const data = result.rows.map((row: any) => ({
      ticker: row.ticker,
      company: row.company || '',
      financials: row.financials,
      analystRecommendation: row.analyst_recommendation,
      summary: row.summary || '',
      fetchedAt: row.fetched_at,
    }));
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticker', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker || '').toUpperCase().trim();
  if (!ticker) { res.status(400).json({ error: 'Ticker is required' }); return; }

  try {
    const result = await pool.query('SELECT * FROM ticker_financials WHERE ticker = $1', [ticker]);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      res.json({
        ticker,
        company: row.company || '',
        financials: row.financials,
        analystRecommendation: row.analyst_recommendation,
        summary: row.summary || '',
        fetchedAt: row.fetched_at,
        stale: false,
      });
    } else {
      res.json({ ticker, company: '', financials: null, analystRecommendation: null, summary: '', fetchedAt: null, stale: true });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:ticker', async (req: Request, res: Response) => {
  const ticker = (req.params.ticker || '').toUpperCase().trim();
  if (!ticker) { res.status(400).json({ error: 'Ticker is required' }); return; }

  const { financials, analystRecommendation, company, summary } = req.body;
  try {
    await pool.query(
      `INSERT INTO ticker_financials (ticker, company, financials, analyst_recommendation, summary, fetched_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (ticker) DO UPDATE SET
         company = COALESCE($2, ticker_financials.company),
         financials = COALESCE($3, ticker_financials.financials),
         analyst_recommendation = COALESCE($4, ticker_financials.analyst_recommendation),
         summary = COALESCE($5, ticker_financials.summary),
         fetched_at = NOW(), updated_at = NOW()`,
      [ticker, company || '', JSON.stringify(financials || null), JSON.stringify(analystRecommendation || null), summary || '']
    );
    res.json({ success: true, ticker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as financialsRouter };

