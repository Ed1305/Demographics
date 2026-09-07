import { getById } from './utils/dom';
import type { UserRole } from './types';

let currentRole: UserRole = 'viewer';

export function getCurrentRole(): UserRole {
  return currentRole;
}

export function setRole(role: UserRole, authenticated = false): void {
  currentRole = role;
  getById<HTMLSpanElement>('roleDisplay').innerText = role === 'admin' ? 'Admin' : 'Viewer';

  const uploadArea = getById<HTMLDivElement>('uploadArea');
  const deleteMonthBtn = getById<HTMLButtonElement>('deleteMonthBtn');
  const clearAllMonthsBtn = getById<HTMLButtonElement>('clearAllMonthsBtn');
  const repairMonthsBtn = getById<HTMLButtonElement>('repairMonthsBtn');
  const logoutBtn = getById<HTMLButtonElement>('logoutBtn');

  if (role === 'admin') {
    uploadArea.style.display = 'flex';
    deleteMonthBtn.style.display = 'inline-flex';
    clearAllMonthsBtn.style.display = 'inline-flex';
    repairMonthsBtn.style.display = 'inline-flex';
  } else {
    uploadArea.style.display = 'none';
    deleteMonthBtn.style.display = 'none';
    clearAllMonthsBtn.style.display = 'none';
    repairMonthsBtn.style.display = 'none';
  }

  logoutBtn.style.display = authenticated ? 'flex' : 'none';
}

export async function initAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/session');
    const session = res.ok ? await res.json() : null;
    setRole(session ? 'admin' : 'viewer', Boolean(session));
  } catch {
    setRole('viewer', false);
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.error ?? 'Sign-in failed.';
  }
  setRole('admin', true);
  return null;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  setRole('viewer', false);
}
