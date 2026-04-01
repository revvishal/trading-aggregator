import { QuarterlyFinancials, QuarterlyResult, AnalystRecommendation, AnalystRating } from '../types';
import { fetchTickerFinancials, saveTickerFinancials } from './apiService';

const ANALYST_FIRMS = [
  'Morgan Stanley', 'Goldman Sachs', 'JP Morgan', 'CLSA', 'Nomura',
  'Credit Suisse', 'Motilal Oswal', 'ICICI Securities', 'Kotak Securities',
  'Jefferies', 'Citi', 'UBS', 'BofA Securities', 'HDFC Securities', 'Axis Securities'
];

const RATINGS: Array<'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell'> = [
  'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
];

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return () => {
    hash = (hash * 16807 + 12345) & 0x7fffffff;
    return (hash % 10000) / 10000;
  };
}

function generateQuarters(): string[] {
  const quarters: string[] = [];
  const now = new Date();
  // Generate last 4 quarters ending before current date
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - (i * 3));
    // End of quarter month
    const qEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    quarters.push(qEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }));
  }
  return quarters;
}

function generateFinancialData(ticker: string): QuarterlyFinancials {
  const upperTicker = ticker.toUpperCase();
  const rng = seededRandom(upperTicker);
  const quarters = generateQuarters();

  const baseRevenue = 1000 + rng() * 5000;
  const baseEps = 5 + rng() * 60;
  const baseEbitda = 100 + rng() * 2000;
  const baseMargin = 5 + rng() * 30;

  const results: QuarterlyResult[] = quarters.map((q, i) => {
    const growth = 1 + (rng() - 0.3) * 0.3;
    const seasonality = 1 + Math.sin((i * Math.PI) / 2) * 0.1;
    const prevRevenue = i > 0 ? baseRevenue * (1 + (rng() - 0.3) * 0.3) * (1 + Math.sin(((i - 1) * Math.PI) / 2) * 0.1) / 100 : 0;
    const currentRevenue = baseRevenue * growth * seasonality / 100;
    const revenueChangeQoQ = i > 0 && prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    return {
      quarter: q,
      revenue: parseFloat(currentRevenue.toFixed(2)),
      revenueChange: parseFloat(revenueChangeQoQ.toFixed(2)),
      epsYoY: parseFloat((baseEps * (0.8 + rng() * 0.6)).toFixed(2)),
      ebitda: parseFloat((baseEbitda * growth * seasonality / 10).toFixed(2)),
      opMargin: parseFloat((baseMargin * (0.85 + rng() * 0.3)).toFixed(2)),
    };
  });

  return {
    ticker: upperTicker,
    quarters: results,
    fetchedAt: new Date().toISOString(),
  };
}

function generateAnalystRecommendation(ticker: string): AnalystRecommendation {
  const upperTicker = ticker.toUpperCase();
  const rng = seededRandom(upperTicker + '_analyst');
  const numAnalysts = 5 + Math.floor(rng() * 11);

  const ratings: AnalystRating[] = [];
  const ratingScores: number[] = [];
  const shuffledFirms = [...ANALYST_FIRMS].sort(() => rng() - 0.5).slice(0, numAnalysts);

  for (let i = 0; i < numAnalysts; i++) {
    const ratingWeights = [0.2, 0.35, 0.25, 0.12, 0.08];
    let cumulative = 0;
    const r = rng();
    let ratingIdx = 2;
    for (let j = 0; j < ratingWeights.length; j++) {
      cumulative += ratingWeights[j];
      if (r <= cumulative) { ratingIdx = j; break; }
    }
    const rating = RATINGS[ratingIdx];
    ratingScores.push(5 - ratingIdx);

    const basePrice = 500 + rng() * 3000;
    ratings.push({
      firm: shuffledFirms[i],
      rating,
      targetPrice: parseFloat((basePrice * (0.9 + rng() * 0.4)).toFixed(2)),
      date: new Date(2025, Math.floor(rng() * 12), 1 + Math.floor(rng() * 28)).toISOString().split('T')[0],
    });
  }

  const avgScore = ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length;
  let consolidatedRating: string;
  if (avgScore >= 4.5) consolidatedRating = 'Strong Buy';
  else if (avgScore >= 3.5) consolidatedRating = 'Buy';
  else if (avgScore >= 2.5) consolidatedRating = 'Hold';
  else if (avgScore >= 1.5) consolidatedRating = 'Sell';
  else consolidatedRating = 'Strong Sell';

  return {
    ticker: upperTicker,
    ratings,
    consolidatedScore: parseFloat(avgScore.toFixed(2)),
    consolidatedRating,
    totalAnalysts: numAnalysts,
  };
}

/**
 * Get financial data for a ticker.
 * 1. Check DB cache first
 * 2. If not cached or stale, generate and save to DB
 */
export async function getFinancialData(ticker: string): Promise<QuarterlyFinancials> {
  try {
    const cached = await fetchTickerFinancials(ticker);
    if (cached.financials && !cached.stale) {
      return cached.financials;
    }
  } catch {
    // Cache unavailable, generate fresh
  }

  const financials = generateFinancialData(ticker);

  // Save to DB cache (fire and forget)
  try {
    const recommendation = generateAnalystRecommendation(ticker);
    await saveTickerFinancials(ticker, financials, recommendation);
  } catch { /* ignore cache save errors */ }

  return financials;
}

/**
 * Get analyst recommendation for a ticker.
 * 1. Check DB cache first
 * 2. If not cached or stale, generate and save to DB
 */
export async function getAnalystRecommendation(ticker: string): Promise<AnalystRecommendation> {
  try {
    const cached = await fetchTickerFinancials(ticker);
    if (cached.analystRecommendation && !cached.stale) {
      return cached.analystRecommendation;
    }
  } catch {
    // Cache unavailable, generate fresh
  }

  const recommendation = generateAnalystRecommendation(ticker);

  // Save to DB cache (fire and forget)
  try {
    const financials = generateFinancialData(ticker);
    await saveTickerFinancials(ticker, financials, recommendation);
  } catch { /* ignore cache save errors */ }

  return recommendation;
}
