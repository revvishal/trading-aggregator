import { TradingViewAlert, ZerodhaOrder, MatchedTrade, PnLEntry, ZerodhaHolding } from '../types';
import { v4 as uuidv4 } from 'uuid';

export function matchTradesWithAlerts(
  alerts: TradingViewAlert[],
  orders: ZerodhaOrder[],
  holdings: ZerodhaHolding[]
): { matchedTrades: MatchedTrade[]; updatedAlerts: TradingViewAlert[] } {
  const matchedTrades: MatchedTrade[] = [];
  const updatedAlerts = [...alerts];

  // Sort by timestamp
  const sortedAlerts = [...alerts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const usedOrderIds = new Set<string>();

  for (const alert of sortedAlerts) {
    const alertIdx = updatedAlerts.findIndex((a) => a.id === alert.id);
    if (alertIdx === -1) continue;

    // Find matching orders by ticker
    const matchingOrders = orders.filter((o) => {
      if (usedOrderIds.has(o.id)) return false;
      if (o.status !== 'COMPLETE') return false;

      const tickerMatch = o.ticker.toUpperCase() === alert.Ticker.toUpperCase();
      if (!tickerMatch) return false;

      // BUY/ADD signals match with BUY orders, SELL/REMOVE match with SELL orders
      const alertDirection = alert.OrderType === 'BUY' || alert.OrderType === 'ADD' ? 'BUY' : 'SELL';
      return o.type === alertDirection;
    });

    if (matchingOrders.length > 0) {
      const bestOrder = matchingOrders.sort(
        (a, b) => Math.abs(new Date(a.timestamp).getTime() - new Date(alert.timestamp).getTime()) -
                   Math.abs(new Date(b.timestamp).getTime() - new Date(alert.timestamp).getTime())
      )[0];

      let matchType: MatchedTrade['matchType'];
      if (alert.OrderType === 'BUY') matchType = 'FULL_ENTRY';
      else if (alert.OrderType === 'SELL') matchType = 'FULL_EXIT';
      else if (alert.OrderType === 'ADD') matchType = 'PARTIAL_ENTRY';
      else matchType = 'PARTIAL_EXIT';

      matchedTrades.push({
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
      });

      usedOrderIds.add(bestOrder.id);
      updatedAlerts[alertIdx] = { ...updatedAlerts[alertIdx], status: 'ACTIONED' };
    }
  }

  return { matchedTrades, updatedAlerts };
}

export function calculatePnL(
  alerts: TradingViewAlert[],
  matchedTrades: MatchedTrade[],
  holdings: ZerodhaHolding[]
): PnLEntry[] {
  const pnlMap = new Map<string, PnLEntry>();
  const matchedAlertIds = new Set(matchedTrades.map((m) => m.alertId));

  // Process all alerts
  for (const alert of alerts) {
    const key = `${alert.Ticker}_${alert.Strategy}`;
    const isActioned = matchedAlertIds.has(alert.id);

    if (!pnlMap.has(key)) {
      const holding = holdings.find((h) => h.ticker.toUpperCase() === alert.Ticker.toUpperCase());
      pnlMap.set(key, {
        ticker: alert.Ticker,
        strategy: alert.Strategy,
        realisedPnl: 0,
        unrealisedPnl: holding ? holding.pnl : 0,
        totalInvested: 0,
        currentValue: holding ? holding.lastPrice * holding.quantity : 0,
        quantity: holding ? holding.quantity : 0,
        averageBuyPrice: holding ? holding.averagePrice : 0,
        lastPrice: holding ? holding.lastPrice : alert.Close,
        actioned: isActioned,
        trades: 0,
      });
    }

    const entry = pnlMap.get(key)!;

    // Find matched trade for this alert
    const matchedTrade = matchedTrades.find((m) => m.alertId === alert.id);
    if (matchedTrade) {
      entry.actioned = true;
      entry.trades++;

      if (matchedTrade.matchType === 'FULL_EXIT' || matchedTrade.matchType === 'PARTIAL_EXIT') {
        // Calculate realised P&L for exits
        const buyPrice = entry.averageBuyPrice || matchedTrade.alertClose;
        entry.realisedPnl += (matchedTrade.zerodhaPrice - buyPrice) * matchedTrade.zerodhaQuantity;
      } else {
        entry.totalInvested += matchedTrade.zerodhaPrice * matchedTrade.zerodhaQuantity;
      }
    } else {
      entry.trades++;
    }

    pnlMap.set(key, entry);
  }

  // Add holdings data for unrealised P&L
  for (const holding of holdings) {
    const existingKeys = Array.from(pnlMap.keys()).filter((k) => k.startsWith(holding.ticker.toUpperCase()));
    if (existingKeys.length > 0) {
      for (const key of existingKeys) {
        const entry = pnlMap.get(key)!;
        entry.unrealisedPnl = holding.pnl;
        entry.currentValue = holding.lastPrice * holding.quantity;
        entry.quantity = holding.quantity;
        entry.averageBuyPrice = holding.averagePrice;
        entry.lastPrice = holding.lastPrice;
      }
    }
  }

  return Array.from(pnlMap.values());
}

