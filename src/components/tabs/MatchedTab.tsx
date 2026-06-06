import React, { useState, useEffect } from 'react';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import Tooltip from '@mui/material/Tooltip';
import { useAppContext } from '../../context/AppContext';
import { matchTradesWithAlerts } from '../../services/tradeMatchingService';
import { appendMatchedTrades, fetchMatchedTradesPaginated } from '../../services/apiService';
import { MatchedTrade, TradingViewAlert, ZerodhaOrder } from '../../types';

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

// ── Reusable Pagination Controls ─────────────────────────────────────
function PaginationControls({
  page, totalPages, totalCount, perPage, onPageChange, onPerPageChange, label,
}: {
  page: number; totalPages: number; totalCount: number; perPage: number;
  onPageChange: (newPage: number) => void; onPerPageChange: (event: SelectChangeEvent<number>) => void;
  label: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5, mb: 3, flexWrap: 'wrap', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id={`${label}-per-page-label`}>Per Page</InputLabel>
          <Select
            labelId={`${label}-per-page-label`}
            value={perPage}
            label="Per Page"
            onChange={onPerPageChange}
          >
            <MenuItem value={20}>20</MenuItem>
            <MenuItem value={50}>50</MenuItem>
            <MenuItem value={100}>100</MenuItem>
          </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary">
          Showing {totalCount === 0 ? 0 : page * perPage + 1}–{Math.min((page + 1) * perPage, totalCount)} of {totalCount} {label}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<NavigateBeforeIcon />}
          onClick={() => onPageChange(Math.max(0, page - 1))}
          disabled={page === 0}
        >
          Prev
        </Button>
        <Typography variant="body2" fontWeight={600}>
          Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          endIcon={<NavigateNextIcon />}
          onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
}

export default function MatchedTab() {
  const { state, dispatch } = useAppContext();
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  // Pagination state for Matched Trades (server-side)
  const [matchedPage, setMatchedPage] = useState(0);
  const [matchedPerPage, setMatchedPerPage] = useState(() => Number(sessionStorage.getItem('matched_perPage')) || 20);
  const [displayMatches, setDisplayMatches] = useState<MatchedTrade[]>([]);
  const [totalMatchedDbCount, setTotalMatchedDbCount] = useState(0);
  const [matchedPageLoading, setMatchedPageLoading] = useState(false);

  // Pagination state for Unmatched Signals (client-side)
  const [unmatchedAlertsPage, setUnmatchedAlertsPage] = useState(0);
  const [unmatchedAlertsPerPage, setUnmatchedAlertsPerPage] = useState(() => Number(sessionStorage.getItem('unmatchedAlerts_perPage')) || 20);

  // Pagination state for Unmatched Orders (client-side)
  const [unmatchedOrdersPage, setUnmatchedOrdersPage] = useState(0);
  const [unmatchedOrdersPerPage, setUnmatchedOrdersPerPage] = useState(() => Number(sessionStorage.getItem('unmatchedOrders_perPage')) || 20);

  const isSearchActive = !!state.globalTickerFilter;

  const runMatching = async () => {
    setMatching(true);
    try {
      const pendingAlerts = state.alerts.filter((a) => a.status === 'PENDING');
      const { newMatches, updatedAlerts } = matchTradesWithAlerts(
        pendingAlerts,
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
      // Merge updated pending alerts back with non-pending ones
      const nonPendingAlerts = state.alerts.filter((a) => a.status !== 'PENDING');
      dispatch({ type: 'SET_ALERTS', payload: [...nonPendingAlerts, ...updatedAlerts] });
      setLastRun(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    } catch (err) {
      console.error('Matching failed:', err);
    } finally {
      setMatching(false);
    }
  };

  // ─── Server-side pagination for Matched Trades ───────────────────────
  useEffect(() => {
    if (isSearchActive) return;
    let cancelled = false;
    const loadPage = async () => {
      setMatchedPageLoading(true);
      try {
        const data = await fetchMatchedTradesPaginated(matchedPage, matchedPerPage);
        if (!cancelled) {
          setDisplayMatches(data.trades);
          setTotalMatchedDbCount(data.total);
        }
      } catch (err) {
        console.error('Failed to fetch paginated matched trades:', err);
      } finally {
        if (!cancelled) setMatchedPageLoading(false);
      }
    };
    loadPage();
    return () => { cancelled = true; };
  }, [matchedPage, matchedPerPage, isSearchActive, state.matchedTrades.length]);

  // Reset all pages when search changes
  useEffect(() => {
    setMatchedPage(0);
    setUnmatchedAlertsPage(0);
    setUnmatchedOrdersPage(0);
  }, [state.globalTickerFilter]);

  // ─── Client-side search for matched trades ───────────────────────────
  const clientFilteredMatches = isSearchActive
    ? state.matchedTrades
        .filter((m) => m.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  // Determine what to show for matched trades
  let tableMatches: MatchedTrade[];
  let totalMatchedCount: number;

  if (isSearchActive) {
    totalMatchedCount = clientFilteredMatches.length;
    tableMatches = clientFilteredMatches.slice(matchedPage * matchedPerPage, matchedPage * matchedPerPage + matchedPerPage);
  } else {
    totalMatchedCount = totalMatchedDbCount;
    tableMatches = displayMatches;
  }

  const totalMatchedPages = Math.ceil(totalMatchedCount / matchedPerPage);

  // ─── Unmatched Signals (always client-side) ──────────────────────────
  const matchedAlertIds = new Set(state.matchedTrades.map((m) => m.alertId));
  const unmatchedAlerts = state.alerts.filter((a) => !matchedAlertIds.has(a.id));
  const filteredUnmatched: TradingViewAlert[] = state.globalTickerFilter
    ? unmatchedAlerts.filter((a) => a.Ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
    : unmatchedAlerts;

  const totalUnmatchedAlertsCount = filteredUnmatched.length;
  const totalUnmatchedAlertsPages = Math.ceil(totalUnmatchedAlertsCount / unmatchedAlertsPerPage);
  const tableUnmatchedAlerts = filteredUnmatched.slice(
    unmatchedAlertsPage * unmatchedAlertsPerPage,
    unmatchedAlertsPage * unmatchedAlertsPerPage + unmatchedAlertsPerPage
  );

  // ─── Unmatched Orders (always client-side) ───────────────────────────
  const matchedOrderIds = new Set(state.matchedTrades.map((m) => m.zerodhaOrderId));
  const unmatchedOrders = state.zerodhaOrders.filter((o) => !matchedOrderIds.has(o.id));
  const filteredUnmatchedOrders: ZerodhaOrder[] = state.globalTickerFilter
    ? unmatchedOrders.filter((o) => o.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
    : unmatchedOrders;

  const totalUnmatchedOrdersCount = filteredUnmatchedOrders.length;
  const totalUnmatchedOrdersPages = Math.ceil(totalUnmatchedOrdersCount / unmatchedOrdersPerPage);
  const tableUnmatchedOrders = filteredUnmatchedOrders.slice(
    unmatchedOrdersPage * unmatchedOrdersPerPage,
    unmatchedOrdersPage * unmatchedOrdersPerPage + unmatchedOrdersPerPage
  );

  // ─── Stats ───────────────────────────────────────────────────────────
  const stats = {
    matched: isSearchActive ? clientFilteredMatches.length : totalMatchedDbCount,
    unmatchedAlerts: unmatchedAlerts.length,
    unmatchedOrders: unmatchedOrders.length,
    matchRate:
      state.alerts.length > 0
        ? ((matchedAlertIds.size / state.alerts.length) * 100).toFixed(1)
        : '0',
  };

  // ─── Per-page change handlers ────────────────────────────────────────
  const handleMatchedPerPageChange = (event: SelectChangeEvent<number>) => {
    const val = Number(event.target.value);
    setMatchedPerPage(val);
    sessionStorage.setItem('matched_perPage', String(val));
    setMatchedPage(0);
  };
  const handleUnmatchedAlertsPerPageChange = (event: SelectChangeEvent<number>) => {
    const val = Number(event.target.value);
    setUnmatchedAlertsPerPage(val);
    sessionStorage.setItem('unmatchedAlerts_perPage', String(val));
    setUnmatchedAlertsPage(0);
  };
  const handleUnmatchedOrdersPerPageChange = (event: SelectChangeEvent<number>) => {
    const val = Number(event.target.value);
    setUnmatchedOrdersPerPage(val);
    sessionStorage.setItem('unmatchedOrders_perPage', String(val));
    setUnmatchedOrdersPage(0);
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

      {/* ═══════════ Matched Trades Table ═══════════ */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon color="success" /> Matched Trades ({totalMatchedCount})
      </Typography>

      {totalMatchedCount === 0 && !matchedPageLoading ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {isSearchActive
            ? `No matched trades found matching "${state.globalTickerFilter}".`
            : 'No matched trades yet. Import signals and orders, then click "Run Matching".'}
        </Alert>
      ) : (
        <>
        {matchedPageLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>Loading...</span>
          </Box>
        )}
        <TableContainer component={Paper} variant="outlined" sx={{ opacity: matchedPageLoading ? 0.5 : 1 }}>
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
                <TableCell sx={{ fontWeight: 600 }}>
                  <Tooltip title="Avg buy price from portfolio holdings" arrow placement="top">
                    <span>Avg Buy Price</span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Tooltip title="BUY/ADD: Signal Price vs Zerodha Price. SELL/REMOVE: Avg Buy Price vs Zerodha Sale Price" arrow placement="top">
                    <span>Price Diff ℹ️</span>
                  </Tooltip>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Portfolio</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tableMatches.map((trade) => {
                const isSellOrRemove = trade.direction === 'SELL' || trade.direction === 'REMOVE';
                const holding = state.zerodhaHoldings.find(
                  (h) =>
                    h.ticker.toUpperCase() === trade.ticker.toUpperCase() &&
                    (!trade.accountType || !h.accountType || h.accountType === trade.accountType)
                );
                const avgBuyPrice = trade.holdingAvgBuyPrice ?? (holding ? holding.averagePrice : undefined);
                const priceDiff = isSellOrRemove && avgBuyPrice != null
                  ? trade.zerodhaPrice - avgBuyPrice
                  : trade.zerodhaPrice - trade.alertClose;
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
                      {avgBuyPrice != null ? (
                        <Typography variant="body2" fontWeight={500}>
                          ₹{avgBuyPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          isSellOrRemove
                            ? avgBuyPrice != null
                              ? `Sale Price (₹${trade.zerodhaPrice.toFixed(2)}) − Avg Buy (₹${avgBuyPrice.toFixed(2)})`
                              : `Sale Price (₹${trade.zerodhaPrice.toFixed(2)}) − Signal Price (₹${trade.alertClose.toFixed(2)}) [No holding found]`
                            : `Zerodha Price (₹${trade.zerodhaPrice.toFixed(2)}) − Signal Price (₹${trade.alertClose.toFixed(2)})`
                        }
                        arrow
                        placement="top"
                      >
                        <Typography
                          variant="body2"
                          color={priceDiff >= 0 ? 'success.main' : 'error.main'}
                          fontWeight={500}
                          sx={{ cursor: 'help' }}
                        >
                          {priceDiff >= 0 ? '+' : ''}₹{priceDiff.toFixed(2)}
                        </Typography>
                      </Tooltip>
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
        <PaginationControls
          page={matchedPage}
          totalPages={totalMatchedPages}
          totalCount={totalMatchedCount}
          perPage={matchedPerPage}
          onPageChange={setMatchedPage}
          onPerPageChange={handleMatchedPerPageChange}
          label="matched trades"
        />
        </>
      )}

      {/* ═══════════ Unmatched Signals Table ═══════════ */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkOffIcon color="warning" /> Unmatched Signals ({totalUnmatchedAlertsCount})
      </Typography>

      {totalUnmatchedAlertsCount === 0 ? (
        <Alert severity="success" sx={{ mb: 3 }}>
          {isSearchActive ? `No unmatched signals found matching "${state.globalTickerFilter}".` : 'All signals have been matched!'}
        </Alert>
      ) : (
        <>
        <TableContainer component={Paper} variant="outlined">
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
              {tableUnmatchedAlerts.map((alert) => (
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
        <PaginationControls
          page={unmatchedAlertsPage}
          totalPages={totalUnmatchedAlertsPages}
          totalCount={totalUnmatchedAlertsCount}
          perPage={unmatchedAlertsPerPage}
          onPageChange={setUnmatchedAlertsPage}
          onPerPageChange={handleUnmatchedAlertsPerPageChange}
          label="unmatched signals"
        />
        </>
      )}

      {/* ═══════════ Unmatched Orders Table ═══════════ */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkOffIcon color="info" /> Unmatched Zerodha Orders ({totalUnmatchedOrdersCount})
      </Typography>

      {totalUnmatchedOrdersCount === 0 ? (
        <Alert severity="success">
          {isSearchActive ? `No unmatched orders found matching "${state.globalTickerFilter}".` : 'All orders have been matched!'}
        </Alert>
      ) : (
        <>
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
              {tableUnmatchedOrders.map((order) => (
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
        <PaginationControls
          page={unmatchedOrdersPage}
          totalPages={totalUnmatchedOrdersPages}
          totalCount={totalUnmatchedOrdersCount}
          perPage={unmatchedOrdersPerPage}
          onPageChange={setUnmatchedOrdersPage}
          onPerPageChange={handleUnmatchedOrdersPerPageChange}
          label="unmatched orders"
        />
        </>
      )}
    </Box>
  );
}

