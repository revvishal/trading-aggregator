import React from 'react';
import { Chip } from '@mui/material';

interface ScoreBadgeProps {
  score: number;
  label?: string;
}

export default function ScoreBadge({ score, label }: ScoreBadgeProps) {
  let color: 'success' | 'warning' | 'error' | 'info' | 'default';
  let displayLabel: string;

  if (score >= 4.5) {
    color = 'success';
    displayLabel = label || 'Strong Buy';
  } else if (score >= 3.5) {
    color = 'success';
    displayLabel = label || 'Buy';
  } else if (score >= 2.5) {
    color = 'warning';
    displayLabel = label || 'Hold';
  } else if (score >= 1.5) {
    color = 'error';
    displayLabel = label || 'Sell';
  } else {
    color = 'error';
    displayLabel = label || 'Strong Sell';
  }

  return (
    <Chip
      label={`${displayLabel} (${score.toFixed(1)})`}
      color={color}
      size="small"
      sx={{ fontWeight: 600 }}
    />
  );
}

