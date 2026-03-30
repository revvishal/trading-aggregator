import { Router, Request, Response } from 'express';

// kiteconnect uses CommonJS default export
// eslint-disable-next-line @typescript-eslint/no-var-requires
const KiteConnect = require('kiteconnect').KiteConnect;

const router: ReturnType<typeof Router> = Router();

const KITE_API_KEY = process.env.KITE_API_KEY || '';
const KITE_API_SECRET = process.env.KITE_API_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Kite Connect instance — persisted across requests
let kite = new KiteConnect({ api_key: KITE_API_KEY });

// Store session state
let sessionState = {
  accessToken: '',
  publicToken: '',
  userId: '',
  loginTime: '',
  isConnected: false,
};

/**
 * GET /api/zerodha/status
 * Check if Zerodha Kite is connected (has valid access token)
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    connected: sessionState.isConnected,
    userId: sessionState.userId,
    loginTime: sessionState.loginTime,
    apiKeyConfigured: !!KITE_API_KEY && KITE_API_KEY !== 'your_api_key_here',
  });
});

/**
 * GET /api/zerodha/login
 * Redirects user to Kite Connect login page.
 * After login, Kite redirects back to /api/zerodha/callback
 */
router.get('/login', (_req: Request, res: Response) => {
  if (!KITE_API_KEY || KITE_API_KEY === 'your_api_key_here') {
    res.status(400).json({
      error: 'KITE_API_KEY not configured. Set it in server/.env file.',
    });
    return;
  }

  const loginUrl = kite.getLoginURL();
  console.log(`[ZERODHA] Redirecting to Kite login: ${loginUrl}`);
  res.redirect(loginUrl);
});

/**
 * GET /api/zerodha/callback
 * Handles the redirect from Kite Connect after user login.
 * Exchanges request_token for access_token.
 */
router.get('/callback', async (req: Request, res: Response) => {
  const requestToken = req.query.request_token as string;
  const status = req.query.status as string;

  if (status !== 'success' || !requestToken) {
    console.error('[ZERODHA] Login failed or cancelled. Status:', status);
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&message=Login+failed+or+cancelled`);
    return;
  }

  try {
    console.log('[ZERODHA] Exchanging request_token for access_token...');

    const session = await kite.generateSession(requestToken, KITE_API_SECRET);

    sessionState = {
      accessToken: session.access_token,
      publicToken: session.public_token || '',
      userId: session.user_id || '',
      loginTime: new Date().toISOString(),
      isConnected: true,
    };

    // Set access token on the kite instance for subsequent API calls
    kite.setAccessToken(session.access_token);

    console.log(`[ZERODHA] ✓ Connected as ${sessionState.userId}`);

    // Redirect back to frontend with success status
    res.redirect(`${FRONTEND_URL}?zerodha_status=success&user=${sessionState.userId}`);
  } catch (error: any) {
    console.error('[ZERODHA] Token exchange failed:', error.message || error);
    sessionState.isConnected = false;
    res.redirect(`${FRONTEND_URL}?zerodha_status=error&message=${encodeURIComponent(error.message || 'Token exchange failed')}`);
  }
});

/**
 * POST /api/zerodha/disconnect
 * Clear the stored session / access token
 */
router.post('/disconnect', (_req: Request, res: Response) => {
  sessionState = {
    accessToken: '',
    publicToken: '',
    userId: '',
    loginTime: '',
    isConnected: false,
  };
  // Re-create kite instance without access token
  kite = new KiteConnect({ api_key: KITE_API_KEY });
  console.log('[ZERODHA] Disconnected');
  res.json({ success: true });
});

// ==========================================
// Middleware: Check connection before API calls
// ==========================================
function requireConnection(req: Request, res: Response, next: Function) {
  if (!sessionState.isConnected || !sessionState.accessToken) {
    res.status(401).json({
      error: 'Not connected to Zerodha. Please login first.',
      connected: false,
    });
    return;
  }
  next();
}

/**
 * GET /api/zerodha/orders
 * Fetch today's orders from Zerodha
 */
router.get('/orders', requireConnection, async (_req: Request, res: Response) => {
  try {
    const orders = await kite.getOrders();

    // Map Kite order format to our ZerodhaOrder format
    const mapped = orders.map((order: any) => ({
      id: order.order_id,
      orderId: order.order_id,
      ticker: order.tradingsymbol,
      exchange: order.exchange,
      type: order.transaction_type, // BUY or SELL
      quantity: order.quantity,
      price: order.average_price || order.price || 0,
      timestamp: order.order_timestamp || order.exchange_timestamp || new Date().toISOString(),
      status: order.status, // COMPLETE, OPEN, CANCELLED, REJECTED
      productType: order.product, // CNC, MIS, NRML
      instrumentType: order.instrument_type || 'EQ',
    }));

    console.log(`[ZERODHA] Fetched ${mapped.length} orders`);
    res.json({ orders: mapped, count: mapped.length });
  } catch (error: any) {
    console.error('[ZERODHA] Error fetching orders:', error.message || error);
    handleKiteError(error, res);
  }
});

/**
 * GET /api/zerodha/holdings
 * Fetch portfolio holdings from Zerodha
 */
router.get('/holdings', requireConnection, async (_req: Request, res: Response) => {
  try {
    const holdings = await kite.getHoldings();

    const mapped = holdings.map((h: any) => ({
      ticker: h.tradingsymbol,
      exchange: h.exchange,
      quantity: h.quantity,
      averagePrice: h.average_price,
      lastPrice: h.last_price,
      pnl: h.pnl,
      dayChange: h.day_change,
      dayChangePercent: h.day_change_percentage,
    }));

    console.log(`[ZERODHA] Fetched ${mapped.length} holdings`);
    res.json({ holdings: mapped, count: mapped.length });
  } catch (error: any) {
    console.error('[ZERODHA] Error fetching holdings:', error.message || error);
    handleKiteError(error, res);
  }
});

/**
 * GET /api/zerodha/positions
 * Fetch day/net positions from Zerodha
 */
router.get('/positions', requireConnection, async (_req: Request, res: Response) => {
  try {
    const positions = await kite.getPositions();

    const mapped = {
      net: (positions.net || []).map((p: any) => ({
        ticker: p.tradingsymbol,
        exchange: p.exchange,
        quantity: p.quantity,
        averagePrice: p.average_price,
        lastPrice: p.last_price,
        pnl: p.pnl,
        buyQuantity: p.buy_quantity,
        sellQuantity: p.sell_quantity,
        buyPrice: p.buy_price,
        sellPrice: p.sell_price,
        product: p.product,
      })),
      day: (positions.day || []).map((p: any) => ({
        ticker: p.tradingsymbol,
        exchange: p.exchange,
        quantity: p.quantity,
        averagePrice: p.average_price,
        lastPrice: p.last_price,
        pnl: p.pnl,
        buyQuantity: p.buy_quantity,
        sellQuantity: p.sell_quantity,
        buyPrice: p.buy_price,
        sellPrice: p.sell_price,
        product: p.product,
      })),
    };

    console.log(`[ZERODHA] Fetched ${mapped.net.length} net, ${mapped.day.length} day positions`);
    res.json({ positions: mapped });
  } catch (error: any) {
    console.error('[ZERODHA] Error fetching positions:', error.message || error);
    handleKiteError(error, res);
  }
});

/**
 * GET /api/zerodha/profile
 * Fetch user profile from Zerodha
 */
router.get('/profile', requireConnection, async (_req: Request, res: Response) => {
  try {
    const profile = await kite.getProfile();
    res.json({ profile });
  } catch (error: any) {
    console.error('[ZERODHA] Error fetching profile:', error.message || error);
    handleKiteError(error, res);
  }
});

/**
 * Handle Kite API errors — detect token expiry
 */
function handleKiteError(error: any, res: Response) {
  if (error.status === 403 || error.error_type === 'TokenException') {
    sessionState.isConnected = false;
    res.status(401).json({
      error: 'Session expired. Please login again.',
      connected: false,
      expired: true,
    });
  } else {
    res.status(500).json({
      error: error.message || 'Zerodha API error',
      details: error.error_type || undefined,
    });
  }
}

export { router as zerodhaRouter };



