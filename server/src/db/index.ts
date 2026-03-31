import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function initDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // Set timezone to IST for this session
    await client.query("SET timezone = 'Asia/Kolkata'");

    await client.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
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
        received_at TIMESTAMPTZ NOT NULL,
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
        timestamp TIMESTAMPTZ,
        status TEXT DEFAULT 'COMPLETE',
        product_type TEXT DEFAULT 'CNC',
        instrument_type TEXT DEFAULT 'EQ',
        account_type TEXT DEFAULT 'primary',
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
        account_type TEXT DEFAULT 'primary',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS matched_trades (
        id TEXT PRIMARY KEY,
        alert_id TEXT NOT NULL,
        zerodha_order_id TEXT NOT NULL,
        ticker TEXT NOT NULL,
        match_type TEXT,
        direction TEXT,
        alert_quantity INTEGER DEFAULT 0,
        zerodha_quantity INTEGER DEFAULT 0,
        zerodha_price NUMERIC DEFAULT 0,
        alert_close NUMERIC DEFAULT 0,
        timestamp TIMESTAMPTZ,
        pnl NUMERIC,
        status TEXT DEFAULT 'MATCHED',
        account_type TEXT DEFAULT 'primary',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(zerodha_order_id, account_type)
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
        account_type TEXT DEFAULT 'primary',
        login_time TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sync_metadata (
        id SERIAL PRIMARY KEY,
        account_type TEXT NOT NULL,
        last_order_sync_date DATE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(account_type)
      );
    `);

    // Migrations for existing DBs
    await client.query(`ALTER TABLE zerodha_orders ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'primary'`).catch(() => {});
    await client.query(`ALTER TABLE zerodha_holdings ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'primary'`).catch(() => {});
    await client.query(`ALTER TABLE matched_trades ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'primary'`).catch(() => {});
    await client.query(`ALTER TABLE kite_sessions ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'primary'`).catch(() => {});

    // Seed sync_metadata for both accounts
    await client.query(`INSERT INTO sync_metadata (account_type) VALUES ('primary') ON CONFLICT (account_type) DO NOTHING`).catch(() => {});
    await client.query(`INSERT INTO sync_metadata (account_type) VALUES ('secondary') ON CONFLICT (account_type) DO NOTHING`).catch(() => {});

    console.log('[DB] ✓ Database tables initialized (IST timezone)');
  } catch (error: any) {
    console.error('[DB] ✗ Failed to initialize database:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

// Helper: get current IST timestamp
export function nowIST(): string {
  return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false }).replace(',', '') + '+05:30';
}

// Helper: format date to IST string
export function toIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

export { pool };
