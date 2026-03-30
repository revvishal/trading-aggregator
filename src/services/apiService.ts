/**
 * API Service — Frontend communication with the backend server.
 *
 * In development, CRA proxies /api/* requests to the backend (port 3001).
 * In production, set REACT_APP_API_URL to the backend URL.
 */

const API_BASE = process.env.REACT_APP_API_URL || '';

// ==========================================
// Health
// ==========================================

export async function checkServerHealth(): Promise<{
  status: string;
  timestamp: string;
  uptime: number;
}> {
  console.log("API_BASE variable is", API_BASE)
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Server unavailable');
  return res.json();
}

// ==========================================
// Webhook Alerts
// ==========================================

export async function fetchWebhookAlerts(since?: string): Promise<{
  count: number;
  total: number;
  alerts: any[];
}> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const res = await fetch(`${API_BASE}/api/webhook/alerts?${params}`);
  if (!res.ok) throw new Error('Failed to fetch webhook alerts');
  return res.json();
}

export async function fetchWebhookAlertCount(since?: string): Promise<{
  count: number;
  total: number;
}> {
  const params = new URLSearchParams();
  if (since) params.set('since', since);
  const res = await fetch(`${API_BASE}/api/webhook/alerts/count?${params}`);
  if (!res.ok) throw new Error('Failed to fetch alert count');
  return res.json();
}

export async function clearWebhookAlerts(): Promise<{ success: boolean; cleared: number }> {
  const res = await fetch(`${API_BASE}/api/webhook/alerts`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear alerts');
  return res.json();
}

// ==========================================
// Zerodha Kite Connect
// ==========================================

export interface ZerodhaStatus {
  connected: boolean;
  userId: string;
  loginTime: string;
  apiKeyConfigured: boolean;
}

export async function getZerodhaStatus(): Promise<ZerodhaStatus> {
  const res = await fetch(`${API_BASE}/api/zerodha/status`);
  if (!res.ok) throw new Error('Failed to get Zerodha status');
  return res.json();
}

export function getZerodhaLoginUrl(): string {
  return `${API_BASE}/api/zerodha/login`;
}

export async function disconnectZerodha(): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/zerodha/disconnect`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to disconnect');
  return res.json();
}

export async function fetchZerodhaOrders(): Promise<{
  orders: any[];
  count: number;
}> {
  const res = await fetch(`${API_BASE}/api/zerodha/orders`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.expired) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to fetch orders');
  }
  return res.json();
}

export async function fetchZerodhaHoldings(): Promise<{
  holdings: any[];
  count: number;
}> {
  const res = await fetch(`${API_BASE}/api/zerodha/holdings`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.expired) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to fetch holdings');
  }
  return res.json();
}

export async function fetchZerodhaPositions(): Promise<{
  positions: { net: any[]; day: any[] };
}> {
  const res = await fetch(`${API_BASE}/api/zerodha/positions`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.expired) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to fetch positions');
  }
  return res.json();
}

export async function fetchZerodhaProfile(): Promise<{ profile: any }> {
  const res = await fetch(`${API_BASE}/api/zerodha/profile`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (data.expired) throw new Error('SESSION_EXPIRED');
    throw new Error(data.error || 'Failed to fetch profile');
  }
  return res.json();
}

