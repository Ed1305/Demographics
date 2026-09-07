import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAdmin } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = String(req.query.key ?? '');
  if (!/^\d{4}-\d{2}$/.test(key)) {
    return res.status(400).json({ error: 'Invalid reporting month key. Use a month like January 2026.' });
  }

  if (req.method === 'GET') {
    const rows = await sql`select data from monthly_data where month_key = ${key} limit 1`;
    if (!rows.length) {
      return res.status(404).json({ error: 'Month not found.' });
    }
    const data = rows[0].data;
    return res.status(200).json(Array.isArray(data) ? data : []);
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    await sql`delete from monthly_data where month_key = ${key}`;
    return res.status(200).json({ deleted: true });
  }

  res.setHeader('Allow', 'GET, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
