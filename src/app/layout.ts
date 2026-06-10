import { getById } from '../utils/dom';

export function setDashboardVisible(visible: boolean): void {
  getById<HTMLElement>('dashboardContent').hidden = !visible;
  getById<HTMLElement>('emptyStatePanel').hidden = visible;
}

export function setUploadFileLabel(filename: string | null): void {
  const label = getById<HTMLSpanElement>('selectedFileName');
  const hint = getById<HTMLParagraphElement>('uploadHint');

  if (filename) {
    label.textContent = filename;
    label.classList.add('has-file');
    hint.textContent = 'File selected locally — click Upload & Store to save to the database.';
  } else {
    label.textContent = 'No file chosen';
    label.classList.remove('has-file');
    hint.textContent = 'Upload .xlsx with a green Active ribbon and red Inactive ribbon. Columns are matched by header name.';
  }
}

export function setUploadStatus(message: string, type: 'idle' | 'success' | 'error' | 'loading' = 'idle'): void {
  const status = getById<HTMLSpanElement>('uploadStatus');
  status.textContent = message;
  status.dataset.state = type;
}
