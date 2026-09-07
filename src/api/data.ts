import { hydrateEmployeeDates } from '../utils/date';
import { normalizeEmployees } from '../utils/normalize';
import type { Employee } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMonthKeys(): Promise<string[]> {
  return request<string[]>('/api/months');
}

export async function fetchMonthData(monthKey: string): Promise<Employee[] | null> {
  try {
    const rows = await request<Employee[]>(`/api/months/${encodeURIComponent(monthKey)}`);
    return normalizeEmployees(hydrateEmployeeDates(rows));
  } catch (err) {
    console.error('Error fetching month data:', err);
    return null;   // preserves current caller behaviour in months.ts
  }
}

export async function storeMonthData(monthKey: string, data: Employee[]): Promise<void> {
  await request('/api/months', { method: 'POST', body: JSON.stringify({ monthKey, data }) });
}

export async function deleteMonthData(monthKey: string): Promise<void> {
  await request(`/api/months/${encodeURIComponent(monthKey)}`, { method: 'DELETE' });
}

export async function deleteAllMonthData(): Promise<number> {
  const { cleared } = await request<{ cleared: number }>('/api/months', { method: 'DELETE' });
  return cleared;
}

export async function repairAllStoredMonths(): Promise<{ repaired: number; months: string[] }> {
  return request('/api/repair', { method: 'POST' });
}
