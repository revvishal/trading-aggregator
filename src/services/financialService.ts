import { QuarterlyFinancials, QuarterlyResult, AnalystRecommendation, AnalystRating } from '../types';

// Seed data for realistic Indian stocks
const STOCK_FUNDAMENTALS: Record<string, { baseRevenue: number; baseEps: number; baseEbitda: number; baseMargin: number; sector: string }> = {
  RELIANCE: { baseRevenue: 24500, baseEps: 35, baseEbitda: 4200, baseMargin: 17.1, sector: 'Energy' },
  TCS: { baseRevenue: 6200, baseEps: 12, baseEbitda: 1800, baseMargin: 29.0, sector: 'IT' },
  INFY: { baseRevenue: 4100, baseEps: 16, baseEbitda: 1200, baseMargin: 29.3, sector: 'IT' },
  HDFCBANK: { baseRevenue: 5800, baseEps: 22, baseEbitda: 3200, baseMargin: 55.2, sector: 'Banking' },
  ICICIBANK: { baseRevenue: 4500, baseEps: 15, baseEbitda: 2500, baseMargin: 55.6, sector: 'Banking' },
  SBIN: { baseRevenue: 5200, baseEps: 8, baseEbitda: 2800, baseMargin: 53.8, sector: 'Banking' },
  WIPRO: { baseRevenue: 2300, baseEps: 6, baseEbitda: 500, baseMargin: 21.7, sector: 'IT' },
  TATAMOTORS: { baseRevenue: 11000, baseEps: 18, baseEbitda: 1600, baseMargin: 14.5, sector: 'Auto' },
  BHARTIARTL: { baseRevenue: 4000, baseEps: 10, baseEbitda: 2100, baseMargin: 52.5, sector: 'Telecom' },
  MARUTI: { baseRevenue: 3800, baseEps: 90, baseEbitda: 500, baseMargin: 13.2, sector: 'Auto' },
  SUNPHARMA: { baseRevenue: 1200, baseEps: 14, baseEbitda: 380, baseMargin: 31.7, sector: 'Pharma' },
  HCLTECH: { baseRevenue: 2900, baseEps: 15, baseEbitda: 870, baseMargin: 30.0, sector: 'IT' },
  LT: { baseRevenue: 5500, baseEps: 32, baseEbitda: 900, baseMargin: 16.4, sector: 'Infra' },
  ASIANPAINT: { baseRevenue: 900, baseEps: 10, baseEbitda: 200, baseMargin: 22.2, sector: 'FMCG' },
  TITAN: { baseRevenue: 1200, baseEps: 8, baseEbitda: 160, baseMargin: 13.3, sector: 'Consumer' },
};

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
  const baseDate = new Date(2025, 2, 28); // Mar 28, 2025
  for (let i = 0; i < 4; i++) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + (i * 3));
    const day = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(d.getDate(), day));
    quarters.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }));
  }
  return quarters;
}

export function getFinancialData(ticker: string): Promise<QuarterlyFinancials> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const upperTicker = ticker.toUpperCase();
      const stock = STOCK_FUNDAMENTALS[upperTicker];
      const rng = seededRandom(upperTicker);
      const quarters = generateQuarters();

      const baseRevenue = stock ? stock.baseRevenue : 1000 + rng() * 5000;
      const baseEps = stock ? stock.baseEps : 5 + rng() * 60;
      const baseEbitda = stock ? stock.baseEbitda : 100 + rng() * 2000;
      const baseMargin = stock ? stock.baseMargin : 5 + rng() * 30;

      const results: QuarterlyResult[] = quarters.map((q, i) => {
        const growth = 1 + (rng() - 0.3) * 0.3;
        const seasonality = 1 + Math.sin((i * Math.PI) / 2) * 0.1;
        return {
          quarter: q,
          revenue: parseFloat((baseRevenue * growth * seasonality / 100).toFixed(2)),
          revenueChange: parseFloat(((growth - 1) * 100).toFixed(2)),
          epsYoY: parseFloat((baseEps * (0.8 + rng() * 0.6)).toFixed(2)),
          ebitda: parseFloat((baseEbitda * growth * seasonality / 10).toFixed(2)),
          opMargin: parseFloat((baseMargin * (0.85 + rng() * 0.3)).toFixed(2)),
        };
      });

      resolve({
        ticker: upperTicker,
        quarters: results,
        fetchedAt: new Date().toISOString(),
      });
    }, 300 + Math.random() * 500);
  });
}

export function getAnalystRecommendation(ticker: string): Promise<AnalystRecommendation> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const upperTicker = ticker.toUpperCase();
      const rng = seededRandom(upperTicker + '_analyst');
      const numAnalysts = 5 + Math.floor(rng() * 11);

      const ratings: AnalystRating[] = [];
      const ratingScores: number[] = [];

      const shuffledFirms = [...ANALYST_FIRMS].sort(() => rng() - 0.5).slice(0, numAnalysts);

      for (let i = 0; i < numAnalysts; i++) {
        // Bias towards Buy/Hold
        const ratingWeights = [0.2, 0.35, 0.25, 0.12, 0.08];
        let cumulative = 0;
        const r = rng();
        let ratingIdx = 2;
        for (let j = 0; j < ratingWeights.length; j++) {
          cumulative += ratingWeights[j];
          if (r <= cumulative) {
            ratingIdx = j;
            break;
          }
        }
        const rating = RATINGS[ratingIdx];
        const score = 5 - ratingIdx;
        ratingScores.push(score);

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

      resolve({
        ticker: upperTicker,
        ratings,
        consolidatedScore: parseFloat(avgScore.toFixed(2)),
        consolidatedRating,
        totalAnalysts: numAnalysts,
      });
    }, 200 + Math.random() * 400);
  });
}

