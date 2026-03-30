import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Container,
  Chip,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import { AppProvider, useAppContext } from './context/AppContext';
import { logout, isLoggedIn, verifyToken, getUsername, clearAllData } from './services/apiService';
import SignalsTab from './components/tabs/SignalsTab';
import ZerodhaTab from './components/tabs/ZerodhaTab';
import MatchedTab from './components/tabs/MatchedTab';
import PnLTab from './components/tabs/PnLTab';
import Login from './components/Login';

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#f57c00' },
    background: { default: '#f5f5f5' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

function AppContent({ onLogout }: { onLogout: () => void }) {
  const { state, dispatch, isLoading } = useAppContext();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false, message: '', severity: 'info',
  });

  const handleExport = () => {
    const data = JSON.stringify({
      alerts: state.alerts,
      zerodhaOrders: state.zerodhaOrders,
      zerodhaHoldings: state.zerodhaHoldings,
      matchedTrades: state.matchedTrades,
      pnlEntries: state.pnlEntries,
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-aggregator-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSnackbar({ open: true, message: 'Data exported successfully!', severity: 'success' });
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      try {
        await clearAllData();
        dispatch({ type: 'CLEAR_ALL' });
        setSnackbar({ open: true, message: 'All data cleared.', severity: 'info' });
      } catch {
        setSnackbar({ open: true, message: 'Failed to clear data.', severity: 'error' });
      }
    }
  };

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const tabConfig = [
    { label: 'Signals', icon: <NotificationsIcon />, count: state.alerts.length },
    { label: 'Zerodha', icon: <AccountBalanceIcon />, count: state.zerodhaOrders.length },
    { label: 'Matched', icon: <CompareArrowsIcon />, count: state.matchedTrades.length },
    { label: 'P&L', icon: <AssessmentIcon />, count: state.pnlEntries.length },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <CircularProgress size={48} />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="static" elevation={0} sx={{ bgcolor: 'primary.main' }}>
        <Toolbar>
          <ShowChartIcon sx={{ mr: 1.5 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 0, mr: 4 }}>
            Trade Aggregator
          </Typography>

          {/* Global Ticker Filter */}
          <TextField
            size="small"
            placeholder="Filter by ticker..."
            value={state.globalTickerFilter}
            onChange={(e) => dispatch({ type: 'SET_TICKER_FILTER', payload: e.target.value })}
            sx={{
              bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 1, mr: 2, width: 220,
              '& .MuiOutlinedInput-root': { color: 'white', '& fieldset': { border: 'none' } },
              '& .MuiInputBase-input::placeholder': { color: 'rgba(255,255,255,0.7)', opacity: 1 },
            }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'rgba(255,255,255,0.7)' }} /></InputAdornment>,
              endAdornment: state.globalTickerFilter ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => dispatch({ type: 'SET_TICKER_FILTER', payload: '' })} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />

          {state.globalTickerFilter && (
            <Chip label={`Filtering: ${state.globalTickerFilter.toUpperCase()}`} onDelete={() => dispatch({ type: 'SET_TICKER_FILTER', payload: '' })} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', mr: 2 }} />
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* User Info & Actions */}
          <Chip icon={<PersonIcon />} label={getUsername()} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', mr: 1 }} />

          {/* Data Management */}
          <Tooltip title="Export All Data">
            <IconButton color="inherit" onClick={handleExport}><DownloadIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Clear All Data">
            <IconButton color="inherit" onClick={handleClearAll}><DeleteSweepIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Logout">
            <IconButton color="inherit" onClick={handleLogout}><LogoutIcon /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Tab Navigation */}
      <Box sx={{ bgcolor: 'white', borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={state.activeTab} onChange={(_, v) => dispatch({ type: 'SET_ACTIVE_TAB', payload: v })} indicatorColor="primary" textColor="primary">
          {tabConfig.map((tab, i) => (
            <Tab key={i} label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {tab.icon}{tab.label}
                {tab.count > 0 && <Chip label={tab.count} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />}
              </Box>
            } sx={{ textTransform: 'none', fontWeight: 600, minHeight: 56 }} />
          ))}
        </Tabs>
      </Box>

      {/* Content */}
      <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
        {state.activeTab === 0 && <SignalsTab />}
        {state.activeTab === 1 && <ZerodhaTab />}
        {state.activeTab === 2 && <MatchedTab />}
        {state.activeTab === 3 && <PnLTab />}
      </Container>

      {/* Footer */}
      <Box sx={{ bgcolor: 'grey.100', py: 1.5, px: 3, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" align="center" display="block">
          Trade Aggregator & Analysis Dashboard — Data persisted in PostgreSQL
        </Typography>
      </Box>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      verifyToken().then((valid) => setAuthenticated(valid));
    } else {
      setAuthenticated(false);
    }
  }, []);

  if (authenticated === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  if (!authenticated) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Login onLogin={() => setAuthenticated(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppProvider>
        <AppContent onLogout={() => setAuthenticated(false)} />
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
