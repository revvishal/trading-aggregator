import React, { useEffect, useState, useMemo } from 'react';
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
import { PnLEntry } from '../../types';

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

  // Calculate P&L per portfolio
  const recalculate = () => {
    // Combined (no account filter)
    const combined = calculatePnL(state.alerts, state.matchedTrades, state.zerodhaHoldings);
    dispatch({ type: 'SET_PNL_ENTRIES', payload: combined });
  };

  useEffect(() => {
    if (state.alerts.length > 0 || state.matchedTrades.length > 0) {
      recalculate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.alerts.length, state.matchedTrades.length, state.zerodhaHoldings.length]);

  // Compute per-portfolio P&L on the fly from state data
  const primaryEntries = useMemo(
    () => calculatePnL(state.alerts, state.matchedTrades, state.zerodhaHoldings, 'primary'),
    [state.alerts, state.matchedTrades, state.zerodhaHoldings]
  );
  const secondaryEntries = useMemo(
    () => calculatePnL(state.alerts, state.matchedTrades, state.zerodhaHoldings, 'secondary'),
    [state.alerts, state.matchedTrades, state.zerodhaHoldings]
  );
  const combinedEntries = state.pnlEntries;

  // Select active entries based on portfolio toggle
  let baseEntries: PnLEntry[];
  if (portfolioView === 'primary') baseEntries = primaryEntries;
  else if (portfolioView === 'secondary') baseEntries = secondaryEntries;
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

  // Summaries
  const primarySummary = summarise(primaryEntries);
  const secondarySummary = summarise(secondaryEntries);
  const combinedSummary = summarise(
    state.globalTickerFilter
      ? combinedEntries.filter((e) => e.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase()))
      : combinedEntries
  );
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

  return (
    <Box>
      {/* ── Portfolio-level Summary Cards (always visible) ────────── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Portfolio P&L Overview
        </Typography>
        <SummaryCards label="🟢 Primary Portfolio" s={primarySummary} />
        <SummaryCards label="🔵 Secondary Portfolio" s={secondarySummary} />
        <Divider sx={{ my: 2 }} />
        <SummaryCards label="📊 Combined" s={combinedSummary} />
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
            Detailed P&L {portfolioView !== 'combined' && `(${portfolioView})`}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
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
                {entries.map((entry, i) => {
                  const total = entry.realisedPnl + entry.unrealisedPnl;
                  return (
                    <TableRow key={i} hover>
                      <TableCell><Typography variant="body2" fontWeight={600}>{entry.ticker}</Typography></TableCell>
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
