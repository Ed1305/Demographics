import type { Employee } from './types';

export const appState = {
  currentData: [] as Employee[],
  /** Normalized YYYY-MM key from file upload (reporting month/year for tenure) */
  reportMonthKey: null as string | null,
};

export function setCurrentData(data: Employee[]): void {
  appState.currentData = data;
}

export function setReportMonth(key: string): void {
  appState.reportMonthKey = key;
}

export function clearCurrentMonth(): void {
  appState.currentData = [];
  appState.reportMonthKey = null;
}

export function getReportMonthKey(): string | null {
  return appState.reportMonthKey;
}
