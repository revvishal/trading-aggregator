import { Router, Request, Response } from 'express';
import { pool } from '../db';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const KiteConnect = require('kiteconnect').KiteConnect;

const router: ReturnType<typeof Router> = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ==========================================
// Dual-account Kite Connect management
// ==========================================

interface AccountConfig {
  apiKey: string;
  apiSecret: string;
  label: string;
}

interface AccountSession {
  kite: any;
  accessToken: string;
  publicToken: string;
  userId: string;
  loginTime: string;
  isConnected: boolean;
}

const ACCOUNTS: Record<string, AccountConfig> = {
  primary: {
    apiKey: process.env.KITE_API_KEY || '',
    apiSecret: process.env.KITE_API_SECRET || '',
    label: 'Primary',
  },
  secondary: {
    apiKey: process.env.SECONDARY_KITE_API_KEY || '',
    apiSecret: process.env.SECONDARY_KITE_API_SECRET || '',
    label: 'Secondary',
  },
};

const sessions: Record<string, AccountSession> = {
  primary: {
    kite: new KiteConnect({ api_key: ACCOUNTS.primary.apiKey }),
    accessToken: '', publicToken: '', userId: '', loginTime: '', isConnected: false,
  },
  secondary: {
    kite: new KiteConnect({ api_key: ACCOUNTS.secondary.apiKey }),
    accessToken: '', publicToken: '', userId: '', loginTime: '', isConnected: false,
  },
};

function getAccountType(req: Request): string {
  const account = (req.query.account as string || 'primary').toLowerCase();
  return account === 'secondary' ? 'secondary' : 'primary';
}

function getAccountConfig(accountType: string): AccountConfig {
  return ACCOUNTS[accountType] || ACCOUNTS.primary;
}

function getSession(accountType: string): AccountSession {
  return sessions[accountType] || sessions.primary;
}

// ==========================================
// Restore session from DB
// ==========================================

async function restoreSessionFromDb(accountType: string): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT * FROM kite_sessions WHERE account_type = $1 ORDER BY login_time DESC LIMIT 1',
      [accountType]
    );
    if (result.rows.length === 0) return false;

    const row = result.rows[0];
    const loginTime = new Date(row.login_time);
    const now = new Date();

    const istOffset = 5.5 * 60 * 60 * 1000;
    const loginIST = new Date(loginTime.getTime() + istOffset);
    const nowIST = new Date(now.getTime() + istOffset);
    const sameDay = loginIST.toDateString() === nowIST.toDateString();
    const withinHours = (now.getTime() - loginTime.getTime()) < 24 * 60 * 60 * 1000;

    if (sameDay || withinHours) {
      const session = getSession(accountType);
      session.accessToken = row.access_token;
      session.publicToken = row.public_token || '';
      session.userId = row.user_id;
      session.loginTime = row.login_time.toISOString();
      session.isConnected = true;
      session.kite.setAccessToken(row.access_token);
      console.log(`[ZERODHA:${accountType}] ✓ Restored session for ${row.user_id} from DB`);
      return true;
    } else {
      await pool.query('DELETE FROM kite_sessions WHERE id = $1', [row.id]);
      console.log(`[ZERODHA:${accountType}] Stale session removed from DB`);
      return false;
    }
  } catch (err: any) {
    console.error(`[ZERODHA:${accountType}] Error restoring session:`, err.message);
    return false;
  }
}

// Try to restore both accounts on module load
restoreSessionFromDb('primary');
restoreSessionFromDb('secondary');

// ==========================================
// Routes
// ==========================================

router.get('/status', async (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  const session = getSession(accountType);
  const config = getAccountConfig(accountType);

  if (!session.isConnected) {
    await restoreSessionFromDb(accountType);
  }

  res.json({
    account: accountType,
    connected: session.isConnected,
    userId: session.userId,
    loginTime: session.loginTime,
    apiKeyConfigured: !!config.apiKey && config.apiKey !== 'your_api_key_here',
  });
});

// Combined status for both accounts
router.get('/status/all', async (_req: Request, res: Response) => {
  if (!sessions.primary.isConnected) await restoreSessionFromDb('primary');
  if (!sessions.secondary.isConnected) await restoreSessionFromDb('secondary');

  res.json({
    primary: {
      connected: sessions.primary.isConnected,
      userId: sessions.primary.userId,
      loginTime: sessions.primary.loginTime,
      apiKeyConfigured: !!ACCOUNTS.primary.apiKey && ACCOUNTS.primary.apiKey !== 'your_api_key_here',
    },
    secondary: {
      connected: sessions.secondary.isConnected,
      userId: sessions.secondary.userId,
      loginTime: sessions.secondary.loginTime,
      apiKeyConfigured: !!ACCOUNTS.secondary.apiKey && ACCOUNTS.secondary.apiKey !== 'your_api_key_here',
    },
  });
});

router.get('/login', (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  const config = getAccountConfig(accountType);
  const session = getSession(accountType);

  if (!config.apiKey || config.apiKey === 'your_api_key_here') {
    res.status(400).json({ error: `${config.label} KITE_API_KEY not configured.` });
    return;
  }

  // Re-create kite instance to ensure correct api_key is used for login URL
  session.kite = new KiteConnect({ api_key: config.apiKey });
  const loginUrl = session.kite.getLoginURL();
  console.log(`[ZERODHA:${accountType}] Redirecting to Kite login: ${loginUrl}`);
  // Pass account type through state param so callback knows which account
  res.redirect(`${loginUrl}&state=${accountType}`);
});

router.get('/callback', async (req: Request, res: Response) => {
  const requestToken = req.query.request_token as string;
  const status = req.query.status as string;
  const accountType = (req.query.state as string || 'primary').toLowerCase() === 'secondary' ? 'secondary' : 'primary';
  console.log(`[ZERODHA: callback recieved ${accountType} , ${requestToken} , ${status}] `);
  if (status !== 'success' || !requestToken) {
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&account=${accountType}&message=Login+failed+or+cancelled`);
    return;
  }

  const config = getAccountConfig(accountType);
  const session = getSession(accountType);

  try {
    const kiteSession = await session.kite.generateSession(requestToken, config.apiSecret);

    session.accessToken = kiteSession.access_token;
    session.publicToken = kiteSession.public_token || '';
    session.userId = kiteSession.user_id || '';
    session.loginTime = new Date().toISOString();
    session.isConnected = true;
    session.kite.setAccessToken(kiteSession.access_token);

    // Persist session to DB
    await pool.query('DELETE FROM kite_sessions WHERE account_type = $1', [accountType]);
    await pool.query(
      'INSERT INTO kite_sessions (user_id, access_token, public_token, account_type, login_time) VALUES ($1, $2, $3, $4, $5)',
      [session.userId, session.accessToken, session.publicToken, accountType, session.loginTime]
    );

    console.log(`[ZERODHA:${accountType}] ✓ Connected as ${session.userId} — session persisted`);
    res.redirect(`${FRONTEND_URL}?zerodha_status=success&account=${accountType}&user=${session.userId}`);
  } catch (error: any) {
    console.error(`[ZERODHA:${accountType}] Token exchange failed:`, error.message || error);
    session.isConnected = false;
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&account=${accountType}&message=${encodeURIComponent(error.message || 'Token exchange failed')}`);
  }
});

router.post('/disconnect', async (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  const session = getSession(accountType);
  const config = getAccountConfig(accountType);

  if (session.userId) {
    await pool.query('DELETE FROM kite_sessions WHERE account_type = $1', [accountType]).catch(() => {});
  }
  session.accessToken = '';
  session.publicToken = '';
  session.userId = '';
  session.loginTime = '';
  session.isConnected = false;
  session.kite = new KiteConnect({ api_key: config.apiKey });

  console.log(`[ZERODHA:${accountType}] Disconnected — session removed from DB`);
  res.json({ success: true });
});

function requireConnection(req: Request, res: Response, next: Function) {
  const accountType = getAccountType(req);
  const session = getSession(accountType);
  if (!session.isConnected || !session.accessToken) {
    res.status(401).json({ error: `Not connected to Zerodha (${accountType}).`, connected: false });
    return;
  }
  next();
}

router.get('/orders', requireConnection, async (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  const session = getSession(accountType);

  try {
    // Kite getOrders() returns today's completed orders.
    // Historical order history is built incrementally by syncing daily.
    // Don't have option , need to go for paid version of Kite and bit completed integration. Can live with it for now.
    const allOrders = await session.kite.getOrders();

    const mapped = allOrders
      .filter((order: any) => order.status === 'COMPLETE')
      .map((order: any) => ({
        id: `${accountType}_${order.order_id}`,
        orderId: order.order_id,
        ticker: order.tradingsymbol,
        exchange: order.exchange,
        type: order.transaction_type,
        quantity: order.quantity,
        price: order.average_price || order.price || 0,
        timestamp: order.order_timestamp || order.exchange_timestamp || new Date().toISOString(),
        status: order.status,
        productType: order.product,
        instrumentType: order.instrument_type || 'EQ',
        accountType,
      }));

    // Store orders in DB (upsert - don't duplicate)
    for (const o of mapped) {
      await pool.query(
        `INSERT INTO zerodha_orders (id, order_id, ticker, exchange, type, quantity, price, timestamp, status, product_type, instrument_type, account_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, status = EXCLUDED.status, timestamp = EXCLUDED.timestamp`,
        [o.id, o.orderId, o.ticker, o.exchange, o.type, o.quantity, o.price, o.timestamp, o.status, o.productType, o.instrumentType, o.accountType]
      ).catch(() => {});
    }

    // Update last sync date
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    await pool.query(
      `UPDATE sync_metadata SET last_order_sync_date = $1, updated_at = NOW() WHERE account_type = $2`,
      [todayIST, accountType]
    ).catch(() => {});

    // Return ALL orders for this account from DB
    const dbResult = await pool.query(
      'SELECT * FROM zerodha_orders WHERE account_type = $1 ORDER BY timestamp DESC',
      [accountType]
    );
    const dbOrders = dbResult.rows.map((row: any) => ({
      id: row.id, orderId: row.order_id, ticker: row.ticker, exchange: row.exchange,
      type: row.type, quantity: row.quantity, price: parseFloat(row.price),
      timestamp: row.timestamp, status: row.status, productType: row.product_type,
      instrumentType: row.instrument_type, accountType: row.account_type,
    }));

    console.log(`[ZERODHA:${accountType}] Synced ${mapped.length} new, total ${dbOrders.length} orders`);
    res.json({ orders: dbOrders, count: dbOrders.length, newCount: mapped.length });
  } catch (error: any) {
    handleKiteError(error, res, accountType);
  }
});

// GET sync metadata (last sync date)
router.get('/sync-meta', async (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  try {
    const result = await pool.query('SELECT * FROM sync_metadata WHERE account_type = $1', [accountType]);
    if (result.rows.length > 0) {
      res.json({
        accountType,
        lastOrderSyncDate: result.rows[0].last_order_sync_date,
        updatedAt: result.rows[0].updated_at,
      });
    } else {
      res.json({ accountType, lastOrderSyncDate: null, updatedAt: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/holdings', requireConnection, async (req: Request, res: Response) => {
  const accountType = getAccountType(req);
  const session = getSession(accountType);
  try {
    const holdings = await session.kite.getHoldings();
    const mapped = holdings.map((h: any) => ({
      ticker: h.tradingsymbol, exchange: h.exchange, quantity: h.quantity, averagePrice: h.average_price,
      lastPrice: h.last_price, pnl: h.pnl, dayChange: h.day_change, dayChangePercent: h.day_change_percentage,
      accountType,
    }));

    // Replace holdings for this account in DB
    await pool.query('DELETE FROM zerodha_holdings WHERE account_type = $1', [accountType]);
    for (const h of mapped) {
      await pool.query(
        `INSERT INTO zerodha_holdings (ticker, exchange, quantity, average_price, last_price, pnl, day_change, day_change_percent, account_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [h.ticker, h.exchange, h.quantity, h.averagePrice, h.lastPrice, h.pnl, h.dayChange, h.dayChangePercent, h.accountType]
      ).catch(() => {});
    }

    res.json({ holdings: mapped, count: mapped.length });
  } catch (error: any) {
    handleKiteError(error, res, accountType);
  }
});

router.get('/positions', requireConnection, async (req: Request, res: Response) => {
  const session = getSession(getAccountType(req));
  try {
    const positions = await session.kite.getPositions();
    const mapPos = (p: any) => ({
      ticker: p.tradingsymbol, exchange: p.exchange, quantity: p.quantity, averagePrice: p.average_price,
      lastPrice: p.last_price, pnl: p.pnl, buyQuantity: p.buy_quantity, sellQuantity: p.sell_quantity,
      buyPrice: p.buy_price, sellPrice: p.sell_price, product: p.product,
    });
    res.json({ positions: { net: (positions.net || []).map(mapPos), day: (positions.day || []).map(mapPos) } });
  } catch (error: any) {
    handleKiteError(error, res, getAccountType(req));
  }
});

router.get('/profile', requireConnection, async (req: Request, res: Response) => {
  const session = getSession(getAccountType(req));
  try {
    const profile = await session.kite.getProfile();
    res.json({ profile });
  } catch (error: any) {
    handleKiteError(error, res, getAccountType(req));
  }
});

async function handleKiteError(error: any, res: Response, accountType: string) {
  if (error.status === 403 || error.error_type === 'TokenException') {
    const session = getSession(accountType);
    session.isConnected = false;
    if (session.userId) {
      await pool.query('DELETE FROM kite_sessions WHERE account_type = $1', [accountType]).catch(() => {});
    }
    res.status(401).json({ error: 'Session expired. Please login again.', connected: false, expired: true });
  } else {
    res.status(500).json({ error: error.message || 'Zerodha API error', details: error.error_type || undefined });
  }
}

export { router as zerodhaRouter };

