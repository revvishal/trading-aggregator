import React, { useEffect, useRef, memo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewRecommendationWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Technical Analysis widget showing analyst recommendations.
 */
function TradingViewRecommendationWidget({ ticker, exchange = 'NSE' }: TradingViewRecommendationWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: '1W',
      width: '100%',
      isTransparent: false,
      height: 350,
      symbol: `${exchange}:${ticker}`,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'en',
      colorTheme: 'light',
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [ticker, exchange]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        TradingView Technical Analysis — {exchange}:{ticker}
      </Typography>
      <Box
        ref={containerRef}
        className="tradingview-widget-container"
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 1,
          overflow: 'hidden',
          minHeight: 350,
        }}
      />
    </Box>
  );
}

export default memo(TradingViewRecommendationWidget);


