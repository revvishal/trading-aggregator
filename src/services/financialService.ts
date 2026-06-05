import { QuarterlyFinancials, AnalystRecommendation } from '../types';
import { fetchTickerFinancials } from './apiService';

/**
 * Get financial data for a ticker from DB cache.
 * Returns null if no data is stored for this ticker.
 */
export async function getFinancialData(ticker: string): Promise<QuarterlyFinancials | null> {
  try {
    const cached = await fetchTickerFinancials(ticker);
    if (cached.financials) {
      return cached.financials;
    }
  } catch {
    // Cache unavailable
  }
  return null;
}

/**
 * Get analyst recommendation for a ticker from DB cache.
 * Returns null if no data is stored for this ticker.
 */
export async function getAnalystRecommendation(ticker: string): Promise<AnalystRecommendation | null> {
  try {
    const cached = await fetchTickerFinancials(ticker);
    if (cached.analystRecommendation) {
      return cached.analystRecommendation;
    }
  } catch {
    // Cache unavailable
  }
  return null;
}
