import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error('SESSION_SECRET is not set');
}
export const COOKIE_NAME = 'dp_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

/** Run once locally to generate ADMIN_PASSWORD_HASH. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sign = (payload: string) =>
  createHmac('sha256', SECRET).update(payload).digest('base64url');

export function issueToken(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readToken(token?: string): { email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return { email: String(data.email) };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: VercelResponse, token: string | null): void {
  const base = `${COOKIE_NAME}=${token ?? ''}; HttpOnly; Secure; SameSite=Strict; Path=/`;
  res.setHeader('Set-Cookie', token ? `${base}; Max-Age=${MAX_AGE}` : `${base}; Max-Age=0`);
}

export function getSession(req: VercelRequest): { email: string } | null {
  const raw = req.headers.cookie ?? '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return readToken(match?.slice(COOKIE_NAME.length + 1));
}

/** Returns false and writes 401 if the caller is not the admin. */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (getSession(req)) return true;
  res.status(401).json({ error: 'Admin sign-in required.' });
  return false;
}
