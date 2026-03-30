import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, ReactNode } from 'react';
import {
  AppState,
  TradingViewAlert,
  ZerodhaOrder,
  ZerodhaHolding,
  MatchedTrade,
  PnLEntry,
} from '../types';
import {
  fetchAlerts,
  saveAlerts,
  fetchOrders,
  saveOrders,
  fetchHoldings as fetchHoldingsApi,
  saveHoldings,
  fetchMatchedTrades,
  saveMatchedTrades,
  fetchPnlEntries,
  savePnlEntries,
  isLoggedIn,
} from '../services/apiService';

type Action =
  | { type: 'ADD_ALERTS'; payload: TradingViewAlert[] }
  | { type: 'UPDATE_ALERT'; payload: TradingViewAlert }
  | { type: 'DELETE_ALERT'; payload: string }
  | { type: 'SET_ALERTS'; payload: TradingViewAlert[] }
  | { type: 'SET_ZERODHA_ORDERS'; payload: ZerodhaOrder[] }
  | { type: 'ADD_ZERODHA_ORDERS'; payload: ZerodhaOrder[] }
  | { type: 'SET_ZERODHA_HOLDINGS'; payload: ZerodhaHolding[] }
  | { type: 'SET_MATCHED_TRADES'; payload: MatchedTrade[] }
  | { type: 'SET_PNL_ENTRIES'; payload: PnLEntry[] }
  | { type: 'SET_TICKER_FILTER'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_ALL'; payload: Partial<AppState> };

const initialState: AppState = {
  alerts: [],
  zerodhaOrders: [],
  zerodhaHoldings: [],
  matchedTrades: [],
  pnlEntries: [],
  globalTickerFilter: '',
  activeTab: 0,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_ALERTS':
      return { ...state, alerts: [...state.alerts, ...action.payload] };
    case 'UPDATE_ALERT':
      return { ...state, alerts: state.alerts.map((a) => (a.id === action.payload.id ? action.payload : a)) };
    case 'DELETE_ALERT':
      return { ...state, alerts: state.alerts.filter((a) => a.id !== action.payload) };
    case 'SET_ALERTS':
      return { ...state, alerts: action.payload };
    case 'SET_ZERODHA_ORDERS':
      return { ...state, zerodhaOrders: action.payload };
    case 'ADD_ZERODHA_ORDERS':
      return { ...state, zerodhaOrders: [...state.zerodhaOrders, ...action.payload] };
    case 'SET_ZERODHA_HOLDINGS':
      return { ...state, zerodhaHoldings: action.payload };
    case 'SET_MATCHED_TRADES':
      return { ...state, matchedTrades: action.payload };
    case 'SET_PNL_ENTRIES':
      return { ...state, pnlEntries: action.payload };
    case 'SET_TICKER_FILTER':
      return { ...state, globalTickerFilter: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LOADING':
      return state; // handled externally
    case 'CLEAR_ALL':
      return { ...initialState };
    case 'LOAD_ALL':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [isLoading, setIsLoading] = React.useState(true);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const initialLoadDone = useRef(false);

  // Load all data from API on mount
  useEffect(() => {
    if (!isLoggedIn()) { setIsLoading(false); return; }

    const loadAll = async () => {
      try {
        const [alerts, orders, holdings, matched, pnl] = await Promise.all([
          fetchAlerts().catch(() => []),
          fetchOrders().catch(() => []),
          fetchHoldingsApi().catch(() => []),
          fetchMatchedTrades().catch(() => []),
          fetchPnlEntries().catch(() => []),
        ]);
        dispatch({
          type: 'LOAD_ALL',
          payload: { alerts, zerodhaOrders: orders, zerodhaHoldings: holdings, matchedTrades: matched, pnlEntries: pnl },
        });
      } catch (err) {
        console.error('Failed to load data from server:', err);
      } finally {
        setIsLoading(false);
        initialLoadDone.current = true;
      }
    };
    loadAll();
  }, []);

  // Debounced save helper
  const debouncedSave = useCallback((key: string, saveFn: () => Promise<void>) => {
    if (!initialLoadDone.current) return; // Don't save during initial load
    if (saveTimeoutRef.current[key]) clearTimeout(saveTimeoutRef.current[key]);
    saveTimeoutRef.current[key] = setTimeout(() => {
      saveFn().catch((err) => console.error(`Failed to save ${key}:`, err));
    }, 500);
  }, []);

  // Persist to DB on state changes (debounced)
  useEffect(() => {
    debouncedSave('alerts', () => saveAlerts(state.alerts));
  }, [state.alerts, debouncedSave]);

  useEffect(() => {
    debouncedSave('orders', () => saveOrders(state.zerodhaOrders));
  }, [state.zerodhaOrders, debouncedSave]);

  useEffect(() => {
    debouncedSave('holdings', () => saveHoldings(state.zerodhaHoldings));
  }, [state.zerodhaHoldings, debouncedSave]);

  useEffect(() => {
    debouncedSave('matchedTrades', () => saveMatchedTrades(state.matchedTrades));
  }, [state.matchedTrades, debouncedSave]);

  useEffect(() => {
    debouncedSave('pnlEntries', () => savePnlEntries(state.pnlEntries));
  }, [state.pnlEntries, debouncedSave]);

  return <AppContext.Provider value={{ state, dispatch, isLoading }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
