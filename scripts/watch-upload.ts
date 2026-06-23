/**
 * watch-upload.ts
 *
 * Watches a local folder for new .xlsx / .xlsm files, parses them using the
 * app's real parsing logic (src/excel/workbook-parser.ts), derives the
 * month_key using the app's real month utilities (src/utils/month.ts), and
 * upserts into Supabase `monthly_data` using the SERVICE ROLE key (bypasses
 * RLS — this script is trusted and never runs in a browser).
 *
 * Run with:
 *   npx tsx scripts/watch-upload.ts
 *
 * Required env vars (put these in a local .env.watch file, NEVER commit it):
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   <-- SECRET, server-only
 *   WATCH_FOLDER=/absolute/path/to/folder/to/watch     (optional, defaults below)
 */

import dotenv from 'dotenv';
import chokidar from 'chokidar';
import { createClient } from '@supabase/supabase-js';
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
import type { Employee, StoredEmployee } from '../src/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WATCH_FOLDER = process.env.WATCH_FOLDER ?? path.join(process.cwd(), 'incoming-reports');
const PROCESSED_FOLDER = path.join(WATCH_FOLDER, 'processed');
const FAILED_FOLDER = path.join(WATCH_FOLDER, 'failed');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '[fatal] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Create a .env.watch file (see scripts/.env.watch.example) and load it,\n' +
      'or export both as environment variables before running this script.',
  );
  process.exit(1);
}

// Service-role client: bypasses RLS entirely. Server-side only. Never expose
// this key to a browser bundle or commit it to git.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// Sanitization (mirrors src/supabase/data.ts sanitizeEmployee/sanitizeEmployees,
// since that file's storeMonthData() is wired to the anon client and we don't
// want to touch app-facing code for this local automation script).
// ---------------------------------------------------------------------------

function sanitizeEmployee(employee: Employee): StoredEmployee {
  const { startDateObj: _startDateObj, dobObj: _dobObj, ...rest } = employee;
  return {
    ...rest,
    name: String(rest.name ?? '').trim(),
    team: String(rest.team ?? '').trim(),
    gender: String(rest.gender ?? '').trim(),
    nationality: String(rest.nationality ?? '').trim(),
    qualification: String(rest.qualification ?? '').trim(),
    area: String(rest.area ?? '').trim(),
    housing: String(rest.housing ?? '').trim(),
    experience: String(rest.experience ?? '').trim(),
    salaryExact: String(rest.salaryExact ?? '').trim(),
    salaryBracket: String(rest.salaryBracket ?? '').trim(),
    source: String(rest.source ?? '').trim(),
    startDate: rest.startDate ?? '',
    dob: rest.dob ?? '',
    kids: rest.kids ?? 0,
    age: Number.isFinite(rest.age) ? rest.age : 0,
    status: rest.status === 'inactive' ? 'inactive' : 'active',
  };
}

function sanitizeEmployees(employees: Employee[]): StoredEmployee[] {
  return employees.map(sanitizeEmployee);
}

async function storeMonthDataServiceRole(monthKey: string, dataArray: Employee[]): Promise<void> {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error(`Invalid reporting month key "${monthKey}". Expected format like 2026-06.`);
  }
  if (dataArray.length === 0) {
    throw new Error('No employee records to store.');
  }

  const clean = sanitizeEmployees(dataArray);
  const { error } = await supabase
    .from('monthly_data')
    .upsert({ month_key: monthKey, data: clean }, { onConflict: 'month_key' });

  if (error) {
    throw new Error(`Supabase upsert failed: ${error.message}`);
  }
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
    await storeMonthDataServiceRole(monthKey, employees);

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
  console.log(`Supabase:   ${SUPABASE_URL}`);
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