function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}. Copy .env.example to .env and fill in your Supabase values.`);
  }
  return value;
}

export const SUPABASE_URL = requireEnv('VITE_SUPABASE_URL');
export const SUPABASE_ANON_KEY = requireEnv('VITE_SUPABASE_ANON_KEY');

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
