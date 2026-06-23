export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && anonKey);
}

export function getSupabaseConfigError(): string | null {
  const missing: string[] = [];
  if (!import.meta.env.VITE_SUPABASE_URL?.trim()) missing.push('VITE_SUPABASE_URL');
  if (!import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()) missing.push('VITE_SUPABASE_ANON_KEY');
  if (missing.length === 0) return null;

  return (
    `Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
    'Copy .env.example to .env for local dev, or set these in your host (e.g. Netlify → Site settings → Environment variables) before building.'
  );
}

export function assertSupabaseConfigured(): void {
  const error = getSupabaseConfigError();
  if (error) throw new Error(error);
}

export function getSupabaseUrl(): string {
  assertSupabaseConfigured();
  return import.meta.env.VITE_SUPABASE_URL.trim();
}

export function getSupabaseAnonKey(): string {
  assertSupabaseConfigured();
  return import.meta.env.VITE_SUPABASE_ANON_KEY.trim();
}

export const SALARY_BRACKETS = [
  '0-R3000',
  'R3001-R6000',
  'R6001-R8000',
  'R8001-R14000',
] as const;

export const TENURE_DAY_LABELS = [
  '0-90d',
  '91-180d',
  '181-365d',
  '1-2y',
  '2-3y',
  '3-5y',
  '5y+',
] as const;
