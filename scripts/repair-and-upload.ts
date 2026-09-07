import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { parseExcelBuffer } from '../src/excel';
import { normalizeEmployees } from '../src/utils/normalize';
import { getBranch } from '../src/constants';

config({ path: '.env' });

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL in .env');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const FILES: Record<string, string> = {
  '2026-01': process.env.MONTH_FILE_2026_01 ?? '',
  '2026-02': process.env.MONTH_FILE_2026_02 ?? '',
  '2026-03': process.env.MONTH_FILE_2026_03 ?? '',
  '2026-06': process.env.MONTH_FILE_2026_06 ?? '',
};

async function uploadMonth(monthKey: string, filePath: string): Promise<void> {
  if (!existsSync(filePath)) {
    console.log(`SKIP ${monthKey}: file not found (${filePath})`);
    return;
  }

  const buffer = readFileSync(filePath);
  const parsed = await parseExcelBuffer(buffer, filePath);
  const data = normalizeEmployees(parsed);

  const otherTeams = [...new Set(data.map((d) => d.team).filter((t) => getBranch(t) === 'Other'))];
  const badBrackets = data.filter((d) => d.status === 'active' && d.salaryBracket === '0').length;

  await sql`
    insert into monthly_data (month_key, data)
    values (${monthKey}, ${JSON.stringify(data)}::jsonb)
    on conflict (month_key) do update set data = excluded.data
  `;

  console.log(
    `✓ ${monthKey}: ${data.length} employees | Other teams: ${otherTeams.length ? otherTeams.join(', ') : 'none'} | bracket "0": ${badBrackets}`,
  );
}

async function repairStored(): Promise<void> {
  const rows = await sql`select month_key, data from monthly_data`;
  if (!rows.length) {
    console.log('No stored months in database.');
    return;
  }

  for (const row of rows) {
    const normalized = normalizeEmployees(row.data as Parameters<typeof normalizeEmployees>[0]);
    await sql`
      insert into monthly_data (month_key, data)
      values (${String(row.month_key)}, ${JSON.stringify(normalized)}::jsonb)
      on conflict (month_key) do update set data = excluded.data
    `;
    console.log(`✓ Repaired ${row.month_key} (${normalized.length} employees)`);
  }
}

const mode = process.argv[2] ?? 'upload';
const monthKeyArg = process.argv[3];
const filePathArg = process.argv[4];

if (mode === 'repair') {
  await repairStored();
} else if (monthKeyArg && filePathArg) {
  await uploadMonth(monthKeyArg, filePathArg);
} else {
  const entries = Object.entries(FILES).filter(([, filePath]) => filePath);
  if (entries.length === 0) {
    console.error(
      'Pass a month key and file path (e.g. npx tsx scripts/repair-and-upload.ts upload 2026-01 ./Jan.xlsx),\n' +
        'or set MONTH_FILE_YYYY_MM env vars.',
    );
    process.exit(1);
  }
  for (const [key, filePath] of entries) {
    await uploadMonth(key, filePath);
  }
}

console.log('Done.');
