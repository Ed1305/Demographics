import { getCurrentRole, login, logout } from '../auth';
import { setUploadFileLabel, setUploadStatus } from '../app/layout';
import { clearMonthView, loadMonth, refreshMonthSelector } from '../app/months';
import { readExcelBuffer, parseExcelBuffer } from '../excel';
import { deleteAllMonthData, deleteMonthData, repairAllStoredMonths, storeMonthData } from '../supabase/data';
import { getById } from '../utils/dom';
import { displayMonthToKey, extractMonthFromFilename, keyToDisplayMonth, normalizeMonthKey, parseUserMonthInput } from '../utils/month';

export function bindEvents(): void {
  getById<HTMLButtonElement>('uploadBtn').addEventListener('click', handleUpload);
  getById<HTMLSelectElement>('monthSelector').addEventListener('change', handleMonthChange);
  getById<HTMLButtonElement>('deleteMonthBtn').addEventListener('click', handleDeleteMonth);
  getById<HTMLButtonElement>('clearAllMonthsBtn').addEventListener('click', handleClearAllMonths);
  getById<HTMLButtonElement>('repairMonthsBtn').addEventListener('click', handleRepairMonths);
  getById<HTMLButtonElement>('lockBtn').addEventListener('click', openLoginModal);
  getById<HTMLButtonElement>('modalClose').addEventListener('click', closeLoginModal);
  getById<HTMLDivElement>('loginModal').addEventListener('click', handleModalOverlayClick);
  getById<HTMLButtonElement>('modalLoginBtn').addEventListener('click', handleModalLogin);
  getById<HTMLButtonElement>('logoutBtn').addEventListener('click', handleLogout);
  getById<HTMLInputElement>('modalPassword').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void handleModalLogin();
  });
  getById<HTMLInputElement>('fileInput').addEventListener('change', handleFileSelect);
}

function handleFileSelect(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  setUploadFileLabel(file?.name ?? null);
  setUploadStatus('', 'idle');

  if (!file) return;

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xlsm')) {
    setUploadStatus('Choose a .xlsx or .xlsm file saved from Excel.', 'error');
  }
}

async function handleUpload(): Promise<void> {
  if (getCurrentRole() !== 'admin') {
    alert('Only admin can upload.');
    return;
  }

  const fileInput = getById<HTMLInputElement>('fileInput');
  const uploadBtn = getById<HTMLButtonElement>('uploadBtn');
  const file = fileInput.files?.[0];
  if (!file) {
    alert('Please select an Excel file.');
    return;
  }

  uploadBtn.disabled = true;
  setUploadStatus('Reading file…', 'loading');

  let fileBuffer: ArrayBuffer;
  try {
    fileBuffer = await readExcelBuffer(file);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    setUploadStatus('Upload failed.', 'error');
    alert(`Failed to upload data: ${message}`);
    uploadBtn.disabled = false;
    return;
  }

  let displayMonth = extractMonthFromFilename(file.name);
  if (!displayMonth) {
    const entered = prompt('Could not detect month from filename. Enter the report month (e.g. January 2026):');
    displayMonth = entered ? parseUserMonthInput(entered) : null;
    if (!displayMonth) {
      setUploadStatus('Upload cancelled.', 'idle');
      uploadBtn.disabled = false;
      return;
    }
  }

  setUploadStatus('Parsing Excel…', 'loading');

  try {
    const data = await parseExcelBuffer(fileBuffer, file.name);
    const key = normalizeMonthKey(displayMonthToKey(displayMonth));
    if (!/^\d{4}-\d{2}$/.test(key)) {
      throw new Error(`Could not understand reporting month "${displayMonth}". Use a format like January 2026.`);
    }
    const label = keyToDisplayMonth(key);

    if (
      !confirm(
        `Save "${label}" to the cloud database?\n\n${data.length} employees will be stored (${data.filter((row) => row.status === 'active').length} active, ${data.filter((row) => row.status === 'inactive').length} inactive).`,
      )
    ) {
      setUploadStatus('Upload cancelled.', 'idle');
      uploadBtn.disabled = false;
      return;
    }

    setUploadStatus('Saving to database…', 'loading');
    await storeMonthData(key, data);
    setUploadStatus(`Saved ${data.length} employees for ${label}.`, 'success');
    setUploadFileLabel(null);
    await refreshMonthSelector(key);
    fileInput.value = '';
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    setUploadStatus('Upload failed.', 'error');
    alert(`Failed to upload data: ${message}`);
  } finally {
    uploadBtn.disabled = false;
  }
}

async function handleMonthChange(event: Event): Promise<void> {
  const select = event.target as HTMLSelectElement;
  const key = select.value;
  if (key) {
    await loadMonth(key);
  } else {
    clearMonthView();
  }
}

async function handleDeleteMonth(): Promise<void> {
  if (getCurrentRole() !== 'admin') {
    alert('Only admin can delete.');
    return;
  }

  const select = getById<HTMLSelectElement>('monthSelector');
  const key = select.value;
  if (!key) {
    alert('Select a month to delete.');
    return;
  }

  if (confirm(`Delete ${keyToDisplayMonth(key)}?`)) {
    try {
      await deleteMonthData(key);
      await refreshMonthSelector();
      clearMonthView();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to delete month: ${message}`);
    }
  }
}

async function handleRepairMonths(): Promise<void> {
  if (getCurrentRole() !== 'admin') {
    alert('Only admin can repair stored data.');
    return;
  }

  if (
    !confirm(
      'Repair ALL stored months?\n\nThis normalizes team names (Invnt/Alpha branches), salary brackets, and fixes scrambled columns, then saves back to the database.',
    )
  ) {
    return;
  }

  try {
    const { repaired, months } = await repairAllStoredMonths();
    const select = getById<HTMLSelectElement>('monthSelector');
    const current = select.value;
    await refreshMonthSelector(current || null);
    alert(repaired === 0 ? 'No stored months to repair.' : `Repaired ${repaired} month(s): ${months.map(keyToDisplayMonth).join(', ')}`);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    alert(`Failed to repair stored months: ${message}`);
  }
}

async function handleClearAllMonths(): Promise<void> {
  if (getCurrentRole() !== 'admin') {
    alert('Only admin can clear stored months.');
    return;
  }

  if (
    !confirm(
      'Remove ALL stored months from the database?\n\nThis deletes every uploaded report (January, February, etc.) and cannot be undone.',
    )
  ) {
    return;
  }

  try {
    const removed = await deleteAllMonthData();
    await refreshMonthSelector();
    clearMonthView();
    alert(removed === 0 ? 'Database was already empty.' : `Removed ${removed} stored month(s).`);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    alert(`Failed to clear stored months: ${message}`);
  }
}

function openLoginModal(): void {
  const modalOverlay = getById<HTMLDivElement>('loginModal');
  modalOverlay.hidden = false;
  modalOverlay.classList.add('show');
  getById<HTMLInputElement>('modalEmail').value = '';
  getById<HTMLInputElement>('modalPassword').value = '';
  getById<HTMLDivElement>('modalError').innerText = '';
  getById<HTMLInputElement>('modalEmail').focus();
}

function closeLoginModal(): void {
  const modal = getById<HTMLDivElement>('loginModal');
  modal.classList.remove('show');
  modal.hidden = true;
}

function handleModalOverlayClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) {
    closeLoginModal();
  }
}

async function handleModalLogin(): Promise<void> {
  const email = getById<HTMLInputElement>('modalEmail').value.trim();
  const password = getById<HTMLInputElement>('modalPassword').value.trim();
  const loginBtn = getById<HTMLButtonElement>('modalLoginBtn');
  const errorEl = getById<HTMLDivElement>('modalError');

  if (!email || !password) {
    errorEl.innerText = 'Email and password are required.';
    return;
  }

  loginBtn.disabled = true;
  errorEl.innerText = '';

  const errorMessage = await login(email, password);
  loginBtn.disabled = false;

  if (errorMessage) {
    errorEl.innerText = errorMessage;
    return;
  }

  closeLoginModal();

  if (getCurrentRole() !== 'admin') {
    alert(
      'Signed in, but this account is not an admin yet.\n\n' +
        'In Supabase SQL Editor, run supabase/seed/assign_admin_role.sql, then sign out and sign in again.',
    );
  }
}

async function handleLogout(): Promise<void> {
  await logout();
}
