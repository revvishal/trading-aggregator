import React, { memo, useMemo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewFundamentalWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Fundamental Data widget via iframe.
 * This approach avoids WebSocket/CORS issues on deployed environments (Vercel etc.)
 * by loading TradingView's widget page directly in an iframe.
 */
function TradingViewFundamentalWidget({ ticker, exchange = 'NSE' }: TradingViewFundamentalWidgetProps) {
  const iframeSrc = useMemo(() => {
    const config = encodeURIComponent(JSON.stringify({
      isTransparent: false,
      largeChartUrl: '',
      displayMode: 'regular',
      colorTheme: 'light',
      symbol: `${exchange}:${ticker}`,
      locale: 'en',
    }));
    return `https://s3.tradingview.com/external-embedding/embed-widget-financials.html#${config}`;
  }, [ticker, exchange]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        TradingView Fundamentals — {exchange}:{ticker}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 1,
          overflow: 'hidden',
          minHeight: 450,
        }}
      >
        <iframe
          key={`${exchange}:${ticker}`}
          src={iframeSrc}
          title={`TradingView Fundamentals ${exchange}:${ticker}`}
          style={{
            width: '100%',
            height: 450,
            border: 'none',
            display: 'block',
          }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
        />
      </Box>
    </Box>
  );
}

export default memo(TradingViewFundamentalWidget);
