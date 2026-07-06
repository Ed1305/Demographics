import { hydrateEmployeeDates, stripRuntimeFields } from '../utils/date';
import { normalizeEmployees } from '../utils/normalize';
import type { Employee, StoredEmployee } from '../types';
import { getSupabaseClient } from './client';

function formatSupabaseError(context: string, error: { message: string }): Error {
  return new Error(`${context}: ${error.message}`);
}

function sanitizeEmployee(employee: Employee): StoredEmployee {
  const { startDateObj: _startDateObj, dobObj: _dobObj, ...rest } = employee;
  return {
    ...rest,
    name: String(rest.name ?? '').trim(),
    team: String(rest.team ?? '').trim(),
    gender: String(rest.gender ?? '').trim(),
    nationality: String(rest.nationality ?? '').trim(),
    qualification: String(rest.qualification ?? '').trim(),
    area: String(rest.area ?? '').trim(),
    housing: String(rest.housing ?? '').trim(),
    experience: String(rest.experience ?? '').trim(),
    salaryExact: String(rest.salaryExact ?? '').trim(),
    salaryBracket: String(rest.salaryBracket ?? '').trim(),
    source: String(rest.source ?? '').trim(),
    startDate: rest.startDate ?? '',
    dob: rest.dob ?? '',
    kids: rest.kids ?? 0,
    age: Number.isFinite(rest.age) ? rest.age : 0,
    status: rest.status === 'inactive' ? 'inactive' : 'active',
  };
}

function sanitizeEmployees(employees: Employee[]): StoredEmployee[] {
  return stripRuntimeFields(employees).map((employee) => sanitizeEmployee(employee as Employee));
}

export async function fetchMonthKeys(): Promise<string[]> {
  const { data, error } = await getSupabaseClient()
    .from('monthly_data')
    .select('month_key')
    .order('month_key', { ascending: false });

  if (error) {
    console.error('Error fetching months:', error);
    return [];
  }

  return data.map((row) => row.month_key as string);
}

export async function fetchMonthData(monthKey: string): Promise<Employee[] | null> {
  const { data, error } = await getSupabaseClient()
    .from('monthly_data')
    .select('data')
    .eq('month_key', monthKey)
    .single();

  if (error || !data) {
    console.error('Error fetching month data:', error);
    return null;
  }

  const rows = Array.isArray(data.data) ? (data.data as Employee[]) : [];
  return normalizeEmployees(hydrateEmployeeDates(rows));
}

export async function storeMonthData(monthKey: string, dataArray: Employee[]): Promise<void> {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error('Invalid reporting month key. Use a month like January 2026.');
  }

  if (dataArray.length === 0) {
    throw new Error('No employee records to store.');
  }

  const clean = sanitizeEmployees(normalizeEmployees(dataArray));
  const { error } = await getSupabaseClient()
    .from('monthly_data')
    .upsert({ month_key: monthKey, data: clean }, { onConflict: 'month_key' });

  if (error) throw formatSupabaseError('Failed to store month data', error);
}

export async function deleteMonthData(monthKey: string): Promise<void> {
  const { error } = await getSupabaseClient().from('monthly_data').delete().eq('month_key', monthKey);
  if (error) throw formatSupabaseError('Failed to delete month data', error);
}

export async function deleteAllMonthData(): Promise<number> {
  const keys = await fetchMonthKeys();
  if (keys.length === 0) return 0;

  const { error } = await getSupabaseClient()
    .from('monthly_data')
    .delete()
    .in('month_key', keys);

  if (error) throw formatSupabaseError('Failed to clear all month data', error);
  return keys.length;
}

export async function repairAllStoredMonths(): Promise<{ repaired: number; months: string[] }> {
  const keys = await fetchMonthKeys();
  const repairedMonths: string[] = [];

  for (const monthKey of keys) {
    const data = await fetchMonthData(monthKey);
    if (!data || data.length === 0) continue;

    const normalized = normalizeEmployees(data);
    await storeMonthData(monthKey, normalized);
    repairedMonths.push(monthKey);
  }

  return { repaired: repairedMonths.length, months: repairedMonths };
}
