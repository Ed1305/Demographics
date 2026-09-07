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
});
