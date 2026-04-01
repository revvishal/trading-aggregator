import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './db';
import { authRouter } from './routes/auth';
import { authMiddleware } from './middleware/auth';
import { webhookRouter } from './routes/webhook';
import { zerodhaRouter } from './routes/zerodha';
import { dataRouter } from './routes/data';
import { financialsRouter } from './routes/financials';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const REACT_APP_API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Middleware
app.use(cors({
  origin: [FRONTEND_URL, /\.vercel\.app$/],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Webhook POST is authenticated via WEBHOOK_SECRET (not JWT)
// Webhook GET/DELETE need JWT
app.post('/api/webhook', webhookRouter);
app.use('/api/webhook', webhookRouter);

// Zerodha login/callback are public (OAuth redirects), rest need JWT
app.get('/api/zerodha/login', (req, res, next) => { zerodhaRouter(req, res, next); });
app.get('/api/zerodha/callback', (req, res, next) => { zerodhaRouter(req, res, next); });
app.use('/api/zerodha', zerodhaRouter);

// Data CRUD routes (all need JWT)
app.use('/api/data', authMiddleware, dataRouter);

// Financials cache routes (need JWT)
app.use('/api/financials', authMiddleware, financialsRouter);

// Initialize DB and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Trading Aggregator Server running on port ${PORT}`);
      console.log(`   Health: ${REACT_APP_API_URL}/api/health`);
      console.log(`   Webhook: POST ${REACT_APP_API_URL}/api/webhook`);
      console.log(`   Zerodha Login: ${REACT_APP_API_URL}/api/zerodha/login`);
      console.log(`\n   Frontend: ${FRONTEND_URL}`);
      console.log(`   Database: ${process.env.DATABASE_URL ? '✓ configured' : '✗ not set'}`);
      console.log(`   KITE_API_KEY: ${process.env.KITE_API_KEY ? '✓ configured' : '✗ not set'}`);
      console.log(`   Auth: ${process.env.APP_USERNAME ? '✓ configured' : '✗ not set'}\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
