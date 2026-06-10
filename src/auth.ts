import type { User } from '@supabase/supabase-js';
import { supabaseClient } from './supabase/client';
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
  const logoutBtn = getById<HTMLButtonElement>('logoutBtn');

  if (role === 'admin') {
    uploadArea.style.display = 'flex';
    deleteMonthBtn.style.display = 'inline-flex';
    clearAllMonthsBtn.style.display = 'inline-flex';
  } else {
    uploadArea.style.display = 'none';
    deleteMonthBtn.style.display = 'none';
    clearAllMonthsBtn.style.display = 'none';
  }

  logoutBtn.style.display = authenticated ? 'flex' : 'none';
}

export async function initAuth(): Promise<void> {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  applySession(session?.user ?? null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    applySession(session?.user ?? null);
  });
}

export async function login(email: string, password: string): Promise<string | null> {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  applySession(data.user);
  return null;
}

export async function logout(): Promise<void> {
  await supabaseClient.auth.signOut();
  setRole('viewer', false);
}
