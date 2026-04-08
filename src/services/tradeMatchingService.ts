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
        accountType: bestOrder.accountType || 'primary',
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
  accountType?: string,
  orders: ZerodhaOrder[] = []
): PnLEntry[] {
  // Filter matched trades, holdings, and orders by account if specified
  const filteredTrades = accountType
    ? matchedTrades.filter((m) => m.accountType === accountType)
    : matchedTrades;
  const filteredHoldings = accountType
    ? holdings.filter((h) => !h.accountType || h.accountType === accountType)
    : holdings;
  const filteredOrders = accountType
    ? orders.filter((o) => !o.accountType || o.accountType === accountType)
    : orders;

  // Build a map of recent BUY orders (COMPLETE) per ticker that are NOT yet in holdings.
  // These are T+1 pending orders whose qty/invested should be combined with holdings.
  const holdingTickerSet = new Set(filteredHoldings.map((h) => h.ticker.toUpperCase()));
  const recentBuyOrdersByTicker = new Map<string, { qty: number; invested: number; avgPrice: number; orders: ZerodhaOrder[] }>();

  const completeBuyOrders = filteredOrders.filter((o) => o.status === 'COMPLETE' && o.type === 'BUY');
  const completeSellOrders = filteredOrders.filter((o) => o.status === 'COMPLETE' && o.type === 'SELL');

  for (const order of completeBuyOrders) {
    const tkr = order.ticker.toUpperCase();
    if (!recentBuyOrdersByTicker.has(tkr)) {
      recentBuyOrdersByTicker.set(tkr, { qty: 0, invested: 0, avgPrice: 0, orders: [] });
    }
    const entry = recentBuyOrdersByTicker.get(tkr)!;
    entry.qty += order.quantity;
    entry.invested += order.price * order.quantity;
    entry.orders.push(order);
  }
  // Subtract completed SELL orders from the recent buy aggregation
  for (const order of completeSellOrders) {
    const tkr = order.ticker.toUpperCase();
    if (recentBuyOrdersByTicker.has(tkr)) {
      const entry = recentBuyOrdersByTicker.get(tkr)!;
      entry.qty -= order.quantity;
      entry.invested -= order.price * order.quantity;
    }
  }
  // Compute avg price for recent orders
  for (const [, entry] of recentBuyOrdersByTicker) {
    entry.avgPrice = entry.qty > 0 ? entry.invested / entry.qty : 0;
  }

  const pnlMap = new Map<string, PnLEntry>();
  const matchedAlertIds = new Set(filteredTrades.map((m) => m.alertId));

  for (const alert of alerts) {
    const key = `${alert.Ticker}_${alert.Strategy}`;
    const isActioned = matchedAlertIds.has(alert.id);

    if (!pnlMap.has(key)) {
      const tkrUpper = alert.Ticker.toUpperCase();
      const holding = filteredHoldings.find((h) => h.ticker.toUpperCase() === tkrUpper);
      const recentOrders = recentBuyOrdersByTicker.get(tkrUpper);

      // Combine holdings + recent T+1 orders for qty & invested
      const holdingQty = holding ? holding.quantity : 0;
      const holdingInvested = holding ? holding.averagePrice * holding.quantity : 0;
      // Only add recent order qty if ticker is NOT yet in holdings (new entry)
      // or if there are additional orders beyond what holdings reflect
      const recentQty = recentOrders && recentOrders.qty > 0 ? recentOrders.qty : 0;
      const recentInvested = recentOrders && recentOrders.invested > 0 ? recentOrders.invested : 0;

      let combinedQty: number;
      let combinedInvested: number;
      let combinedAvgPrice: number;
      let lastPrice: number;

      if (holding) {
        // Existing holding: holdings qty/invested + recent unsettled BUY orders
        combinedQty = holdingQty + recentQty;
        combinedInvested = holdingInvested + recentInvested;
        combinedAvgPrice = combinedQty > 0 ? combinedInvested / combinedQty : holding.averagePrice;
        lastPrice = holding.lastPrice;
      } else if (recentQty > 0) {
        // New ticker with only recent orders (T+1 pending)
        combinedQty = recentQty;
        combinedInvested = recentInvested;
        combinedAvgPrice = recentOrders!.avgPrice;
        lastPrice = alert.Close;
      } else {
        // No holding, no recent orders
        combinedQty = 0;
        combinedInvested = 0;
        combinedAvgPrice = 0;
        lastPrice = alert.Close;
      }

      pnlMap.set(key, {
        ticker: alert.Ticker,
        strategy: alert.Strategy,
        realisedPnl: 0,
        unrealisedPnl: holding ? holding.pnl : 0,
        totalInvested: combinedInvested,
        currentValue: lastPrice * combinedQty,
        quantity: combinedQty,
        averageBuyPrice: combinedAvgPrice,
        lastPrice,
        actioned: isActioned,
        trades: 0,
        accountType: accountType || 'combined',
      });
    }

    const entry = pnlMap.get(key)!;

    const matchedTradesForAlert = filteredTrades.filter((m) => m.alertId === alert.id);
    if (matchedTradesForAlert.length > 0) {
      entry.actioned = true;
      for (const matchedTrade of matchedTradesForAlert) {
        entry.trades++;
        if (matchedTrade.matchType === 'FULL_EXIT' || matchedTrade.matchType === 'PARTIAL_EXIT') {
          const buyPrice = entry.averageBuyPrice || matchedTrade.alertClose;
          entry.realisedPnl += (matchedTrade.zerodhaPrice - buyPrice) * matchedTrade.zerodhaQuantity;
        }
        // Entry/add trades are already accounted for via holdings + orders combination
      }
    } else {
      entry.trades++;
    }

    pnlMap.set(key, entry);
  }

  // Update from holdings for latest price/unrealised (holdings are source of truth for settled data)
  for (const holding of filteredHoldings) {
    const existingKeys = Array.from(pnlMap.keys()).filter((k) => k.startsWith(holding.ticker.toUpperCase()));
    if (existingKeys.length > 0) {
      const tkrUpper = holding.ticker.toUpperCase();
      const recentOrders = recentBuyOrdersByTicker.get(tkrUpper);
      const recentQty = recentOrders && recentOrders.qty > 0 ? recentOrders.qty : 0;
      const recentInvested = recentOrders && recentOrders.invested > 0 ? recentOrders.invested : 0;
      const combinedQty = holding.quantity + recentQty;
      const combinedInvested = (holding.averagePrice * holding.quantity) + recentInvested;

      for (const key of existingKeys) {
        const entry = pnlMap.get(key)!;
        entry.unrealisedPnl = holding.pnl;
        entry.currentValue = holding.lastPrice * combinedQty;
        entry.quantity = combinedQty;
        entry.totalInvested = combinedInvested;
        entry.averageBuyPrice = combinedQty > 0 ? combinedInvested / combinedQty : holding.averagePrice;
        entry.lastPrice = holding.lastPrice;
      }
    }
  }

  return Array.from(pnlMap.values());
}
