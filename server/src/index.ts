import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { webhookRouter } from './routes/webhook';
import { zerodhaRouter } from './routes/zerodha';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/webhook', webhookRouter);
app.use('/api/zerodha', zerodhaRouter);

app.listen(PORT, () => {
  console.log(`\n🚀 Trading Aggregator Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Webhook: POST http://localhost:${PORT}/api/webhook`);
  console.log(`   Zerodha Login: http://localhost:${PORT}/api/zerodha/login`);
  console.log(`\n   Frontend: ${FRONTEND_URL}`);
  console.log(`   KITE_API_KEY: ${process.env.KITE_API_KEY ? '✓ configured' : '✗ not set'}`);
  console.log(`   WEBHOOK_SECRET: ${process.env.WEBHOOK_SECRET ? '✓ configured' : '✗ not set (open)'}\n`);
});
