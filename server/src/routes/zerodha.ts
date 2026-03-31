import { Router, Request, Response } from 'express';
import { pool } from '../db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const KiteConnect = require('kiteconnect').KiteConnect;

const router: ReturnType<typeof Router> = Router();

const KITE_API_KEY = process.env.KITE_API_KEY || '';
const KITE_API_SECRET = process.env.KITE_API_SECRET || '';
const SECONDARY_KITE_API_KEY = process.env.SECONDARY_KITE_API_KEY || '';
const SECONDARY_KITE_API_SECRET = process.env.SECONDARY_KITE_API_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

let kite = new KiteConnect({ api_key: KITE_API_KEY });
// Another instance for Secondary portfolio when /login?profile=secondary is used
let kite2 = new KiteConnect({ api_key: SECONDARY_KITE_API_KEY });

let sessionState = {
  accessToken: '',
  publicToken: '',
  userId: '',
  loginTime: '',
  isConnected: false,
};

/**
 * Restore Kite session from DB on first status check or server start.
 * Kite tokens are valid for one trading day (until ~6 AM IST next day).
 */
async function restoreSessionFromDb(): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT * FROM kite_sessions ORDER BY login_time DESC LIMIT 1'
    );
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    const loginTime = new Date(row.login_time);
    const now = new Date();

    // Check if token is from today (IST = UTC+5:30). Tokens expire ~6 AM IST.
    const istOffset = 5.5 * 60 * 60 * 1000;
    const loginIST = new Date(loginTime.getTime() + istOffset);
    const nowIST = new Date(now.getTime() + istOffset);

    // If login was today (same IST date) and before 6 AM cutoff, session is valid
    const sameDay = loginIST.toDateString() === nowIST.toDateString();
    const withinHours = (now.getTime() - loginTime.getTime()) < 24 * 60 * 60 * 1000;

    if (sameDay || withinHours) {
      sessionState = {
        accessToken: row.access_token,
        publicToken: row.public_token || '',
        userId: row.user_id,
        loginTime: row.login_time.toISOString(),
        isConnected: true,
      };
      kite.setAccessToken(row.access_token);
      console.log(`[ZERODHA] ✓ Restored session for ${row.user_id} from DB`);
      return true;
    } else {
      // Expired — clean up
      await pool.query('DELETE FROM kite_sessions WHERE id = $1', [row.id]);
      console.log('[ZERODHA] Stale session removed from DB');
      return false;
    }
  } catch (err: any) {
    console.error('[ZERODHA] Error restoring session:', err.message);
    return false;
  }
}

// Try to restore on module load (async, best-effort)
restoreSessionFromDb();

router.get('/status', async (_req: Request, res: Response) => {
  // If not connected in memory, try DB restore
  if (!sessionState.isConnected) {
    await restoreSessionFromDb();
  }
  res.json({
    connected: sessionState.isConnected,
    userId: sessionState.userId,
    loginTime: sessionState.loginTime,
    apiKeyConfigured: !!KITE_API_KEY && KITE_API_KEY !== 'your_api_key_here',
  });
});

router.get('/login', (_req: Request, res: Response) => {
  if (!KITE_API_KEY || KITE_API_KEY === 'your_api_key_here') {
    res.status(400).json({ error: 'KITE_API_KEY not configured.' });
    return;
  }
  var loginUrl = kite.getLoginURL();
  const profile = _req.query.profile as string;
  if (profile === 'secondary' ) {
    loginUrl = kite2.getLoginURL();
  }
  console.log(`[ZERODHA] Redirecting to Kite login: ${loginUrl}`);
  res.redirect(loginUrl);
});

router.get('/callback', async (req: Request, res: Response) => {
  const requestToken = req.query.request_token as string;
  const status = req.query.status as string;
  const profile = req.query.profile as string;

  if (status !== 'success' || !requestToken) {
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&message=Login+failed+or+cancelled`);
    return;
  }

  try {
    console.log("Profile is Secondary",profile);
    // const session = await kite.generateSession(requestToken, secret);
    const session = profile === 'secondary' ? await kite.generateSession(requestToken, SECONDARY_KITE_API_SECRET) : await kite.generateSession(requestToken, KITE_API_SECRET);

    sessionState = {
      accessToken: session.access_token,
      publicToken: session.public_token || '',
      userId: session.user_id || '',
      loginTime: new Date().toISOString(),
      isConnected: true,
    };
    kite.setAccessToken(session.access_token);

    // Persist session to DB (upsert by user_id)
    await pool.query('DELETE FROM kite_sessions WHERE user_id = $1', [sessionState.userId]);
    await pool.query(
      'INSERT INTO kite_sessions (user_id, access_token, public_token, login_time) VALUES ($1, $2, $3, $4)',
      [sessionState.userId, sessionState.accessToken, sessionState.publicToken, sessionState.loginTime]
    );

    console.log(`[ZERODHA] ✓ Connected as ${sessionState.userId} — session persisted`);
    res.redirect(`${FRONTEND_URL}?zerodha_status=success&user=${sessionState.userId}`);
  } catch (error: any) {
    console.error('[ZERODHA] Token exchange failed:', error.message || error);
    sessionState.isConnected = false;
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&message=${encodeURIComponent(error.message || 'Token exchange failed')}`);
  }
});

router.post('/disconnect', async (_req: Request, res: Response) => {
  if (sessionState.userId) {
    await pool.query('DELETE FROM kite_sessions WHERE user_id = $1', [sessionState.userId]).catch(() => {});
  }
  sessionState = { accessToken: '', publicToken: '', userId: '', loginTime: '', isConnected: false };
  kite = new KiteConnect({ api_key: KITE_API_KEY });
  console.log('[ZERODHA] Disconnected — session removed from DB');
  res.json({ success: true });
});

function requireConnection(_req: Request, res: Response, next: Function) {
  if (!sessionState.isConnected || !sessionState.accessToken) {
    res.status(401).json({ error: 'Not connected to Zerodha.', connected: false });
    return;
  }
  next();
}

router.get('/orders', requireConnection, async (_req: Request, res: Response) => {
  try {
    const orders = await kite.getOrders();
    const mapped = orders.map((order: any) => ({
      id: order.order_id, orderId: order.order_id, ticker: order.tradingsymbol, exchange: order.exchange,
      type: order.transaction_type, quantity: order.quantity, price: order.average_price || order.price || 0,
      timestamp: order.order_timestamp || order.exchange_timestamp || new Date().toISOString(),
      status: order.status, productType: order.product, instrumentType: order.instrument_type || 'EQ',
    }));
    res.json({ orders: mapped, count: mapped.length });
  } catch (error: any) {
    handleKiteError(error, res);
  }
});

router.get('/holdings', requireConnection, async (_req: Request, res: Response) => {
  try {
    const holdings = await kite.getHoldings();
    const mapped = holdings.map((h: any) => ({
      ticker: h.tradingsymbol, exchange: h.exchange, quantity: h.quantity, averagePrice: h.average_price,
      lastPrice: h.last_price, pnl: h.pnl, dayChange: h.day_change, dayChangePercent: h.day_change_percentage,
    }));
    res.json({ holdings: mapped, count: mapped.length });
  } catch (error: any) {
    handleKiteError(error, res);
  }
});

router.get('/positions', requireConnection, async (_req: Request, res: Response) => {
  try {
    const positions = await kite.getPositions();
    const mapPos = (p: any) => ({
      ticker: p.tradingsymbol, exchange: p.exchange, quantity: p.quantity, averagePrice: p.average_price,
      lastPrice: p.last_price, pnl: p.pnl, buyQuantity: p.buy_quantity, sellQuantity: p.sell_quantity,
      buyPrice: p.buy_price, sellPrice: p.sell_price, product: p.product,
    });
    res.json({ positions: { net: (positions.net || []).map(mapPos), day: (positions.day || []).map(mapPos) } });
  } catch (error: any) {
    handleKiteError(error, res);
  }
});

router.get('/profile', requireConnection, async (_req: Request, res: Response) => {
  try {
    const profile = await kite.getProfile();
    res.json({ profile });
  } catch (error: any) {
    handleKiteError(error, res);
  }
});

async function handleKiteError(error: any, res: Response) {
  if (error.status === 403 || error.error_type === 'TokenException') {
    sessionState.isConnected = false;
    // Remove stale session from DB
    if (sessionState.userId) {
      await pool.query('DELETE FROM kite_sessions WHERE user_id = $1', [sessionState.userId]).catch(() => {});
    }
    res.status(401).json({ error: 'Session expired. Please login again.', connected: false, expired: true });
  } else {
    res.status(500).json({ error: error.message || 'Zerodha API error', details: error.error_type || undefined });
  }
}

export { router as zerodhaRouter };

