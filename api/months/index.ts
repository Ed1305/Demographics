import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAdmin } from '../_lib/auth';
import { normalizeEmployees } from '../../src/utils/normalize';
import { sanitizeEmployees } from '../_lib/sanitize';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const rows = await sql`select month_key from monthly_data order by month_key desc`;
    return res.status(200).json(rows.map((r) => r.month_key));
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const { monthKey, data } = req.body ?? {};

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid reporting month key. Use a month like January 2026.' });
    }
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No employee records to store.' });
    }

    const clean = sanitizeEmployees(normalizeEmployees(data));
    await sql`
      insert into monthly_data (month_key, data)
      values (${monthKey}, ${JSON.stringify(clean)}::jsonb)
      on conflict (month_key) do update set data = excluded.data
    `;
    return res.status(200).json({ stored: clean.length });
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const rows = await sql`delete from monthly_data returning month_key`;
    return res.status(200).json({ cleared: rows.length });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
