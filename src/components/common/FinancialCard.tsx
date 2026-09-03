import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Chip,
  Divider,
  Tabs,
  Tab,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { QuarterlyFinancials, AnalystRecommendation } from '../../types';
import ScoreBadge from './ScoreBadge';
import TradingViewFundamentalWidget from '../widgets/TradingViewFundamentalWidget';
import TradingViewRecommendationWidget from '../widgets/TradingViewRecommendationWidget';
import { fetchTickerFinancials } from '../../services/apiService';

const TRADINGVIEW_EXCHANGE = 'NSE';

interface FinancialCardProps {
  financials?: QuarterlyFinancials | null;
  recommendation?: AnalystRecommendation | null;
  loading?: boolean;
  ticker?: string;
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16, ml: 0.5 }} />;
  if (value < 0) return <TrendingDownIcon sx={{ color: 'error.main', fontSize: 16, ml: 0.5 }} />;
  return null;
}

function ColoredValue({ value, suffix = '' }: { value: number; suffix?: string }) {
  const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
      <Typography variant="body2" sx={{ color, fontWeight: 500, whiteSpace: 'nowrap' }}>
        {value.toFixed(2)}{suffix}
      </Typography>
      <TrendIcon value={value} />
    </Box>
  );
}

export default function FinancialCard({ financials, recommendation, loading, ticker }: FinancialCardProps) {
  const [activeTab, setActiveTab] = useState(0);

  // Live data pulled directly from the ticker_financials table (via GET /api/financials/:ticker)
  const [liveFinancials, setLiveFinancials] = useState<QuarterlyFinancials | null>(null);
  const [liveRecommendation, setLiveRecommendation] = useState<AnalystRecommendation | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);

  const resolvedTicker = ticker || financials?.ticker || '';

  // Pull straight from the ticker_financials table whenever the ticker changes
  // (or the tab is opened), rather than relying solely on whatever the alert row cached.
  useEffect(() => {
    if (!resolvedTicker) return;
    let cancelled = false;

    setLiveLoading(true);
    setLiveError(false);
    fetchTickerFinancials(resolvedTicker)
      .then((res) => {
        if (cancelled) return;
        setLiveFinancials(res.financials || null);
        setLiveRecommendation(res.analystRecommendation || null);
      })
      .catch(() => {
        if (!cancelled) setLiveError(true);
      })
      .finally(() => {
        if (!cancelled) setLiveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedTicker]);

  // Prefer live ticker_financials data; fall back to what's cached on the alert row
  // (props passed in from SignalsTab / alerts.financials & alerts.analyst_recommendation columns).
  const effectiveFinancials = liveFinancials ?? financials ?? null;
  const effectiveRecommendation = liveRecommendation ?? recommendation ?? null;
  const isLoading = loading || liveLoading;

  if (isLoading && !effectiveFinancials && !effectiveRecommendation) {
    return (
      <Card sx={{ mt: 1, bgcolor: 'grey.50' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Loading financial data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!effectiveFinancials && !effectiveRecommendation && !resolvedTicker) return null;

  return (
    <Card sx={{ mt: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ mb: 1.5, minHeight: 32, '& .MuiTab-root': { minHeight: 32, py: 0.5, textTransform: 'none', fontSize: '0.8rem' } }}
        >
          <Tab label="📊 Quarterly Results & Analyst" />
          <Tab label="📈 TradingView Fundamentals" />
          <Tab label="🎯 TradingView Technical Analysis" />
        </Tabs>

        {/* Tab 0: Quarterly Results — pulled live from ticker_financials, falls back to alerts columns */}
        {activeTab === 0 && (
          <>
            {liveError && !financials && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 1 }}>
                Couldn't refresh from the financials cache — showing last-known data from this signal.
              </Typography>
            )}

            {effectiveFinancials && effectiveFinancials.quarters && effectiveFinancials.quarters.length > 0 ? (
              <>
                {/* Header with company name and summary */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    📊 {effectiveFinancials.company ? `${effectiveFinancials.company} (${effectiveFinancials.ticker})` : effectiveFinancials.ticker}
                  </Typography>
                  {effectiveFinancials.fetchedAt && (
                    <Tooltip title={`Data loaded: ${new Date(effectiveFinancials.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}>
                      <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    </Tooltip>
                  )}
                  {liveLoading && <CircularProgress size={12} />}
                </Box>

                {/* Summary chip */}
                {effectiveFinancials.summary && (
                  <Chip
                    label={effectiveFinancials.summary}
                    size="small"
                    variant="outlined"
                    color="info"
                    sx={{ mb: 1.5, fontSize: '0.75rem', fontWeight: 500 }}
                  />
                )}

                {/* Quarterly dates header row */}
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', minWidth: 120 }}>Metric</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                            {q.quarter}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>Revenue (B)</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{q.revenue.toFixed(2)}</Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>QoQ Rev Chg (%)</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <ColoredValue value={q.revenueChange} suffix="%" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>EPS YoY (%)</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <ColoredValue value={q.epsYoY} suffix="%" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>EBITDA (B)</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{q.ebitda.toFixed(2)}</Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>Op Margin (%)</TableCell>
                        {effectiveFinancials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <ColoredValue value={q.opMargin} suffix="%" />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Box sx={{ py: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No fundamental data available for <strong>{resolvedTicker}</strong>.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Upload financial data CSV via the "Upload Fundamentals CSV" button above.
                </Typography>
              </Box>
            )}

            {effectiveRecommendation && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  🎯 Analyst Recommendations — {effectiveRecommendation.totalAnalysts} Analysts
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Typography variant="body2">Consolidated:</Typography>
                  <ScoreBadge score={effectiveRecommendation.consolidatedScore} label={effectiveRecommendation.consolidatedRating} />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {effectiveRecommendation.ratings.map((r, i) => (
                    <Chip
                      key={i}
                      label={`${r.firm}: ${r.rating} (₹${r.targetPrice})`}
                      size="small"
                      variant="outlined"
                      color={
                        r.rating === 'Strong Buy' || r.rating === 'Buy'
                          ? 'success'
                          : r.rating === 'Hold'
                          ? 'warning'
                          : 'error'
                      }
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>
              </>
            )}
          </>
        )}

        {/* Tab 1: TradingView Fundamental Data Widget */}
        {activeTab === 1 && resolvedTicker && (
          <TradingViewFundamentalWidget ticker={resolvedTicker} exchange={TRADINGVIEW_EXCHANGE} />
        )}

        {/* Tab 2: TradingView Technical Analysis Widget */}
        {activeTab === 2 && resolvedTicker && (
          <TradingViewRecommendationWidget ticker={resolvedTicker} exchange={TRADINGVIEW_EXCHANGE} />
        )}
      </CardContent>
    </Card>
  );
}