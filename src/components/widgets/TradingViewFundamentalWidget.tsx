import React, { useEffect, useRef, memo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewFundamentalWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Fundamental Data widget.
 * Shows company financial overview including revenue, EPS, margins etc.
 */
function TradingViewFundamentalWidget({ ticker, exchange = 'NSE' }: TradingViewFundamentalWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-financials.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      isTransparent: false,
      largeChartUrl: '',
      displayMode: 'regular',
      width: '100%',
      height: 400,
      colorTheme: 'light',
      symbol: `${exchange}:${ticker}`,
      locale: 'en',
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [ticker, exchange]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        TradingView Fundamentals — {exchange}:{ticker}
      </Typography>
      <Box
        ref={containerRef}
        className="tradingview-widget-container"
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 1,
          overflow: 'hidden',
          minHeight: 400,
        }}
      />
    </Box>
  );
}

export default memo(TradingViewFundamentalWidget);


