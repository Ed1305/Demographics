import './styles.css';
import { bindEvents } from './app/events';
import { refreshMonthSelector } from './app/months';
import { initAuth } from './auth';

async function init(): Promise<void> {
  bindEvents();
  await initAuth();
  await refreshMonthSelector();
}

init().catch((err) => {
  console.error('Failed to initialize app:', err);
  document.body.innerHTML =
    '<div style="font-family:sans-serif;padding:2rem;max-width:640px;margin:0 auto;">' +
    '<h1>Demographics Portal</h1>' +
    '<p>The app failed to start. Check your <code>.env</code> file and Supabase configuration.</p>' +
    `<pre style="background:#f5f5f5;padding:1rem;border-radius:8px;overflow:auto;">${err instanceof Error ? err.message : String(err)}</pre>` +
    '</div>';
});
