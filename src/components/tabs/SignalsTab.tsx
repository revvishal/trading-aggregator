import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  IconButton,
  Collapse,
  Tooltip,
  Alert,
  Card,
  CardContent,
  Stack,
  Badge,
  CircularProgress,
  Switch,
  FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import RefreshIcon from '@mui/icons-material/Refresh';
import SyncIcon from '@mui/icons-material/Sync';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import { v4 as uuidv4 } from 'uuid';
import { useAppContext } from '../../context/AppContext';
import { TradingViewAlert } from '../../types';
import { getFinancialData, getAnalystRecommendation } from '../../services/financialService';
import { fetchWebhookAlerts, fetchWebhookAlertCount, checkServerHealth } from '../../services/apiService';
import JsonInputModal from '../common/JsonInputModal';
import FinancialCard from '../common/FinancialCard';

const SAMPLE_ALERT = JSON.stringify(
  [
    {
      Exchange: 'NSE',
      Close: 846,
      Ticker: 'GANECOS',
      OrderType: 'ADD',
      ProductType: 'CNC',
      InstrumentType: 'EQ',
      Quantity: 1,
      Strategy: 'PRO1',
      Code: '16D2229D88875U',
    },
  ],
  null,
  2
);

const orderTypeColor: Record<string, 'success' | 'error' | 'info' | 'warning'> = {
  BUY: 'success',
  SELL: 'error',
  ADD: 'info',
  REMOVE: 'warning',
};

const statusColor: Record<string, 'success' | 'warning' | 'default'> = {
  ACTIONED: 'success',
  PENDING: 'warning',
  IGNORED: 'default',
};

export default function SignalsTab() {
  const { state, dispatch } = useAppContext();
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loadingFinancials, setLoadingFinancials] = useState<Set<string>>(new Set());
  const [webhookSyncing, setWebhookSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<string>(new Date().toISOString());

  // Check server health on mount
  useEffect(() => {
    checkServerHealth()
      .then(() => setServerOnline(true))
      .catch(() => setServerOnline(false));
  }, []);

  // Auto-polling for new webhook alerts
  useEffect(() => {
    if (autoSync && serverOnline) {
      const poll = async () => {
        try {
          const { count } = await fetchWebhookAlertCount(lastFetchRef.current);
          setNewAlertCount(count);
          if (count > 0) {
            await syncWebhookAlerts();
          }
        } catch {
          // Silently ignore polling errors
        }
      };
      pollingRef.current = setInterval(poll, 15000); // Poll every 15 seconds
      poll(); // Immediate first poll
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSync, serverOnline]);

  // Sync webhook alerts from server
  const syncWebhookAlerts = async () => {
    setWebhookSyncing(true);
    setSyncError(null);
    try {
      const { alerts: webhookAlerts } = await fetchWebhookAlerts(lastFetchRef.current);
      if (webhookAlerts.length > 0) {
        // Filter out alerts already in state (by checking id)
        const existingIds = new Set(state.alerts.map((a) => a.id));
        const newAlerts: TradingViewAlert[] = webhookAlerts
          .filter((wa: any) => !existingIds.has(wa.id))
          .map((item: any) => ({
            id: item.id || uuidv4(),
            timestamp: item.timestamp || new Date().toISOString(),
            Exchange: item.Exchange || 'NSE',
            Close: Number(item.Close) || 0,
            Ticker: (item.Ticker || '').trim(),
            OrderType: (item.OrderType || 'BUY').trim(),
            ProductType: item.ProductType || 'CNC',
            InstrumentType: item.InstrumentType || 'EQ',
            Quantity: Number(item.Quantity) || 1,
            Strategy: item.Strategy || '',
            Code: item.Code || '',
            status: 'PENDING' as const,
          }));

        if (newAlerts.length > 0) {
          dispatch({ type: 'ADD_ALERTS', payload: newAlerts });
          // Auto-fetch financials for new alerts
          newAlerts.forEach((alert) => fetchFinancials(alert));
        }
        lastFetchRef.current = new Date().toISOString();
        setLastSyncTime(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        setNewAlertCount(0);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Failed to sync webhook alerts');
      setServerOnline(false);
    } finally {
      setWebhookSyncing(false);
    }
  };

  const filteredAlerts = state.globalTickerFilter
    ? state.alerts.filter((a) =>
        a.Ticker.toUpperCase().includes(state.globalTickerFilter.toUpperCase())
      )
    : state.alerts;

  const fetchFinancials = useCallback(async (alert: TradingViewAlert) => {
    setLoadingFinancials((prev) => new Set(prev).add(alert.id));
    try {
      const [financials, recommendation] = await Promise.all([
        getFinancialData(alert.Ticker),
        getAnalystRecommendation(alert.Ticker),
      ]);
      dispatch({
        type: 'UPDATE_ALERT',
        payload: { ...alert, financials, analystRecommendation: recommendation },
      });
    } catch (e) {
      console.error('Failed to fetch financials', e);
    } finally {
      setLoadingFinancials((prev) => {
        const next = new Set(prev);
        next.delete(alert.id);
        return next;
      });
    }
  }, [dispatch]);

  const handleImport = useCallback(
    (data: any) => {
      const alertsArray = Array.isArray(data) ? data : [data];
      const newAlerts: TradingViewAlert[] = alertsArray.map((item: any) => ({
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        Exchange: item.Exchange || 'NSE',
        Close: Number(item.Close) || 0,
        Ticker: (item.Ticker || '').trim(),
        OrderType: (item.OrderType || 'BUY').trim(),
        ProductType: item.ProductType || 'CNC',
        InstrumentType: item.InstrumentType || 'EQ',
        Quantity: Number(item.Quantity) || 1,
        Strategy: item.Strategy || '',
        Code: item.Code || '',
        status: 'PENDING',
      }));

      dispatch({ type: 'ADD_ALERTS', payload: newAlerts });

      // Auto-fetch financials for each new alert
      newAlerts.forEach((alert) => {
        fetchFinancials(alert);
      });
    },
    [dispatch, fetchFinancials]
  );

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStatusChange = (alert: TradingViewAlert, status: 'ACTIONED' | 'IGNORED') => {
    dispatch({ type: 'UPDATE_ALERT', payload: { ...alert, status } });
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_ALERT', payload: id });
  };

  const stats = {
    total: state.alerts.length,
    pending: state.alerts.filter((a) => a.status === 'PENDING').length,
    actioned: state.alerts.filter((a) => a.status === 'ACTIONED').length,
    ignored: state.alerts.filter((a) => a.status === 'IGNORED').length,
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1, bgcolor: 'primary.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Total Signals</Typography>
            <Typography variant="h5" fontWeight={700}>{stats.total}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: 'warning.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Pending</Typography>
            <Typography variant="h5" fontWeight={700} color="warning.main">{stats.pending}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: 'success.50' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Actioned</Typography>
            <Typography variant="h5" fontWeight={700} color="success.main">{stats.actioned}</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, bgcolor: 'grey.100' }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary">Ignored</Typography>
            <Typography variant="h5" fontWeight={700} color="text.secondary">{stats.ignored}</Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Webhook Status Bar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {serverOnline === null ? (
            <CircularProgress size={16} />
          ) : serverOnline ? (
            <WifiIcon color="success" fontSize="small" />
          ) : (
            <WifiOffIcon color="error" fontSize="small" />
          )}
          <Typography variant="body2" color={serverOnline ? 'success.main' : 'text.secondary'}>
            {serverOnline === null ? 'Checking server...' : serverOnline ? 'Server Online' : 'Server Offline'}
          </Typography>
        </Box>

        <Tooltip title="Manually sync new alerts from webhook endpoint">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={webhookSyncing ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={syncWebhookAlerts}
              disabled={webhookSyncing || !serverOnline}
            >
              <Badge badgeContent={newAlertCount} color="error" sx={{ '& .MuiBadge-badge': { right: -12, top: -4 } }}>
                Sync Webhook
              </Badge>
            </Button>
          </span>
        </Tooltip>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              disabled={!serverOnline}
            />
          }
          label={<Typography variant="body2">Auto-sync (15s)</Typography>}
        />

        {lastSyncTime && (
          <Typography variant="caption" color="text.secondary">
            Last sync: {lastSyncTime}
          </Typography>
        )}

        {syncError && (
          <Chip label={syncError} color="error" size="small" variant="outlined" onDelete={() => setSyncError(null)} />
        )}

        <Box sx={{ flexGrow: 1 }} />

        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
          POST /api/webhook
        </Typography>
      </Paper>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          TradingView Signals
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
            Manual Input
          </Button>
        </Box>
      </Box>

      {filteredAlerts.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No signals yet. Configure TradingView to POST alerts to <strong>/api/webhook</strong>, then click "Sync Webhook" — or use "Manual Input" to paste JSON directly.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell width={40} />
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Ticker</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Exchange</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Order</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Close</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Strategy</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAlerts
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .map((alert) => (
                  <React.Fragment key={alert.id}>
                    <TableRow
                      hover
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <TableCell>
                        <IconButton size="small" onClick={() => toggleExpand(alert.id)}>
                          {expandedRows.has(alert.id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.8rem' }}>
                        {new Date(alert.timestamp).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {alert.Ticker}
                        </Typography>
                      </TableCell>
                      <TableCell>{alert.Exchange}</TableCell>
                      <TableCell>
                        <Chip
                          label={alert.OrderType}
                          color={orderTypeColor[alert.OrderType.trim()] || 'default'}
                          size="small"
                          sx={{ fontWeight: 600, minWidth: 60 }}
                        />
                      </TableCell>
                      <TableCell>₹{alert.Close.toLocaleString()}</TableCell>
                      <TableCell>
                        <Chip label={alert.Strategy} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={alert.status}
                          color={statusColor[alert.status]}
                          size="small"
                          variant={alert.status === 'PENDING' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        {alert.analystRecommendation && (
                          <Chip
                            label={`${alert.analystRecommendation.consolidatedScore.toFixed(1)}`}
                            size="small"
                            color={
                              alert.analystRecommendation.consolidatedScore >= 3.5
                                ? 'success'
                                : alert.analystRecommendation.consolidatedScore >= 2.5
                                ? 'warning'
                                : 'error'
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                          {alert.status === 'PENDING' && (
                            <>
                              <Tooltip title="Mark as Actioned">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleStatusChange(alert, 'ACTIONED')}
                                >
                                  <CheckCircleIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Ignore Signal">
                                <IconButton
                                  size="small"
                                  color="default"
                                  onClick={() => handleStatusChange(alert, 'IGNORED')}
                                >
                                  <CancelIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="Refresh Financials">
                            <IconButton
                              size="small"
                              onClick={() => fetchFinancials(alert)}
                              disabled={loadingFinancials.has(alert.id)}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(alert.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={10} sx={{ py: 0, borderBottom: expandedRows.has(alert.id) ? undefined : 'none' }}>
                        <Collapse in={expandedRows.has(alert.id)} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 1, px: 2 }}>
                            <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                              <Typography variant="caption">
                                <strong>Product:</strong> {alert.ProductType}
                              </Typography>
                              <Typography variant="caption">
                                <strong>Instrument:</strong> {alert.InstrumentType}
                              </Typography>
                              <Typography variant="caption">
                                <strong>Qty (Signal):</strong> {alert.Quantity}
                              </Typography>
                              <Typography variant="caption">
                                <strong>Code:</strong> {alert.Code}
                              </Typography>
                            </Box>
                            <FinancialCard
                              financials={alert.financials}
                              recommendation={alert.analystRecommendation}
                              loading={loadingFinancials.has(alert.id)}
                              ticker={alert.Ticker}
                              exchange={alert.Exchange}
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <JsonInputModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleImport}
        title="Add TradingView Signal"
        description="Paste the JSON payload received from TradingView webhook alert. Supports single object or array of objects."
        sampleJson={SAMPLE_ALERT}
      />
    </Box>
  );
}

