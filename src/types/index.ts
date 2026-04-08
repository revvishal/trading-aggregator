export type OrderType = 'ADD' | 'REMOVE' | 'BUY' | 'SELL';

export interface TradingViewAlert {
  id: string;
  timestamp: string;
  Exchange: string;
  Close: number;
  Ticker: string;
  OrderType: OrderType;
  ProductType: string;
  InstrumentType: string;
  Quantity: number;
  Strategy: string;
  Code: string;
  status: 'PENDING' | 'ACTIONED' | 'IGNORED';
  financials?: QuarterlyFinancials;
  analystRecommendation?: AnalystRecommendation;
}

export interface QuarterlyResult {
  quarter: string;
  revenue: number;
  revenueChange: number;
  epsYoY: number;
  ebitda: number;
  opMargin: number;
}

export interface QuarterlyFinancials {
  ticker: string;
  company?: string;
  quarters: QuarterlyResult[];
  summary?: string;
  fetchedAt: string;
}

export interface AnalystRating {
  firm: string;
  rating: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
  targetPrice: number;
  date: string;
}

export interface AnalystRecommendation {
  ticker: string;
  ratings: AnalystRating[];
  consolidatedScore: number; // 1-5, 5=Strong Buy
  consolidatedRating: string;
  totalAnalysts: number;
}

export interface ZerodhaOrder {
  id: string;
  orderId: string;
  ticker: string;
  exchange: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  timestamp: string;
  status: 'COMPLETE' | 'OPEN' | 'CANCELLED' | 'REJECTED';
  productType: string;
  instrumentType: string;
  accountType?: string;
}

export interface ZerodhaHolding {
  ticker: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  lastPrice: number;
  pnl: number;
  dayChange: number;
  dayChangePercent: number;
  accountType?: string;
}

export interface MatchedTrade {
  id: string;
  alertId: string;
  zerodhaOrderId: string;
  ticker: string;
  matchType: 'FULL_ENTRY' | 'FULL_EXIT' | 'PARTIAL_ENTRY' | 'PARTIAL_EXIT';
  direction: OrderType;
  alertQuantity: number;
  zerodhaQuantity: number;
  zerodhaPrice: number;
  alertClose: number;
  timestamp: string;
  pnl?: number;
  holdingAvgBuyPrice?: number;
  status: 'MATCHED' | 'PARTIAL' | 'UNMATCHED';
  accountType?: string;
}

export interface PnLEntry {
  ticker: string;
  strategy: string;
  realisedPnl: number;
  unrealisedPnl: number;
  totalInvested: number;
  currentValue: number;
  quantity: number;
  averageBuyPrice: number;
  lastPrice: number;
  actioned: boolean;
  trades: number;
  accountType?: string;
}

export interface AppState {
  alerts: TradingViewAlert[];
  zerodhaOrders: ZerodhaOrder[];
  zerodhaHoldings: ZerodhaHolding[];
  matchedTrades: MatchedTrade[];
  pnlEntries: PnLEntry[];
  globalTickerFilter: string;
  activeTab: number;
}

