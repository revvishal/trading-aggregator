import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import {
  AppState,
  TradingViewAlert,
  ZerodhaOrder,
  ZerodhaHolding,
  MatchedTrade,
  PnLEntry,
} from '../types';
import { getItems, saveItems, STORAGE_KEYS } from '../services/storageService';

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
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD_ALL'; payload: AppState };

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
      return {
        ...state,
        alerts: state.alerts.map((a) => (a.id === action.payload.id ? action.payload : a)),
      };
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
    case 'CLEAR_ALL':
      return { ...initialState };
    case 'LOAD_ALL':
      return { ...action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    const alerts = getItems<TradingViewAlert>(STORAGE_KEYS.ALERTS);
    const zerodhaOrders = getItems<ZerodhaOrder>(STORAGE_KEYS.ZERODHA_ORDERS);
    const zerodhaHoldings = getItems<ZerodhaHolding>(STORAGE_KEYS.ZERODHA_HOLDINGS);
    const matchedTrades = getItems<MatchedTrade>(STORAGE_KEYS.MATCHED_TRADES);
    const pnlEntries = getItems<PnLEntry>(STORAGE_KEYS.PNL_ENTRIES);

    dispatch({
      type: 'LOAD_ALL',
      payload: {
        alerts,
        zerodhaOrders,
        zerodhaHoldings,
        matchedTrades,
        pnlEntries,
        globalTickerFilter: '',
        activeTab: 0,
      },
    });
  }, []);

  // Persist to localStorage on state changes
  useEffect(() => {
    saveItems(STORAGE_KEYS.ALERTS, state.alerts);
  }, [state.alerts]);

  useEffect(() => {
    saveItems(STORAGE_KEYS.ZERODHA_ORDERS, state.zerodhaOrders);
  }, [state.zerodhaOrders]);

  useEffect(() => {
    saveItems(STORAGE_KEYS.ZERODHA_HOLDINGS, state.zerodhaHoldings);
  }, [state.zerodhaHoldings]);

  useEffect(() => {
    saveItems(STORAGE_KEYS.MATCHED_TRADES, state.matchedTrades);
  }, [state.matchedTrades]);

  useEffect(() => {
    saveItems(STORAGE_KEYS.PNL_ENTRIES, state.pnlEntries);
  }, [state.pnlEntries]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

