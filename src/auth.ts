import type { User } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase/client';
import { getById } from './utils/dom';
import type { UserRole } from './types';

let currentRole: UserRole = 'viewer';

function getRoleFromUser(user: User): UserRole {
  const role = user.app_metadata?.role ?? user.user_metadata?.role;
  return role === 'admin' ? 'admin' : 'viewer';
}

function applySession(user: User | null): void {
  setRole(user ? getRoleFromUser(user) : 'viewer', Boolean(user));
}

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
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  applySession(session?.user ?? null);

  getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    applySession(session?.user ?? null);
  });
}

function friendlyAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password. Reset the password in Supabase (Authentication → Users), or create the user again with Auto Confirm enabled.';
  }
  if (lower.includes('email not confirmed')) {
    return 'This email is not confirmed yet. In Supabase → Authentication → Users, confirm the user or enable Auto Confirm when creating them.';
  }
  if (lower.includes('user not found')) {
    return 'No account exists for this email. Create it in Supabase → Authentication → Users → Add user.';
  }
  return message;
}

export async function login(email: string, password: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) return friendlyAuthError(error.message);
  applySession(data.user);
  return null;
}

export async function logout(): Promise<void> {
  await getSupabaseClient().auth.signOut();
  setRole('viewer', false);
}
