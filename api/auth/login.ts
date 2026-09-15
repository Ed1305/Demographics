import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyPassword, issueToken, setSessionCookie } from '../_lib/auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!adminEmail || !adminHash) {
    console.error('ADMIN_EMAIL or ADMIN_PASSWORD_HASH is not set');
    return res.status(500).json({ error: 'Server is not configured for sign-in.' });
  }
  if (!/^[0-9a-f]+:[0-9a-f]+$/i.test(adminHash)) {
    console.error('ADMIN_PASSWORD_HASH is not salt:hex from hashPassword()');
    return res.status(500).json({
      error:
        'Sign-in is misconfigured. ADMIN_PASSWORD_HASH must be the salt:hex value from hashPassword(), not the password itself.',
    });
  }

  // Run the KDF unconditionally. Short-circuiting on the email comparison
  // would make a wrong address return measurably faster than a wrong
  // password, which is an account-enumeration oracle.
  const passwordOk = verifyPassword(password, adminHash);
  const ok = email === adminEmail.toLowerCase() && passwordOk;

  if (!ok) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  setSessionCookie(res, issueToken(email));
  return res.status(200).json({ email, role: 'admin' });
}
