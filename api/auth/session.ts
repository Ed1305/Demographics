import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'Not signed in.' });
  return res.status(200).json({ email: session.email, role: 'admin' });
}
