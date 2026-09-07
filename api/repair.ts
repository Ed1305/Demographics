import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from './_lib/db';
import { requireAdmin } from './_lib/auth';
import { hydrateEmployeeDates } from '../src/utils/date';
import { normalizeEmployees } from '../src/utils/normalize';
import { sanitizeEmployees } from './_lib/sanitize';
import type { Employee } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!requireAdmin(req, res)) return;

  const rows = await sql`select month_key, data from monthly_data order by month_key`;
  const repairedMonths: string[] = [];

  for (const row of rows) {
    const employees = Array.isArray(row.data) ? (row.data as Employee[]) : [];
    if (employees.length === 0) continue;

    const clean = sanitizeEmployees(normalizeEmployees(hydrateEmployeeDates(employees)));
    await sql`
      update monthly_data
      set data = ${JSON.stringify(clean)}::jsonb
      where month_key = ${String(row.month_key)}
    `;
    repairedMonths.push(String(row.month_key));
  }

  return res.status(200).json({ repaired: repairedMonths.length, months: repairedMonths });
}
