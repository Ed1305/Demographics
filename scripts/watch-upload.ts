/**
 * watch-upload.ts
 *
 * Watches a local folder for new .xlsx / .xlsm files, parses them using the
 * app's real parsing logic (src/excel/workbook-parser.ts), derives the
 * month_key using the app's real month utilities (src/utils/month.ts), and
 * upserts into Neon `monthly_data`.
 *
 * Run with:
 *   npx tsx scripts/watch-upload.ts
 *
 * Required env vars (put these in a local .env.watch file, NEVER commit it):
 *   DATABASE_URL=postgres://...   <-- SECRET, server-only Neon pooler URL
 *   WATCH_FOLDER=/absolute/path/to/folder/to/watch     (optional, defaults below)
 */

import dotenv from 'dotenv';
import chokidar from 'chokidar';
import { neon } from '@neondatabase/serverless';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { fileURLToPath } from 'url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envWatchPath = path.join(projectRoot, '.env.watch');
const envPath = path.join(projectRoot, '.env');

function loadEnvFiles(): void {
  if (fs.existsSync(envWatchPath)) {
    const result = dotenv.config({ path: envWatchPath });
    if (result.error) {
      console.error(`[fatal] Failed to read ${envWatchPath}: ${result.error.message}`);
      process.exit(1);
    }
    return;
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return;
  }

  console.error(
    `[fatal] Missing ${envWatchPath}\n` +
      'Copy scripts/.env.watch.example to .env.watch in the project root and fill in your values.',
  );
  process.exit(1);
}

loadEnvFiles();

// --- Reuse the app's REAL parsing + month logic. Adjust these relative paths
// --- if you place this script somewhere other than <project-root>/scripts/.
import { parseWorkbookBuffer } from '../src/excel/workbook-parser';
import {
  extractMonthFromFilename,
  displayMonthToKey,
  normalizeMonthKey,
  keyToDisplayMonth,
  parseUserMonthInput,
} from '../src/utils/month';
import type { Employee } from '../src/types';
import { sanitizeEmployees } from '../api/_lib/sanitize';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WATCH_FOLDER = process.env.WATCH_FOLDER ?? path.join(process.cwd(), 'incoming-reports');
const PROCESSED_FOLDER = path.join(WATCH_FOLDER, 'processed');
const FAILED_FOLDER = path.join(WATCH_FOLDER, 'failed');

if (!process.env.DATABASE_URL) {
  console.error(
    '[fatal] Missing DATABASE_URL.\n' +
      'Create a .env.watch file (see scripts/.env.watch.example) and load it,\n' +
      'or export it as an environment variable before running this script.',
  );
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function storeMonthDataDirect(monthKey: string, dataArray: Employee[]): Promise<void> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid reporting month key "${monthKey}". Expected format like 2026-06.`);
  }
  if (dataArray.length === 0) throw new Error('No employee records to store.');

  const clean = sanitizeEmployees(dataArray);
  await sql`
    insert into monthly_data (month_key, data)
    values (${monthKey}, ${JSON.stringify(clean)}::jsonb)
    on conflict (month_key) do update set data = excluded.data
  `;
}

// ---------------------------------------------------------------------------
// Month key derivation (mirrors handleUpload() in src/app/events.ts)
// ---------------------------------------------------------------------------

function deriveMonthKey(filename: string): string | null {
  const displayMonth = extractMonthFromFilename(filename);
  if (!displayMonth) return null;

  const key = normalizeMonthKey(displayMonthToKey(displayMonth));
  if (!/^\d{4}-\d{2}$/.test(key)) return null;
  return key;
}

// ---------------------------------------------------------------------------
// File stability check — make sure the file has finished being written/copied
// before we read it (avoids reading a half-copied file from cloud sync, USB
// transfer, etc.)
// ---------------------------------------------------------------------------

async function waitForFileStable(filePath: string, checks = 4, intervalMs = 700): Promise<void> {
  let lastSize = -1;
  let stableCount = 0;

  while (stableCount < checks) {
    const stat = await fsp.stat(filePath);
    if (stat.size === lastSize) {
      stableCount += 1;
    } else {
      stableCount = 0;
      lastSize = stat.size;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

async function ensureFolders(): Promise<void> {
  await fsp.mkdir(WATCH_FOLDER, { recursive: true });
  await fsp.mkdir(PROCESSED_FOLDER, { recursive: true });
  await fsp.mkdir(FAILED_FOLDER, { recursive: true });
}

async function moveFile(filePath: string, destFolder: string): Promise<void> {
  const filename = path.basename(filePath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destPath = path.join(destFolder, `${timestamp}__${filename}`);
  await fsp.rename(filePath, destPath);
}

async function processFile(filePath: string): Promise<void> {
  const filename = path.basename(filePath);
  const lower = filename.toLowerCase();

  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm')) {
    console.log(`[skip] Ignoring non-Excel file: ${filename}`);
    return;
  }

  console.log(`\n[detected] ${filename}`);

  try {
    await waitForFileStable(filePath);

    const monthKey = deriveMonthKey(filename);
    if (!monthKey) {
      throw new Error(
        `Could not detect report month from filename "${filename}". ` +
          `Rename it to include the month, e.g. "January 2026.xlsx".`,
      );
    }

    const label = keyToDisplayMonth(monthKey);
    console.log(`[parsing] Detected month: ${label} (${monthKey})`);

    const buffer = await fsp.readFile(filePath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    const employees = await parseWorkbookBuffer(arrayBuffer as ArrayBuffer);

    const activeCount = employees.filter((e) => e.status === 'active').length;
    const inactiveCount = employees.filter((e) => e.status === 'inactive').length;
    console.log(`[parsed] ${employees.length} employees (${activeCount} active, ${inactiveCount} inactive)`);

    console.log(`[uploading] Writing to monthly_data for ${monthKey} (overwrite if exists)...`);
    await storeMonthDataDirect(monthKey, employees);

    console.log(`[success] Saved ${employees.length} employees for ${label}.`);
    await moveFile(filePath, PROCESSED_FOLDER);
    console.log(`[moved] -> processed/`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[error] Failed to process "${filename}": ${message}`);
    try {
      await moveFile(filePath, FAILED_FOLDER);
      console.error(`[moved] -> failed/  (fix the issue and drop a corrected file back into the watch folder)`);
    } catch (moveErr) {
      console.error(`[error] Additionally failed to move file to failed/: ${moveErr}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Watcher
// ---------------------------------------------------------------------------

async function main() {
  await ensureFolders();

  console.log('Alpha Konnect Demographics — folder watcher');
  console.log('============================================');
  console.log(`Watching:   ${WATCH_FOLDER}`);
  console.log(`Processed:  ${PROCESSED_FOLDER}`);
  console.log(`Failed:     ${FAILED_FOLDER}`);
  console.log('Database:   Neon Postgres');
  console.log('Drop a .xlsx file (e.g. "June 2026.xlsx") into the watch folder to upload it automatically.');
  console.log('Press Ctrl+C to stop.\n');

  const watcher = chokidar.watch(WATCH_FOLDER, {
    ignored: (filePath: string) => {
      const resolved = path.resolve(filePath);
      return resolved.startsWith(path.resolve(PROCESSED_FOLDER)) || resolved.startsWith(path.resolve(FAILED_FOLDER));
    },
    depth: 0,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 200,
    },
  });

  watcher.on('add', (filePath: string) => {
    void processFile(filePath);
  });

  watcher.on('error', (error: unknown) => {
    console.error('[watcher error]', error);
  });
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});