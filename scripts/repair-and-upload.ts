import { readFileSync, existsSync } from 'fs';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { parseExcelBuffer } from '../src/excel';
import { normalizeEmployees } from '../src/utils/normalize';
import { getBranch } from '../src/constants';

config({ path: '.env' });

const url = process.env.VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const FILES: Record<string, string> = {
  '2026-01': 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Jan_2026.xlsx',
  '2026-02': 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Feb_2026.xlsx',
  '2026-03': 'C:/Users/ALPHA KONNECT/OneDrive/Belgeler/1001tvs/Mar_2026.xlsx',
  '2026-01-alt': 'C:/Users/ALPHA KONNECT/Downloads/January 2026.xlsx',
  '2026-06': 'C:/Users/ALPHA KONNECT/Downloads/processed/2026-06-23T09-56-31-148Z__June 2026.xlsx',
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

  const { error } = await supabase
    .from('monthly_data')
    .upsert({ month_key: monthKey, data }, { onConflict: 'month_key' });

  if (error) throw error;

  console.log(
    `✓ ${monthKey}: ${data.length} employees | Other teams: ${otherTeams.length ? otherTeams.join(', ') : 'none'} | bracket "0": ${badBrackets}`,
  );
}

async function repairStored(): Promise<void> {
  const { data: rows, error } = await supabase.from('monthly_data').select('month_key, data');
  if (error) throw error;
  if (!rows?.length) {
    console.log('No stored months in database.');
    return;
  }

  for (const row of rows) {
    const normalized = normalizeEmployees(row.data as Parameters<typeof normalizeEmployees>[0]);
    const { error: upsertError } = await supabase
      .from('monthly_data')
      .upsert({ month_key: row.month_key, data: normalized }, { onConflict: 'month_key' });
    if (upsertError) throw upsertError;
    console.log(`✓ Repaired ${row.month_key} (${normalized.length} employees)`);
  }
}

const mode = process.argv[2] ?? 'upload';

if (mode === 'repair') {
  await repairStored();
} else {
  await uploadMonth('2026-01', FILES['2026-01']);
  await uploadMonth('2026-02', FILES['2026-02']);
  await uploadMonth('2026-03', FILES['2026-03']);
  await uploadMonth('2026-06', FILES['2026-06']);
}

console.log('Done.');
