import type { Employee } from '../types';
import { normalizeMonthKey } from './month';

function excelSerialToLocalDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcDate = new Date(utcDays * 86400000);
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
}

export function parseDateFromCell(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    return excelSerialToLocalDate(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const serial = parseFloat(trimmed);
      if (serial > 1000) return excelSerialToLocalDate(serial);
    }

    const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10) - 1;
      const year = parseInt(dmy[3], 10);
      const d = new Date(year, month, day);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const ymd = trimmed.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (ymd) {
      const d = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10));
      return Number.isNaN(d.getTime()) ? null : d;
    }

    const datePart = trimmed.split(' ')[0];
    const d = new Date(`${datePart}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatEmployeeStartDate(emp: Employee): string {
  const parsed = emp.startDateObj ?? parseDateFromCell(emp.startDate);
  if (parsed) return formatDate(parsed);
  if (emp.startDate !== '' && emp.startDate != null) return String(emp.startDate).trim();
  return '—';
}

export function parseReportMonthKey(reportMonthKey: string): { year: number; month: number } | null {
  const normalized = normalizeMonthKey(reportMonthKey);
  const [yearStr, monthStr] = normalized.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return null;
  return { year, month };
}

/** Last calendar day of the uploaded report month. */
export function getReportMonthEnd(reportMonthKey: string): Date | null {
  const report = parseReportMonthKey(reportMonthKey);
  if (!report) return null;
  return new Date(report.year, report.month, 0);
}

/**
 * Tenure in days = report month end (from upload) − start date.
 * Active rows use Active Start Dates; inactive rows use Inactive Start Dates.
 */
export function computeTenureDays(emp: Employee, reportMonthKey: string | null): number | null {
  const start = emp.startDateObj ?? parseDateFromCell(emp.startDate);
  const reportEnd = reportMonthKey ? getReportMonthEnd(reportMonthKey) : null;
  if (!start || !reportEnd) return null;

  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(reportEnd.getFullYear(), reportEnd.getMonth(), reportEnd.getDate());
  return Math.round((endDay.getTime() - startDay.getTime()) / 86400000);
}

export function hydrateEmployeeDates(employees: Employee[]): Employee[] {
  employees.forEach((emp) => {
    if (emp.startDate !== '' && emp.startDate != null) {
      emp.startDateObj = parseDateFromCell(emp.startDate);
    }
    if (emp.dob !== '' && emp.dob != null) {
      emp.dobObj = parseDateFromCell(emp.dob);
    }
  });
  return employees;
}

export function stripRuntimeFields(employees: Employee[]) {
  return employees.map(({ startDateObj: _startDateObj, dobObj: _dobObj, ...rest }) => rest);
}
