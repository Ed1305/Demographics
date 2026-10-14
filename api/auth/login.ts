import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyPassword, issueToken, setSessionCookie } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const accessCode = String(req.body?.accessCode ?? '');

  const accessHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!accessHash) {
    console.error('ADMIN_PASSWORD_HASH is not set');
    return res.status(500).json({ error: 'Server is not configured for sign-in.' });
  }
  if (!/^[0-9a-f]+:[0-9a-f]+$/i.test(accessHash)) {
    console.error('ADMIN_PASSWORD_HASH is not salt:hex from hashPassword()');
    return res.status(500).json({
      error:
        'Sign-in is misconfigured. ADMIN_PASSWORD_HASH must be the salt:hex value from hashPassword(), not the access code itself.',
    });
  }

  if (!verifyPassword(accessCode, accessHash)) {
    return res.status(401).json({ error: 'Invalid access code.' });
  }

  setSessionCookie(res, issueToken('admin'));
  return res.status(200).json({ role: 'admin' });
}
