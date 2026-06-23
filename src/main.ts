import './styles.css';
import { bindEvents } from './app/events';
import { refreshMonthSelector } from './app/months';
import { initAuth } from './auth';
import { getSupabaseConfigError, isSupabaseConfigured } from './config';

function showConfigurationError(message: string): void {
  document.body.innerHTML =
    '<div style="font-family:Inter,system-ui,sans-serif;padding:2.5rem;max-width:720px;margin:0 auto;line-height:1.6;color:#1e293b;">' +
    '<h1 style="margin:0 0 1rem;font-size:1.5rem;">Demographics Portal — configuration required</h1>' +
    '<p>Supabase environment variables are not set for this build.</p>' +
    `<pre style="background:#f8fafc;padding:1rem;border-radius:8px;border:1px solid #e2e8f0;overflow:auto;white-space:pre-wrap;">${message}</pre>` +
    '<h2 style="font-size:1.1rem;margin:1.5rem 0 0.75rem;">Local development</h2>' +
    '<ol style="padding-left:1.25rem;margin:0;">' +
    '<li>Copy <code>.env.example</code> to <code>.env</code></li>' +
    '<li>Add your <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></li>' +
    '<li>Restart with <code>npm run dev</code></li>' +
    '</ol>' +
    '<h2 style="font-size:1.1rem;margin:1.5rem 0 0.75rem;">Netlify / production</h2>' +
    '<ol style="padding-left:1.25rem;margin:0;">' +
    '<li>Netlify → Site configuration → Environment variables</li>' +
    '<li>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code></li>' +
    '<li>Trigger a new deploy (env vars are baked in at build time)</li>' +
    '</ol>' +
    '</div>';
}

async function init(): Promise<void> {
  if (!isSupabaseConfigured()) {
    showConfigurationError(getSupabaseConfigError() ?? 'Supabase is not configured.');
    return;
  }

  bindEvents();
  await initAuth();
  await refreshMonthSelector();
}

init().catch((err) => {
  console.error('Failed to initialize app:', err);
  showConfigurationError(err instanceof Error ? err.message : String(err));
});
