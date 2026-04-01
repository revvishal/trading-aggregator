import React, { useState } from 'react';
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
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { QuarterlyFinancials, AnalystRecommendation } from '../../types';
import ScoreBadge from './ScoreBadge';
import TradingViewFundamentalWidget from '../widgets/TradingViewFundamentalWidget';
import TradingViewRecommendationWidget from '../widgets/TradingViewRecommendationWidget';

interface FinancialCardProps {
  financials?: QuarterlyFinancials | null;
  recommendation?: AnalystRecommendation | null;
  loading?: boolean;
  ticker?: string;
  exchange?: string;
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUpIcon sx={{ color: 'success.main', fontSize: 16, ml: 0.5 }} />;
  if (value < 0) return <TrendingDownIcon sx={{ color: 'error.main', fontSize: 16, ml: 0.5 }} />;
  return null;
}

function ColoredValue({ value, suffix = '' }: { value: number; suffix?: string }) {
  const color = value > 0 ? 'success.main' : value < 0 ? 'error.main' : 'text.primary';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" sx={{ color, fontWeight: 500 }}>
        {value.toFixed(2)}{suffix}
      </Typography>
      <TrendIcon value={value} />
    </Box>
  );
}

export default function FinancialCard({ financials, recommendation, loading, ticker, exchange = 'NSE' }: FinancialCardProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (loading) {
    return (
      <Card sx={{ mt: 1, bgcolor: 'grey.50' }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Loading financial data...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (!financials && !recommendation && !ticker) return null;

  const resolvedTicker = ticker || financials?.ticker || '';

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

        {/* Tab 0: Quarterly Results from CSV data */}
        {activeTab === 0 && (
          <>
            {financials && financials.quarters && financials.quarters.length > 0 ? (
              <>
                {/* Header with company name and summary */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    📊 {financials.company ? `${financials.company} (${financials.ticker})` : financials.ticker}
                  </Typography>
                  {financials.fetchedAt && (
                    <Tooltip title={`Data loaded: ${new Date(financials.fetchedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`}>
                      <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                    </Tooltip>
                  )}
                </Box>

                {/* Summary chip */}
                {financials.summary && (
                  <Chip
                    label={financials.summary}
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
                        {financials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                            {q.quarter}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>Revenue (B)</TableCell>
                        {financials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{q.revenue.toFixed(2)}</Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>QoQ Rev Chg (%)</TableCell>
                        {financials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <ColoredValue value={q.revenueChange} suffix="%" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>EPS YoY (%)</TableCell>
                        {financials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <ColoredValue value={q.epsYoY} suffix="%" />
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>EBITDA (B)</TableCell>
                        {financials.quarters.map((q) => (
                          <TableCell key={q.quarter} align="right">
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{q.ebitda.toFixed(2)}</Typography>
                          </TableCell>
                        ))}
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontSize: '0.75rem' }}>Op Margin (%)</TableCell>
                        {financials.quarters.map((q) => (
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

            {recommendation && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                  🎯 Analyst Recommendations — {recommendation.totalAnalysts} Analysts
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                  <Typography variant="body2">Consolidated:</Typography>
                  <ScoreBadge score={recommendation.consolidatedScore} label={recommendation.consolidatedRating} />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {recommendation.ratings.map((r, i) => (
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
          <TradingViewFundamentalWidget ticker={resolvedTicker} exchange={exchange} />
        )}

        {/* Tab 2: TradingView Technical Analysis Widget */}
        {activeTab === 2 && resolvedTicker && (
          <TradingViewRecommendationWidget ticker={resolvedTicker} exchange={exchange} />
        )}
      </CardContent>
    </Card>
  );
}
