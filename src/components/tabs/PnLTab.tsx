import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Card,
  CardContent,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Button,
  Divider,
  TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { useAppContext } from '../../context/AppContext';
import { calculatePnL } from '../../services/tradeMatchingService';
import { fetchMatchedTradesByDateRange } from '../../services/apiService';
import { PnLEntry, MatchedTrade } from '../../types';

// ── helper: compute summary from entries ───────────────────────────
function summarise(entries: PnLEntry[]) {
  const totalRealised = entries.reduce((s, e) => s + e.realisedPnl, 0);
  const totalUnrealised = entries.reduce((s, e) => s + e.unrealisedPnl, 0);
  const totalInvested = entries.reduce((s, e) => s + e.totalInvested, 0);
  const totalCurrent = entries.reduce((s, e) => s + e.currentValue, 0);
  const profitable = entries.filter((e) => e.realisedPnl + e.unrealisedPnl > 0).length;
  const winRate = entries.length > 0 ? ((profitable / entries.length) * 100).toFixed(1) : '0';
  return { totalRealised, totalUnrealised, totalInvested, totalCurrent, winRate };
}

// ── summary cards row ──────────────────────────────────────────────
function SummaryCards({ label, s }: { label: string; s: ReturnType<typeof summarise> }) {
  const total = s.totalRealised + s.totalUnrealised;
  return (
    <Box sx={{ mb: 2 }}>
      {label && (
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Stack direction="row" spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Realised P&L</Typography>
            <Typography variant="h6" fontWeight={700} color={s.totalRealised >= 0 ? 'success.main' : 'error.main'}>
              {s.totalRealised >= 0 ? '+' : ''}₹{s.totalRealised.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Unrealised P&L</Typography>
            <Typography variant="h6" fontWeight={700} color={s.totalUnrealised >= 0 ? 'success.main' : 'error.main'}>
              {s.totalUnrealised >= 0 ? '+' : ''}₹{s.totalUnrealised.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Total P&L</Typography>
            <Typography variant="h6" fontWeight={700} color={total >= 0 ? 'success.main' : 'error.main'}>
              {total >= 0 ? '+' : ''}₹{total.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Win Rate</Typography>
            <Typography variant="h6" fontWeight={700}>{s.winRate}%</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Invested → Current</Typography>
            <Typography variant="body2" fontWeight={600}>
              ₹{s.totalInvested.toLocaleString('en-IN')} → ₹{s.totalCurrent.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

export default function PnLTab() {
  const { state, dispatch } = useAppContext();
  const [filter, setFilter] = useState<'all' | 'actioned' | 'non-actioned'>('all');
  const [portfolioView, setPortfolioView] = useState<'combined' | 'primary' | 'secondary'>('combined');

  // Date range state — default: last 2 months, persisted in sessionStorage
  const [fromDate, setFromDate] = useState<string>(() => {
    const stored = sessionStorage.getItem('pnl_fromDate');
    if (stored) return stored;
    const d = new Date();
    d.setMonth(d.getMonth() - 2);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(() => {
    const stored = sessionStorage.getItem('pnl_toDate');
    if (stored) return stored;
    return new Date().toISOString().split('T')[0];
  });
  const [dateRangeMatches, setDateRangeMatches] = useState<MatchedTrade[]>([]);
  const [dateRangeLoading, setDateRangeLoading] = useState(false);

  // Fetch matched trades from DB by date range
  const loadDateRangeMatches = useCallback(async () => {
    setDateRangeLoading(true);
    try {
      const trades = await fetchMatchedTradesByDateRange(fromDate, toDate);
      setDateRangeMatches(trades);
    } catch (err) {
      console.error('Failed to fetch matched trades by date range:', err);
      setDateRangeMatches([]);
    } finally {
      setDateRangeLoading(false);
    }
  }, [fromDate, toDate]);

  // Load on mount and when date range changes
  useEffect(() => {
    loadDateRangeMatches();
  }, [loadDateRangeMatches]);

  // Calculate P&L using date-range matched trades for P&L numbers,
  // but use ALL matched trades for actioned status determination
  const recalculate = useCallback(() => {
    const matchesForPnl = dateRangeMatches.length > 0 ? dateRangeMatches : state.matchedTrades;

    // Calculate P&L with date-range trades (controls realised/unrealised numbers)
    const primaryPnl = calculatePnL(state.alerts, matchesForPnl, state.zerodhaHoldings, 'primary');
    const secondaryPnl = calculatePnL(state.alerts, matchesForPnl, state.zerodhaHoldings, 'secondary');

    // Calculate actioned status from ALL matched trades (not date-filtered)
    const allMatchedAlertIds = new Set(state.matchedTrades.map((m) => m.alertId));

    // Fix actioned: use all-time matched alert IDs per ticker+strategy
    const fixedEntries = [...primaryPnl, ...secondaryPnl].map((entry) => ({
      ...entry,
      actioned: state.alerts.some(
        (a) =>
          a.Ticker.toUpperCase() === entry.ticker.toUpperCase() &&
          (a.Strategy || '') === (entry.strategy || '') &&
          allMatchedAlertIds.has(a.id)
      ),
    }));

    dispatch({ type: 'SET_PNL_ENTRIES', payload: fixedEntries });
  }, [state.alerts, state.matchedTrades, dateRangeMatches, state.zerodhaHoldings, dispatch]);

  useEffect(() => {
    if (state.alerts.length > 0 || state.matchedTrades.length > 0) {
      recalculate();
    }
  }, [state.alerts.length, state.matchedTrades.length, dateRangeMatches.length, state.zerodhaHoldings.length, recalculate]);

  const combinedEntries = state.pnlEntries;

  // Summaries — computed from date-range-filtered entries
  const primarySummary = summarise(combinedEntries.filter((e) => e.accountType === 'primary'));
  const secondarySummary = summarise(combinedEntries.filter((e) => e.accountType === 'secondary'));
  const combinedSummary = summarise(
    state.globalTickerFilter
      ? combinedEntries.filter((e) => e.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
      : combinedEntries
  );

  // Select active entries based on portfolio toggle
  let baseEntries: PnLEntry[];
  if (portfolioView === 'primary') baseEntries = combinedEntries.filter((e) => e.accountType === 'primary');
  else if (portfolioView === 'secondary') baseEntries = combinedEntries.filter((e) => e.accountType === 'secondary');
  else baseEntries = combinedEntries;

  // Apply global ticker filter
  let entries = state.globalTickerFilter
    ? baseEntries.filter((e) => e.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
    : baseEntries;

  // Apply actioned filter
  if (filter === 'actioned') entries = entries.filter((e) => e.actioned);
  else if (filter === 'non-actioned') entries = entries.filter((e) => !e.actioned);

  const actionedEntries = entries.filter((e) => e.actioned);
  const nonActionedEntries = entries.filter((e) => !e.actioned);

  const activeSummary = summarise(entries);

  // Chart data
  const chartData = entries.map((e) => ({
    ticker: e.ticker,
    realised: e.realisedPnl,
    unrealised: e.unrealisedPnl,
    total: e.realisedPnl + e.unrealisedPnl,
  }));

  const strategyData = entries.reduce<Record<string, { strategy: string; realised: number; unrealised: number; trades: number }>>((acc, e) => {
    if (!acc[e.strategy]) {
      acc[e.strategy] = { strategy: e.strategy || 'Unknown', realised: 0, unrealised: 0, trades: 0 };
    }
    acc[e.strategy].realised += e.realisedPnl;
    acc[e.strategy].unrealised += e.unrealisedPnl;
    acc[e.strategy].trades += e.trades;
    return acc;
  }, {});

  const pieData = [
    { name: 'Actioned', value: actionedEntries.length, fill: '#4caf50' },
    { name: 'Non-Actioned', value: nonActionedEntries.length, fill: '#ff9800' },
  ].filter((d) => d.value > 0);

  // Detailed P&L: only tickers with matched trade activity in date range
  const dateRangeTickerSet = new Set(dateRangeMatches.map((t) => t.ticker.toUpperCase()));
  const detailedEntries = dateRangeTickerSet.size > 0
    ? entries.filter((e) => dateRangeTickerSet.has(e.ticker.toUpperCase()))
    : entries;

  return (
    <Box>
      {/* ── Portfolio-level Summary Cards ────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Portfolio P&L Overview
        </Typography>
        <SummaryCards label="🟢 Primary Portfolio" s={primarySummary} />
        <SummaryCards label="🔵 Secondary Portfolio" s={secondarySummary} />
        <Divider sx={{ my: 2 }} />
        <SummaryCards label="📊 Combined" s={combinedSummary} />
      </Paper>

      {/* ── Date Range Filter ────────────────────────────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" fontWeight={600}>Date Range:</Typography>
        <TextField
          type="date"
          size="small"
          label="From Date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); sessionStorage.setItem('pnl_fromDate', e.target.value); }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />
        <TextField
          type="date"
          size="small"
          label="To Date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); sessionStorage.setItem('pnl_toDate', e.target.value); }}
          InputLabelProps={{ shrink: true }}
          sx={{ width: 160 }}
        />
        {dateRangeLoading && (
          <Typography variant="caption" color="text.secondary">Loading...</Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          {dateRangeMatches.length} matched trades in this period
        </Typography>
      </Paper>

      {/* ── Portfolio Toggle + Actioned Filter + Refresh ──────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={portfolioView}
            exclusive
            onChange={(_, v) => v && setPortfolioView(v)}
            size="small"
          >
            <ToggleButton value="combined" sx={{ textTransform: 'none' }}>Combined</ToggleButton>
            <ToggleButton value="primary" sx={{ textTransform: 'none' }}>Primary</ToggleButton>
            <ToggleButton value="secondary" sx={{ textTransform: 'none' }}>Secondary</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, v) => v && setFilter(v)}
            size="small"
          >
            <ToggleButton value="all">All ({entries.length})</ToggleButton>
            <ToggleButton value="actioned">Actioned ({actionedEntries.length})</ToggleButton>
            <ToggleButton value="non-actioned">Non-Actioned ({nonActionedEntries.length})</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={recalculate}>
          Recalculate P&L
        </Button>
      </Box>

      {/* ── Active view summary ──────────────────────────────────── */}
      {portfolioView !== 'combined' && (
        <SummaryCards
          label={portfolioView === 'primary' ? '🟢 Primary — Filtered' : '🔵 Secondary — Filtered'}
          s={activeSummary}
        />
      )}

      {entries.length === 0 ? (
        <Alert severity="info">
          No P&L data available{portfolioView !== 'combined' ? ` for ${portfolioView} portfolio` : ''}. Import signals and run trade matching first.
        </Alert>
      ) : (
        <>
          {/* ── Charts ───────────────────────────────────────────── */}
          <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
            <Paper variant="outlined" sx={{ flex: 2, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                P&L by Ticker {portfolioView !== 'combined' && `(${portfolioView})`}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ticker" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                  <Legend />
                  <Bar dataKey="realised" name="Realised" stackId="a">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.realised >= 0 ? '#4caf50' : '#f44336'} />
                    ))}
                  </Bar>
                  <Bar dataKey="unrealised" name="Unrealised" stackId="a">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.unrealised >= 0 ? '#81c784' : '#e57373'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            <Paper variant="outlined" sx={{ flex: 1, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                Actioned vs Non-Actioned
              </Typography>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                  <Typography color="text.secondary">No data</Typography>
                </Box>
              )}
            </Paper>
          </Stack>

          {/* ── Strategy Summary ─────────────────────────────────── */}
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            P&L by Strategy {portfolioView !== 'combined' && `(${portfolioView})`}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Strategy</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trades</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Realised P&L</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Unrealised P&L</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Total P&L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.values(strategyData).map((s, i) => {
                  const total = s.realised + s.unrealised;
                  return (
                    <TableRow key={i} hover>
                      <TableCell><Chip label={s.strategy} size="small" variant="outlined" /></TableCell>
                      <TableCell>{s.trades}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color={s.realised >= 0 ? 'success.main' : 'error.main'} fontWeight={500}>
                          {s.realised >= 0 ? '+' : ''}₹{s.realised.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={s.unrealised >= 0 ? 'success.main' : 'error.main'} fontWeight={500}>
                          {s.unrealised >= 0 ? '+' : ''}₹{s.unrealised.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={total >= 0 ? 'success.main' : 'error.main'} fontWeight={600}>
                          {total >= 0 ? '+' : ''}₹{total.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ── Detailed P&L Table ───────────────────────────────── */}
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Detailed P&L {portfolioView !== 'combined' && `(${portfolioView})`} ({detailedEntries.length})
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Portfolio</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Strategy</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Avg Buy</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>LTP</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Invested</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Current</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Realised</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Unrealised</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Total P&L</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Trades</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detailedEntries.map((entry, i) => {
                  const total = entry.realisedPnl + entry.unrealisedPnl;
                  return (
                    <TableRow key={i} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{entry.ticker}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          label={entry.accountType === 'secondary' ? 'Secondary' : 'Primary'}
                          color={entry.accountType === 'secondary' ? 'info' : 'success'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell><Chip label={entry.strategy || '-'} size="small" variant="outlined" /></TableCell>
                      <TableCell>{entry.quantity}</TableCell>
                      <TableCell>₹{entry.averageBuyPrice.toLocaleString('en-IN')}</TableCell>
                      <TableCell>₹{entry.lastPrice.toLocaleString('en-IN')}</TableCell>
                      <TableCell>₹{entry.totalInvested.toLocaleString('en-IN')}</TableCell>
                      <TableCell>₹{entry.currentValue.toLocaleString('en-IN')}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color={entry.realisedPnl >= 0 ? 'success.main' : 'error.main'} fontWeight={500}>
                          {entry.realisedPnl >= 0 ? '+' : ''}₹{entry.realisedPnl.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={entry.unrealisedPnl >= 0 ? 'success.main' : 'error.main'} fontWeight={500}>
                          {entry.unrealisedPnl >= 0 ? '+' : ''}₹{entry.unrealisedPnl.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={total >= 0 ? 'success.main' : 'error.main'} fontWeight={600}>
                          {total >= 0 ? '+' : ''}₹{total.toLocaleString('en-IN')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={entry.actioned ? 'Actioned' : 'Not Actioned'}
                          color={entry.actioned ? 'success' : 'warning'}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{entry.trades}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
