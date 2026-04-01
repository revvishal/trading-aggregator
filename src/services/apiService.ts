/**
 * API Service — Frontend communication with the backend server.
 * All authenticated requests include JWT Bearer token.
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

// ==========================================
// Auth Token Management
// ==========================================

function getToken(): string | null {
  return sessionStorage.getItem('auth_token');
}

function setToken(token: string): void {
  sessionStorage.setItem('auth_token', token);
}

function clearToken(): void {
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_username');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function handleResponse(res: Response): Promise<any> {
  if (res.status === 401) {
    clearToken();
    window.location.reload(); // Force re-login
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ==========================================
// Authentication
// ==========================================

export async function login(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  const data = await res.json();
  setToken(data.token);
  sessionStorage.setItem('auth_username', data.username);
  return data;
}

export async function verifyToken(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, { headers: authHeaders() });
    if (res.ok) return true;
    clearToken();
    return false;
  } catch {
    return false;
  }
}

export function logout(): void {
  clearToken();
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getUsername(): string {
  return sessionStorage.getItem('auth_username') || '';
}

// ==========================================
// Health
// ==========================================

export async function checkServerHealth(): Promise<{ status: string; timestamp: string; uptime: number }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Server unavailable');
  return res.json();
}

// ==========================================
// Data CRUD — replaces localStorage
// ==========================================

export async function fetchAlerts(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/data/alerts`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function saveAlerts(alerts: any[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/data/alerts`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(alerts),
  });
  await handleResponse(res);
}

export async function fetchOrders(account?: string): Promise<any[]> {
  const params = account ? `?account=${account}` : '';
  const res = await fetch(`${API_BASE}/api/data/orders${params}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function saveOrders(orders: any[], account?: string): Promise<void> {
  const params = account ? `?account=${account}` : '';
  const res = await fetch(`${API_BASE}/api/data/orders${params}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(orders),
  });
  await handleResponse(res);
}

export async function fetchHoldings(account?: string): Promise<any[]> {
  const params = account ? `?account=${account}` : '';
  const res = await fetch(`${API_BASE}/api/data/holdings${params}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function saveHoldings(holdings: any[], account?: string): Promise<void> {
  const params = account ? `?account=${account}` : '';
  const res = await fetch(`${API_BASE}/api/data/holdings${params}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(holdings),
  });
  await handleResponse(res);
}

export async function fetchMatchedTrades(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/data/matched-trades`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function saveMatchedTrades(trades: any[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/data/matched-trades`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(trades),
  });
  await handleResponse(res);
}

export async function appendMatchedTrades(trades: any[]): Promise<{ inserted: number }> {
  const res = await fetch(`${API_BASE}/api/data/matched-trades`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(trades),
  });
  return handleResponse(res);
}

export async function fetchPnlEntries(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/api/data/pnl-entries`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function savePnlEntries(entries: any[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/data/pnl-entries`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(entries),
  });
  await handleResponse(res);
}

export async function clearAllData(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/data/all`, { method: 'DELETE', headers: authHeaders() });
  await handleResponse(res);
}

// Sync metadata
export async function fetchSyncMeta(account: string = 'primary'): Promise<{ lastOrderSyncDate: string | null; updatedAt: string | null }> {
  const res = await fetch(`${API_BASE}/api/zerodha/sync-meta?account=${account}`, { headers: authHeaders() });
  return handleResponse(res);
}

// ==========================================
// Ticker Financials Cache
// ==========================================

export async function fetchTickerFinancials(ticker: string): Promise<{
  ticker: string;
  financials: any;
  analystRecommendation: any;
  fetchedAt: string | null;
  stale: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/financials/${encodeURIComponent(ticker)}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function saveTickerFinancials(ticker: string, financials: any, analystRecommendation: any): Promise<void> {
  const res = await fetch(`${API_BASE}/api/financials/${encodeURIComponent(ticker)}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ financials, analystRecommendation }),
  });
  await handleResponse(res);
}

// ==========================================
// Webhook Alerts
// ==========================================

export async function fetchWebhookAlerts(since?: string): Promise<{ count: number; total: number; alerts: any[] }> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const res = await fetch(`${API_BASE}/api/webhook/alerts?${params}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchWebhookAlertCount(since?: string): Promise<{ count: number; total: number }> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const res = await fetch(`${API_BASE}/api/webhook/alerts/count?${params}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function clearWebhookAlerts(): Promise<{ success: boolean; cleared: number }> {
  const res = await fetch(`${API_BASE}/api/webhook/alerts`, { method: 'DELETE', headers: authHeaders() });
  return handleResponse(res);
}

// ==========================================
// Zerodha Kite Connect
// ==========================================

export interface ZerodhaStatus {
  connected: boolean;
  userId: string;
  loginTime: string;
  apiKeyConfigured: boolean;
  account?: string;
}

export interface ZerodhaStatusAll {
  primary: ZerodhaStatus;
  secondary: ZerodhaStatus;
}

export async function getZerodhaStatus(account: string = 'primary'): Promise<ZerodhaStatus> {
  const res = await fetch(`${API_BASE}/api/zerodha/status?account=${account}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function getZerodhaStatusAll(): Promise<ZerodhaStatusAll> {
  const res = await fetch(`${API_BASE}/api/zerodha/status/all`, { headers: authHeaders() });
  return handleResponse(res);
}

export function getZerodhaLoginUrl(account: string = 'primary'): string {
  return `${API_BASE}/api/zerodha/login?account=${account}`;
}

export async function disconnectZerodha(account: string = 'primary'): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/zerodha/disconnect?account=${account}`, { method: 'POST', headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchZerodhaOrders(account: string = 'primary', fromDate?: string): Promise<{ orders: any[]; count: number; newCount?: number }> {
  const params = new URLSearchParams({ account });
  if (fromDate) params.set('from', fromDate);
  const res = await fetch(`${API_BASE}/api/zerodha/orders?${params}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchZerodhaHoldings(account: string = 'primary'): Promise<{ holdings: any[]; count: number }> {
  const res = await fetch(`${API_BASE}/api/zerodha/holdings?account=${account}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchZerodhaPositions(account: string = 'primary'): Promise<{ positions: { net: any[]; day: any[] } }> {
  const res = await fetch(`${API_BASE}/api/zerodha/positions?account=${account}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function fetchZerodhaProfile(account: string = 'primary'): Promise<{ profile: any }> {
  const res = await fetch(`${API_BASE}/api/zerodha/profile?account=${account}`, { headers: authHeaders() });
  return handleResponse(res);
}
