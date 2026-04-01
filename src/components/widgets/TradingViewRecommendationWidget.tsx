import React, { memo, useMemo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewRecommendationWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Technical Analysis widget via the official widget iframe URL.
 */
function TradingViewRecommendationWidget({ ticker, exchange = 'NSE' }: TradingViewRecommendationWidgetProps) {
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      symbol: `${exchange}:${ticker}`,
      colorTheme: 'light',
      isTransparent: 'false',
      showIntervalTabs: 'true',
      displayMode: 'single',
      interval: '1W',
      locale: 'en',
    });
    return `https://www.tradingview-widget.com/embed-widget/technical-analysis/?${params.toString()}`;
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
        }}
      >
        <iframe
          key={`technical-${exchange}-${ticker}`}
          src={iframeSrc}
          title={`TradingView Technical Analysis ${exchange}:${ticker}`}
          style={{
            width: '100%',
            height: 425,
            border: 'none',
            display: 'block',
          }}
          allowTransparency
          frameBorder={0}
          loading="lazy"
        />
      </Box>
    </Box>
  );
}

export default memo(TradingViewRecommendationWidget);
