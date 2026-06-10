import { clearCharts } from '../charts/manager';
import { setDashboardVisible } from '../app/layout';
import { clearDashboardView, renderDashboard } from '../dashboard/render';
import { fetchMonthData, fetchMonthKeys } from '../supabase/data';
import { setCurrentData, setReportMonth } from '../state';
import { getById } from '../utils/dom';
import { keyToDisplayMonth, normalizeMonthKey } from '../utils/month';

let storedMonthCount = 0;

function updateEmptyStateMessage(): void {
  const title = getById<HTMLHeadingElement>('emptyStateTitle');
  const description = getById<HTMLParagraphElement>('emptyStateDescription');
  const monthStatus = getById<HTMLParagraphElement>('monthStatus');

  if (storedMonthCount === 0) {
    title.textContent = 'No monthly data yet';
    description.textContent =
      'Nothing is stored in the database. Sign in as admin and upload an Excel file when you are ready.';
    monthStatus.textContent = '0 months in database · dashboard hidden until you upload and select a month.';
    return;
  }

  title.textContent = 'No month selected';
  description.textContent =
    'Stored months appear in the dropdown because they were previously uploaded to the database. Select one to view, or clear them all as admin.';
  monthStatus.textContent = `${storedMonthCount} month(s) in database · pick one from the dropdown, or clear all as admin.`;
}

function showEmptyState(): void {
  clearDashboardView();
  clearCharts();
  setDashboardVisible(false);
  getById<HTMLSelectElement>('monthSelector').value = '';
  updateEmptyStateMessage();
}

export async function loadMonth(key: string): Promise<void> {
  getById<HTMLParagraphElement>('monthStatus').textContent = 'Loading month data…';

  const data = await fetchMonthData(key);
  if (!data) {
    getById<HTMLParagraphElement>('monthStatus').textContent = 'Failed to load month data.';
    setDashboardVisible(false);
    return;
  }

  setCurrentData(data);
  const reportKey = normalizeMonthKey(key);
  setReportMonth(reportKey);
  renderDashboard(data);
  getById<HTMLParagraphElement>('monthStatus').textContent =
    `Viewing ${keyToDisplayMonth(reportKey)} · ${data.length} employees · tenure in days (report month − start date)`;
}

export async function refreshMonthSelector(selectedKey: string | null = null): Promise<void> {
  const select = getById<HTMLSelectElement>('monthSelector');
  getById<HTMLParagraphElement>('monthStatus').textContent = 'Checking database…';

  const months = await fetchMonthKeys();
  storedMonthCount = months.length;

  select.innerHTML = '<option value="">-- No month selected --</option>';
  months.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = `${keyToDisplayMonth(key)} (stored)`;
    select.appendChild(option);
  });

  if (selectedKey && months.includes(selectedKey)) {
    select.value = selectedKey;
    await loadMonth(selectedKey);
    return;
  }

  showEmptyState();
}

export function clearMonthView(): void {
  clearDashboardView();
  clearCharts();
  setDashboardVisible(false);
  updateEmptyStateMessage();
}

export function getStoredMonthCount(): number {
  return storedMonthCount;
}
