import React, { memo, useMemo } from 'react';
import { Box, Typography } from '@mui/material';

interface TradingViewFundamentalWidgetProps {
  ticker: string;
  exchange?: string;
}

/**
 * Embeds the TradingView Fundamental Data widget via the official widget iframe URL.
 */
function TradingViewFundamentalWidget({ ticker, exchange = 'NSE' }: TradingViewFundamentalWidgetProps) {
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      symbol: `${exchange}:${ticker}`,
      colorTheme: 'light',
      isTransparent: 'false',
      displayMode: 'regular',
      locale: 'en',
    });
    return `https://www.tradingview-widget.com/embed-widget/financials/?${params.toString()}`;
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
        }}
      >
        <iframe
          key={`fundamental-${exchange}-${ticker}`}
          src={iframeSrc}
          title={`TradingView Fundamentals ${exchange}:${ticker}`}
          style={{
            width: '100%',
            height: 490,
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

export default memo(TradingViewFundamentalWidget);
