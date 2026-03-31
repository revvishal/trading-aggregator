import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useAppContext } from '../../context/AppContext';
import { matchTradesWithAlerts } from '../../services/tradeMatchingService';
import { appendMatchedTrades } from '../../services/apiService';

const matchTypeLabels: Record<string, string> = {
  FULL_ENTRY: 'Full Entry (BUY)',
  FULL_EXIT: 'Full Exit (SELL)',
  PARTIAL_ENTRY: 'Partial Entry (ADD)',
  PARTIAL_EXIT: 'Partial Exit (REMOVE)',
};

const matchTypeColor: Record<string, 'success' | 'error' | 'info' | 'warning'> = {
  FULL_ENTRY: 'success',
  FULL_EXIT: 'error',
  PARTIAL_ENTRY: 'info',
  PARTIAL_EXIT: 'warning',
};

export default function MatchedTab() {
  const { state, dispatch } = useAppContext();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  const runMatching = async () => {
    setMatching(true);
    try {
      const { newMatches, updatedAlerts } = matchTradesWithAlerts(
        state.alerts,
        state.zerodhaOrders,
        state.zerodhaHoldings,
        state.matchedTrades // pass existing matches so orders aren't re-matched
      );

      if (newMatches.length > 0) {
        // Persist new matches via POST (append-only)
        await appendMatchedTrades(newMatches);
        // Update local state: merge new matches with existing
        dispatch({ type: 'SET_MATCHED_TRADES', payload: [...state.matchedTrades, ...newMatches] });
      }
      dispatch({ type: 'SET_ALERTS', payload: updatedAlerts });
      setLastRun(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch (err) {
      console.error('Matching failed:', err);
    } finally {
      setMatching(false);
    }
  };

  const filteredMatches = state.globalTickerFilter
    ? state.matchedTrades.filter((m) =>
        m.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : state.matchedTrades;

  // Find unmatched alerts
  const matchedAlertIds = new Set(state.matchedTrades.map((m) => m.alertId));
  const unmatchedAlerts = state.alerts.filter((a) => !matchedAlertIds.has(a.id));
  const filteredUnmatched = state.globalTickerFilter
    ? unmatchedAlerts.filter((a) =>
        a.Ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : unmatchedAlerts;

  // Find unmatched orders
  const matchedOrderIds = new Set(state.matchedTrades.map((m) => m.zerodhaOrderId));
  const unmatchedOrders = state.zerodhaOrders.filter((o) => !matchedOrderIds.has(o.id));
  const filteredUnmatchedOrders = state.globalTickerFilter
    ? unmatchedOrders.filter((o) =>
        o.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : unmatchedOrders;

  const stats = {
    matched: state.matchedTrades.length,
    unmatchedAlerts: unmatchedAlerts.length,
    unmatchedOrders: unmatchedOrders.length,
    matchRate:
      state.alerts.length > 0
        ? ((matchedAlertIds.size / state.alerts.length) * 100).toFixed(1)
        : '0',
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, bgcolor: 'success.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Matched Trades</Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">{stats.matched}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: 'warning.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Unmatched Signals</Typography>
            <Typography variant="h5" fontWeight={700} color="warning.main">{stats.unmatchedAlerts}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: 'info.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Unmatched Orders</Typography>
            <Typography variant="h5" fontWeight={700} color="info.main">{stats.unmatchedOrders}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Match Rate</Typography>
            <Typography variant="h5" fontWeight={700}>{stats.matchRate}%</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Trade Matching
          </Typography>
          {lastRun && (
            <Typography variant="caption" color="text.secondary">
              Last run: {lastRun}
            </Typography>
          )}
        </Box>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          onClick={runMatching}
          disabled={matching || (state.alerts.length === 0 && state.zerodhaOrders.length === 0)}
        >
          {matching ? 'Matching...' : 'Run Matching'}
        </Button>
      </Box>

      {state.alerts.length === 0 || state.zerodhaOrders.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Please import both TradingView signals and Zerodha orders before running the matching process.
        </Alert>
      ) : null}

      {/* Matched Trades */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon color="success" /> Matched Trades ({filteredMatches.length})
      </Typography>

      {filteredMatches.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No matched trades yet. Import signals and orders, then click "Run Matching".
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Match Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Direction</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Signal Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Zerodha Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Signal Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Zerodha Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Price Diff</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Portfolio</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMatches.map((trade) => {
                const priceDiff = trade.zerodhaPrice - trade.alertClose;
                return (
                  <TableRow key={trade.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{trade.ticker}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={matchTypeLabels[trade.matchType]}
                        color={matchTypeColor[trade.matchType]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={trade.direction}
                        color={trade.direction === 'BUY' || trade.direction === 'ADD' ? 'success' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{trade.alertQuantity}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{trade.zerodhaQuantity}</TableCell>
                    <TableCell>₹{trade.alertClose.toLocaleString('en-IN')}</TableCell>
                    <TableCell>₹{trade.zerodhaPrice.toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        color={priceDiff >= 0 ? 'success.main' : 'error.main'}
                        fontWeight={500}
                      >
                        {priceDiff >= 0 ? '+' : ''}₹{priceDiff.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {new Date(trade.timestamp).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={trade.accountType === 'secondary' ? 'Secondary' : 'Primary'}
                        size="small"
                        variant="outlined"
                        color={trade.accountType === 'secondary' ? 'info' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip label={trade.status} color="success" size="small" variant="outlined" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Unmatched Alerts */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkOffIcon color="warning" /> Unmatched Signals ({filteredUnmatched.length})
      </Typography>

      {filteredUnmatched.length === 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          All signals have been matched!
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'warning.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Order Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Close</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Strategy</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUnmatched.map((alert) => (
                <TableRow key={alert.id} hover>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {new Date(alert.timestamp).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{alert.Ticker}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={alert.OrderType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>₹{alert.Close.toLocaleString('en-IN')}</TableCell>
                  <TableCell>{alert.Strategy}</TableCell>
                  <TableCell>
                    <Chip label={alert.status} size="small" color={alert.status === 'IGNORED' ? 'default' : 'warning'} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                    {alert.status === 'IGNORED'
                      ? 'Signal was ignored'
                      : 'No matching Zerodha order found'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Unmatched Orders */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkOffIcon color="info" /> Unmatched Zerodha Orders ({filteredUnmatchedOrders.length})
      </Typography>

      {filteredUnmatchedOrders.length === 0 ? (
        <Alert severity="success">All orders have been matched!</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'info.50' }}>
                <TableCell sx={{ fontWeight: 600 }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUnmatchedOrders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{order.orderId}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>
                    {new Date(order.timestamp).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{order.ticker}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={order.type}
                      color={order.type === 'BUY' ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell>₹{order.price.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Chip label={order.status} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

