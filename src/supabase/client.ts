import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { assertSupabaseConfigured, getSupabaseAnonKey, getSupabaseUrl } from '../config';

let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    assertSupabaseConfigured();
    supabaseClientInstance = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseClientInstance;
}
