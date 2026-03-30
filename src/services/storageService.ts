const STORAGE_KEYS = {
  ALERTS: 'ta_alerts',
  ZERODHA_ORDERS: 'ta_zerodha_orders',
  ZERODHA_HOLDINGS: 'ta_zerodha_holdings',
  MATCHED_TRADES: 'ta_matched_trades',
  PNL_ENTRIES: 'ta_pnl_entries',
};

export function getItems<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveItems<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export function clearItems(key: string): void {
  localStorage.removeItem(key);
}

export function clearAll(): void {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

export function exportAllData(): string {
  const data: Record<string, unknown> = {};
  Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
    data[name] = getItems(key);
  });
  return JSON.stringify(data, null, 2);
}

export function importAllData(jsonStr: string): boolean {
  try {
    const data = JSON.parse(jsonStr);
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      if (data[name]) {
        saveItems(key, data[name]);
      }
    });
    return true;
  } catch {
    return false;
  }
}

export { STORAGE_KEYS };

