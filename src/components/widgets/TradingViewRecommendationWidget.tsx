import React, { memo, useMemo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewRecommendationWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Technical Analysis widget via iframe.
 * This approach avoids WebSocket/CORS issues on deployed environments (Vercel etc.)
 */
function TradingViewRecommendationWidget({ ticker, exchange = 'NSE' }: TradingViewRecommendationWidgetProps) {
  const iframeSrc = useMemo(() => {
    const config = encodeURIComponent(JSON.stringify({
      interval: '1W',
      isTransparent: false,
      symbol: `${exchange}:${ticker}`,
      showIntervalTabs: true,
      displayMode: 'single',
      locale: 'en',
      colorTheme: 'light',
    }));
    return `https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.html#${config}`;
  }, [ticker, exchange]);

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        TradingView Technical Analysis — {exchange}:{ticker}
      </Typography>
      <Box
        sx={{
          border: '1px solid',
          borderColor: 'grey.200',
          borderRadius: 1,
          overflow: 'hidden',
          minHeight: 400,
        }}
      >
        <iframe
          key={`${exchange}:${ticker}`}
          src={iframeSrc}
          title={`TradingView Technical Analysis ${exchange}:${ticker}`}
          style={{
            width: '100%',
            height: 400,
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

export default memo(TradingViewRecommendationWidget);

