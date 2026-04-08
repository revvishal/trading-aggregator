import { TradingViewAlert, ZerodhaOrder, MatchedTrade, PnLEntry, ZerodhaHolding } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Match alerts with orders.
 * - An order can only be matched once (check existingMatches).
 * - An alert CAN match with orders from both portfolios.
 * - Order/trade date must be on or after the alert signal date.
 */
export function matchTradesWithAlerts(
  alerts: TradingViewAlert[],
  orders: ZerodhaOrder[],
  holdings: ZerodhaHolding[],
  existingMatches: MatchedTrade[] = []
): { newMatches: MatchedTrade[]; updatedAlerts: TradingViewAlert[] } {
  const newMatches: MatchedTrade[] = [];
  const updatedAlerts = [...alerts];

  // Collect all already-matched order IDs (globally, across both portfolios)
  const alreadyMatchedOrderIds = new Set(existingMatches.map((m) => m.zerodhaOrderId));

  // Sort alerts by timestamp (oldest first)
  const sortedAlerts = [...alerts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Track orders matched in this run
  const newlyMatchedOrderIds = new Set<string>();

  for (const alert of sortedAlerts) {
    const alertIdx = updatedAlerts.findIndex((a) => a.id === alert.id);
    if (alertIdx === -1) continue;

    const alertTime = new Date(alert.timestamp).getTime();

    // Find matching orders by ticker
    const matchingOrders = orders.filter((o) => {
      // Skip already matched orders (from previous runs or this run)
      if (alreadyMatchedOrderIds.has(o.id)) return false;
      if (newlyMatchedOrderIds.has(o.id)) return false;

      if (o.status !== 'COMPLETE') return false;

      const tickerMatch = o.ticker.toUpperCase() === alert.Ticker.toUpperCase();
      if (!tickerMatch) return false;

      // Order date must be on or after the signal date
      const orderTime = new Date(o.timestamp).getTime();
      if (orderTime < alertTime) return false;

      // BUY/ADD signals match with BUY orders, SELL/REMOVE match with SELL orders
      const alertDirection = alert.OrderType === 'BUY' || alert.OrderType === 'ADD' ? 'BUY' : 'SELL';
      return o.type === alertDirection;
    });

    if (matchingOrders.length > 0) {
      // Pick the closest order by time (after the alert)
      const bestOrder = matchingOrders.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )[0];

      let matchType: MatchedTrade['matchType'];
      if (alert.OrderType === 'BUY') matchType = 'FULL_ENTRY';
      else if (alert.OrderType === 'SELL') matchType = 'FULL_EXIT';
      else if (alert.OrderType === 'ADD') matchType = 'PARTIAL_ENTRY';
      else matchType = 'PARTIAL_EXIT';

      // Snapshot holding avg buy price at match time (survives full exit when holding disappears)
      const account = bestOrder.accountType || 'primary';
      const holding = holdings.find(
        (h) =>
          h.ticker.toUpperCase() === alert.Ticker.toUpperCase() &&
          (!h.accountType || h.accountType === account)
      );

      newMatches.push({
        id: uuidv4(),
        alertId: alert.id,
        zerodhaOrderId: bestOrder.id,
        ticker: alert.Ticker,
        matchType,
        direction: alert.OrderType,
        alertQuantity: alert.Quantity,
        zerodhaQuantity: bestOrder.quantity,
        zerodhaPrice: bestOrder.price,
        alertClose: alert.Close,
        timestamp: bestOrder.timestamp,
        status: 'MATCHED',
        accountType: account,
        holdingAvgBuyPrice: holding ? holding.averagePrice : undefined,
      });

      newlyMatchedOrderIds.add(bestOrder.id);
      updatedAlerts[alertIdx] = { ...updatedAlerts[alertIdx], status: 'ACTIONED' };
    }
  }

  return { newMatches, updatedAlerts };
}

export function calculatePnL(
  alerts: TradingViewAlert[],
  matchedTrades: MatchedTrade[],
  holdings: ZerodhaHolding[],
  accountType?: string
): PnLEntry[] {
  // Filter matched trades and holdings by account if specified
  const filteredTrades = accountType
    ? matchedTrades.filter((m) => m.accountType === accountType)
    : matchedTrades;
  const filteredHoldings = accountType
    ? holdings.filter((h) => !h.accountType || h.accountType === accountType)
    : holdings;

  const pnlMap = new Map<string, PnLEntry>();
  const matchedAlertIds = new Set(filteredTrades.map((m) => m.alertId));

  for (const alert of alerts) {
    const key = `${alert.Ticker}_${alert.Strategy}`;
    const isActioned = matchedAlertIds.has(alert.id);

    if (!pnlMap.has(key)) {
      const holding = filteredHoldings.find((h) => h.ticker.toUpperCase() === alert.Ticker.toUpperCase());
      pnlMap.set(key, {
        ticker: alert.Ticker,
        strategy: alert.Strategy,
        realisedPnl: 0,
        unrealisedPnl: holding ? holding.pnl : 0,
        totalInvested: 0,
        currentValue: 0,
        quantity: 0,
        averageBuyPrice: 0,
        lastPrice: holding ? holding.lastPrice : alert.Close,
        actioned: isActioned,
        trades: 0,
        accountType: accountType || 'combined',
      });
    }

    const entry = pnlMap.get(key)!;

    const matchedTradesForAlert = filteredTrades.filter((m) => m.alertId === alert.id);
    if (matchedTradesForAlert.length > 0) {
      entry.actioned = true;
      for (const mt of matchedTradesForAlert) {
        entry.trades++;
        if (mt.matchType === 'FULL_ENTRY' || mt.matchType === 'PARTIAL_ENTRY') {
          // BUY/ADD: accumulate qty and invested from matched trade
          entry.quantity += mt.zerodhaQuantity;
          entry.totalInvested += mt.zerodhaPrice * mt.zerodhaQuantity;
        } else {
          // SELL/REMOVE: use persisted holding avg buy price, fall back to live holding, then matched-trade avg
          const buyPrice = mt.holdingAvgBuyPrice
            ? mt.holdingAvgBuyPrice
            : (() => {
                const holding = filteredHoldings.find(
                  (h) =>
                    h.ticker.toUpperCase() === mt.ticker.toUpperCase() &&
                    (!mt.accountType || !h.accountType || h.accountType === mt.accountType)
                );
                return holding
                  ? holding.averagePrice
                  : entry.quantity > 0
                    ? entry.totalInvested / entry.quantity
                    : mt.alertClose;
              })();
          entry.realisedPnl += (mt.zerodhaPrice - buyPrice) * mt.zerodhaQuantity;
          // Reduce qty and invested proportionally
          const soldQty = Math.min(mt.zerodhaQuantity, entry.quantity);
          if (entry.quantity > 0) {
            const avgCost = entry.totalInvested / entry.quantity;
            entry.totalInvested -= avgCost * soldQty;
          }
          entry.quantity -= soldQty;
        }
      }
      // Recompute avg buy price after processing all matched trades for this alert
      entry.averageBuyPrice = entry.quantity > 0 ? entry.totalInvested / entry.quantity : 0;
    } else {
      entry.trades++;
    }

    pnlMap.set(key, entry);
  }

  // Update lastPrice and unrealisedPnl from holdings (source of truth for live prices)
  for (const holding of filteredHoldings) {
    const existingKeys = Array.from(pnlMap.keys()).filter((k) => k.startsWith(holding.ticker.toUpperCase()));
    for (const key of existingKeys) {
      const entry = pnlMap.get(key)!;
      entry.lastPrice = holding.lastPrice;
      entry.unrealisedPnl = holding.pnl;
    }
  }

  // Compute currentValue from matched qty * lastPrice
  Array.from(pnlMap.values()).forEach((entry) => {
    entry.currentValue = entry.quantity * entry.lastPrice;
  });

  return Array.from(pnlMap.values());
}
