import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        exchange TEXT DEFAULT 'NSE',
        close NUMERIC DEFAULT 0,
        ticker TEXT NOT NULL,
        order_type TEXT DEFAULT 'BUY',
        product_type TEXT DEFAULT 'CNC',
        instrument_type TEXT DEFAULT 'EQ',
        quantity INTEGER DEFAULT 1,
        strategy TEXT DEFAULT '',
        code TEXT DEFAULT '',
        status TEXT DEFAULT 'PENDING',
        received_at TEXT NOT NULL,
        financials JSONB,
        analyst_recommendation JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS zerodha_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        ticker TEXT NOT NULL,
        exchange TEXT DEFAULT 'NSE',
        type TEXT NOT NULL,
        quantity INTEGER DEFAULT 0,
        price NUMERIC DEFAULT 0,
        timestamp TEXT,
        status TEXT DEFAULT 'COMPLETE',
        product_type TEXT DEFAULT 'CNC',
        instrument_type TEXT DEFAULT 'EQ',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS zerodha_holdings (
        id SERIAL PRIMARY KEY,
        ticker TEXT NOT NULL,
        exchange TEXT DEFAULT 'NSE',
        quantity INTEGER DEFAULT 0,
        average_price NUMERIC DEFAULT 0,
        last_price NUMERIC DEFAULT 0,
        pnl NUMERIC DEFAULT 0,
        day_change NUMERIC DEFAULT 0,
        day_change_percent NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS matched_trades (
        id TEXT PRIMARY KEY,
        alert_id TEXT,
        zerodha_order_id TEXT,
        ticker TEXT NOT NULL,
        match_type TEXT,
        direction TEXT,
        alert_quantity INTEGER DEFAULT 0,
        zerodha_quantity INTEGER DEFAULT 0,
        zerodha_price NUMERIC DEFAULT 0,
        alert_close NUMERIC DEFAULT 0,
        timestamp TEXT,
        pnl NUMERIC,
        status TEXT DEFAULT 'MATCHED',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pnl_entries (
        id SERIAL PRIMARY KEY,
        ticker TEXT NOT NULL,
        strategy TEXT DEFAULT '',
        realised_pnl NUMERIC DEFAULT 0,
        unrealised_pnl NUMERIC DEFAULT 0,
        total_invested NUMERIC DEFAULT 0,
        current_value NUMERIC DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        average_buy_price NUMERIC DEFAULT 0,
        last_price NUMERIC DEFAULT 0,
        actioned BOOLEAN DEFAULT false,
        trades INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS kite_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        access_token TEXT NOT NULL,
        public_token TEXT DEFAULT '',
        login_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ Database tables initialized');
  } catch (error: any) {
    console.error('[DB] ✗ Failed to initialize database:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

export { pool };

