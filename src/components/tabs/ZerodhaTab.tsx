import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  Card,
  CardContent,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../context/AppContext';
import { ZerodhaOrder, ZerodhaHolding } from '../../types';
import {
  getZerodhaStatus,
  getZerodhaLoginUrl,
  disconnectZerodha,
  fetchZerodhaOrders,
  fetchZerodhaHoldings,
  ZerodhaStatus,
} from '../../services/apiService';
import JsonInputModal from '../common/JsonInputModal';

const SAMPLE_ORDERS = JSON.stringify(
  [
    {
      orderId: 'ZRD001',
      ticker: 'GANECOS',
      exchange: 'NSE',
      type: 'BUY',
      quantity: 50,
      price: 842.5,
      timestamp: '2025-03-28T10:30:00Z',
      status: 'COMPLETE',
      productType: 'CNC',
      instrumentType: 'EQ',
    },
    {
      orderId: 'ZRD002',
      ticker: 'RELIANCE',
      exchange: 'NSE',
      type: 'BUY',
      quantity: 10,
      price: 2450.0,
      timestamp: '2025-03-27T11:15:00Z',
      status: 'COMPLETE',
      productType: 'CNC',
      instrumentType: 'EQ',
    },
    {
      orderId: 'ZRD003',
      ticker: 'TCS',
      exchange: 'NSE',
      type: 'SELL',
      quantity: 5,
      price: 3820.0,
      timestamp: '2025-03-26T14:00:00Z',
      status: 'COMPLETE',
      productType: 'CNC',
      instrumentType: 'EQ',
    },
  ],
  null,
  2
);

const SAMPLE_HOLDINGS = JSON.stringify(
  [
    {
      ticker: 'GANECOS',
      exchange: 'NSE',
      quantity: 50,
      averagePrice: 842.5,
      lastPrice: 856.3,
      pnl: 690,
      dayChange: 12.5,
      dayChangePercent: 1.48,
    },
    {
      ticker: 'RELIANCE',
      exchange: 'NSE',
      quantity: 10,
      averagePrice: 2450.0,
      lastPrice: 2510.0,
      pnl: 600,
      dayChange: -15.0,
      dayChangePercent: -0.59,
    },
    {
      ticker: 'INFY',
      exchange: 'NSE',
      quantity: 25,
      averagePrice: 1580.0,
      lastPrice: 1620.0,
      pnl: 1000,
      dayChange: 8.5,
      dayChangePercent: 0.53,
    },
  ],
  null,
  2
);

export default function ZerodhaTab() {
  const { state, dispatch } = useAppContext();
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [holdingsModalOpen, setHoldingsModalOpen] = useState(false);
  const [kiteStatus, setKiteStatus] = useState<ZerodhaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncingOrders, setSyncingOrders] = useState(false);
  const [syncingHoldings, setSyncingHoldings] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [switchToSecondary, setSwitchToSecondary] = useState(false);

  // Check Kite connection status on mount and handle OAuth callback params
  useEffect(() => {
    // Check if we're returning from Kite OAuth callback
    const params = new URLSearchParams(window.location.search);
    const zerodhaStatus = params.get('zerodha_status');
    if (zerodhaStatus === 'success') {
      setSyncSuccess(`Connected to Zerodha as ${params.get('user') || 'user'}`);
      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (zerodhaStatus === 'error') {
      setSyncError(`Zerodha login failed: ${params.get('message') || 'Unknown error'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Fetch current status
    checkKiteStatus();
  }, []);

  const checkKiteStatus = async () => {
    setLoadingStatus(true);
    try {
      const status = await getZerodhaStatus(switchToSecondary);
      setKiteStatus(status);
    } catch {
      setKiteStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleKiteLogin = () => {
    window.location.href = getZerodhaLoginUrl(switchToSecondary);
  };

  const handleKiteDisconnect = async () => {
    try {
      await disconnectZerodha();
      setKiteStatus((prev) => prev ? { ...prev, connected: false, userId: '' } : null);
      setSyncSuccess('Disconnected from Zerodha');
    } catch (err: any) {
      setSyncError(err.message || 'Failed to disconnect');
    }
  };

  const handleSyncOrders = async () => {
    setSyncingOrders(true);
    setSyncError(null);
    try {
      const { orders, count } = await fetchZerodhaOrders();
      const mapped: ZerodhaOrder[] = orders.map((o: any) => ({
        id: o.id || uuidv4(),
        orderId: o.orderId || o.id,
        ticker: o.ticker,
        exchange: o.exchange,
        type: o.type,
        quantity: o.quantity,
        price: o.price,
        timestamp: o.timestamp,
        status: o.status,
        productType: o.productType,
        instrumentType: o.instrumentType,
      }));
      dispatch({ type: 'SET_ZERODHA_ORDERS', payload: mapped });
      setSyncSuccess(`Synced ${count} orders from Zerodha`);
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED') {
        setSyncError('Zerodha session expired. Please login again.');
        setKiteStatus((prev) => prev ? { ...prev, connected: false } : null);
      } else {
        setSyncError(err.message || 'Failed to sync orders');
      }
    } finally {
      setSyncingOrders(false);
    }
  };

  const handleSyncHoldings = async () => {
    setSyncingHoldings(true);
    setSyncError(null);
    try {
      const { holdings, count } = await fetchZerodhaHoldings();
      const mapped: ZerodhaHolding[] = holdings.map((h: any) => ({
        ticker: h.ticker,
        exchange: h.exchange,
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        lastPrice: h.lastPrice,
        pnl: h.pnl,
        dayChange: h.dayChange,
        dayChangePercent: h.dayChangePercent,
      }));
      dispatch({ type: 'SET_ZERODHA_HOLDINGS', payload: mapped });
      setSyncSuccess(`Synced ${count} holdings from Zerodha`);
    } catch (err: any) {
      if (err.message === 'SESSION_EXPIRED') {
        setSyncError('Zerodha session expired. Please login again.');
        setKiteStatus((prev) => prev ? { ...prev, connected: false } : null);
      } else {
        setSyncError(err.message || 'Failed to sync holdings');
      }
    } finally {
      setSyncingHoldings(false);
    }
  };

  const handleSyncAll = async () => {
    await Promise.all([handleSyncOrders(), handleSyncHoldings()]);
  };

  const filteredOrders = state.globalTickerFilter
    ? state.zerodhaOrders.filter((o) =>
        o.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : state.zerodhaOrders;

  const filteredHoldings = state.globalTickerFilter
    ? state.zerodhaHoldings.filter((h) =>
        h.ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : state.zerodhaHoldings;

  const handleImportOrders = (data: any) => {
    const ordersArray = Array.isArray(data) ? data : [data];
    const newOrders: ZerodhaOrder[] = ordersArray.map((item: any) => ({
      id: uuidv4(),
      orderId: item.orderId || item.order_id || uuidv4().slice(0, 8),
      ticker: (item.ticker || item.tradingsymbol || '').trim(),
      exchange: item.exchange || 'NSE',
      type: (item.type || item.transaction_type || 'BUY').toUpperCase(),
      quantity: Number(item.quantity) || 0,
      price: Number(item.price || item.average_price) || 0,
      timestamp: item.timestamp || item.order_timestamp || new Date().toISOString(),
      status: (item.status || 'COMPLETE').toUpperCase(),
      productType: item.productType || item.product || 'CNC',
      instrumentType: item.instrumentType || item.instrument_type || 'EQ',
    }));
    dispatch({ type: 'ADD_ZERODHA_ORDERS', payload: newOrders });
  };

  const handleImportHoldings = (data: any) => {
    const holdingsArray = Array.isArray(data) ? data : [data];
    const newHoldings: ZerodhaHolding[] = holdingsArray.map((item: any) => ({
      ticker: (item.ticker || item.tradingsymbol || '').trim(),
      exchange: item.exchange || 'NSE',
      quantity: Number(item.quantity) || 0,
      averagePrice: Number(item.averagePrice || item.average_price) || 0,
      lastPrice: Number(item.lastPrice || item.last_price) || 0,
      pnl: Number(item.pnl) || 0,
      dayChange: Number(item.dayChange || item.day_change) || 0,
      dayChangePercent: Number(item.dayChangePercent || item.day_change_percentage) || 0,
    }));
    dispatch({ type: 'SET_ZERODHA_HOLDINGS', payload: newHoldings });
  };

  const handleDeleteOrder = (id: string) => {
    dispatch({
      type: 'SET_ZERODHA_ORDERS',
      payload: state.zerodhaOrders.filter((o) => o.id !== id),
    });
  };

  const totalHoldingsValue = state.zerodhaHoldings.reduce((sum, h) => sum + h.lastPrice * h.quantity, 0);
  const totalHoldingsPnl = state.zerodhaHoldings.reduce((sum, h) => sum + h.pnl, 0);
  const totalInvested = state.zerodhaHoldings.reduce((sum, h) => sum + h.averagePrice * h.quantity, 0);

  return (
    <Box>
      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Total Orders</Typography>
            <Typography variant="h5" fontWeight={700}>{state.zerodhaOrders.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Holdings</Typography>
            <Typography variant="h5" fontWeight={700}>{state.zerodhaHoldings.length}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Invested Value</Typography>
            <Typography variant="h5" fontWeight={700}>₹{totalInvested.toLocaleString('en-IN')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Current Value</Typography>
            <Typography variant="h5" fontWeight={700}>₹{totalHoldingsValue.toLocaleString('en-IN')}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">P&L</Typography>
            <Typography
              variant="h5"
              fontWeight={700}
              color={totalHoldingsPnl >= 0 ? 'success.main' : 'error.main'}
            >
              {totalHoldingsPnl >= 0 ? '+' : ''}₹{totalHoldingsPnl.toLocaleString('en-IN')}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Kite Connect Status Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Zerodha Kite Connect
          </Typography>

          {loadingStatus ? (
            <CircularProgress size={16} />
          ) : kiteStatus?.connected ? (
            <>
              <Chip
                icon={<CheckCircleOutlineIcon />}
                label={`Connected: ${kiteStatus.userId}`}
                color="success"
                size="small"
                variant="outlined"
              />
              {kiteStatus.loginTime && (
                <Typography variant="caption" color="text.secondary">
                  Since {new Date(kiteStatus.loginTime).toLocaleString('en-IN')}
                </Typography>
              )}
              <Tooltip title="Sync orders and holdings from Zerodha">
                <Button
                  variant="contained"
                  size="small"
                  startIcon={(syncingOrders || syncingHoldings) ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                  onClick={handleSyncAll}
                  disabled={syncingOrders || syncingHoldings}
                >
                  Sync All
                </Button>
              </Tooltip>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncingOrders ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleSyncOrders}
                disabled={syncingOrders}
              >
                Orders
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={syncingHoldings ? <CircularProgress size={16} /> : <SyncIcon />}
                onClick={handleSyncHoldings}
                disabled={syncingHoldings}
              >
                Holdings
              </Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="text"
                size="small"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={handleKiteDisconnect}
              >
                Disconnect
              </Button>
            </>
          ) : (
            <>
              <Chip
                icon={<ErrorOutlineIcon />}
                label={kiteStatus?.apiKeyConfigured ? 'Not Connected' : 'API Key Not Configured'}
                color={kiteStatus?.apiKeyConfigured ? 'warning' : 'error'}
                size="small"
                variant="outlined"
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<LoginIcon />}
                onClick={handleKiteLogin}
                disabled={!kiteStatus?.apiKeyConfigured}
              >
                Connect Zerodha
              </Button>
              {!kiteStatus?.apiKeyConfigured && (
                <Typography variant="caption" color="error">
                  Set KITE_API_KEY and KITE_API_SECRET in server/.env
                </Typography>
              )}
              <FormControlLabel
                  control={
                    <Switch
                        size="small"
                        checked={switchToSecondary}
                        onChange={(e) => setSwitchToSecondary(e.target.checked)}
                        disabled={kiteStatus?.connected}
                    />
                  }
                  label={<Typography variant="body2">Switch to Secondary Profile</Typography>}
              />
            </>
          )}
        </Box>
      </Paper>

      {/* Sync Feedback */}
      {syncSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSyncSuccess(null)}>
          {syncSuccess}
        </Alert>
      )}
      {syncError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSyncError(null)}>
          {syncError}
        </Alert>
      )}

      {/* Orders Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Zerodha Orders
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {kiteStatus?.connected && (
            <Button
              variant="contained"
              size="small"
              startIcon={syncingOrders ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleSyncOrders}
              disabled={syncingOrders}
            >
              Sync from Kite
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setOrdersModalOpen(true)}>
            Manual Import
          </Button>
        </Box>
      </Box>

      {filteredOrders.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {kiteStatus?.connected
            ? 'No orders yet. Click "Sync from Kite" to fetch today\'s orders from Zerodha.'
            : 'No orders imported. Connect Zerodha above or click "Manual Import" to paste order data.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600 }}>Order ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exchange</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Value</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {order.orderId}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.8rem' }}>
                      {new Date(order.timestamp).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{order.ticker}</Typography>
                    </TableCell>
                    <TableCell>{order.exchange}</TableCell>
                    <TableCell>
                      <Chip
                        label={order.type}
                        color={order.type === 'BUY' ? 'success' : 'error'}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>{order.quantity}</TableCell>
                    <TableCell>₹{order.price.toLocaleString('en-IN')}</TableCell>
                    <TableCell>₹{(order.price * order.quantity).toLocaleString('en-IN')}</TableCell>
                    <TableCell>
                      <Chip
                        label={order.status}
                        color={order.status === 'COMPLETE' ? 'success' : order.status === 'OPEN' ? 'warning' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{order.productType}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDeleteOrder(order.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Holdings Section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Zerodha Holdings / Portfolio
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {kiteStatus?.connected && (
            <Button
              variant="contained"
              size="small"
              startIcon={syncingHoldings ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleSyncHoldings}
              disabled={syncingHoldings}
            >
              Sync from Kite
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setHoldingsModalOpen(true)}>
            Manual Import
          </Button>
        </Box>
      </Box>

      {filteredHoldings.length === 0 ? (
        <Alert severity="info">
          {kiteStatus?.connected
            ? 'No holdings yet. Click "Sync from Kite" to fetch your portfolio from Zerodha.'
            : 'No holdings imported. Connect Zerodha above or click "Manual Import" to paste portfolio data.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exchange</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Avg Price</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>LTP</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Invested</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Current</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>P&L</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Day Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHoldings.map((holding, i) => (
                <TableRow key={i} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{holding.ticker}</Typography>
                  </TableCell>
                  <TableCell>{holding.exchange}</TableCell>
                  <TableCell>{holding.quantity}</TableCell>
                  <TableCell>₹{holding.averagePrice.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{holding.lastPrice.toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{(holding.averagePrice * holding.quantity).toLocaleString('en-IN')}</TableCell>
                  <TableCell>₹{(holding.lastPrice * holding.quantity).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color={holding.pnl >= 0 ? 'success.main' : 'error.main'}
                    >
                      {holding.pnl >= 0 ? '+' : ''}₹{holding.pnl.toLocaleString('en-IN')}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={`${holding.dayChange >= 0 ? '+' : ''}${holding.dayChange.toFixed(2)} (${holding.dayChangePercent.toFixed(2)}%)`}
                      color={holding.dayChange >= 0 ? 'success' : 'error'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <JsonInputModal
        open={ordersModalOpen}
        onClose={() => setOrdersModalOpen(false)}
        onSubmit={handleImportOrders}
        title="Import Zerodha Orders"
        description="Paste your Zerodha order data as JSON. Supports Zerodha API format (tradingsymbol, transaction_type, etc.) or simplified format."
        sampleJson={SAMPLE_ORDERS}
      />

      <JsonInputModal
        open={holdingsModalOpen}
        onClose={() => setHoldingsModalOpen(false)}
        onSubmit={handleImportHoldings}
        title="Import Zerodha Holdings"
        description="Paste your Zerodha portfolio/holdings data as JSON."
        sampleJson={SAMPLE_HOLDINGS}
      />
    </Box>
  );
}

