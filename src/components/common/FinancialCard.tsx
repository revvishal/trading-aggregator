import React from 'react';
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
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { QuarterlyFinancials, AnalystRecommendation } from '../../types';
import ScoreBadge from './ScoreBadge';

interface FinancialCardProps {
  financials?: QuarterlyFinancials;
  recommendation?: AnalystRecommendation;
  loading?: boolean;
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

export default function FinancialCard({ financials, recommendation, loading }: FinancialCardProps) {
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

  if (!financials && !recommendation) return null;

  return (
    <Card sx={{ mt: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {financials && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
              📊 Quarterly Results — {financials.ticker}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Metric</TableCell>
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
                        <ColoredValue value={q.revenue} />
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
                    <TableCell sx={{ fontSize: '0.75rem' }}>EBITDA (M)</TableCell>
                    {financials.quarters.map((q) => (
                      <TableCell key={q.quarter} align="right">
                        <ColoredValue value={q.ebitda} />
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
      </CardContent>
    </Card>
  );
}

