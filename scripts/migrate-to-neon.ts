import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { neon } from '@neondatabase/serverless';

config({ path: '.env.migrate' });

const supabase = createClient(
  process.env.OLD_SUPABASE_URL!,
  process.env.OLD_SUPABASE_SERVICE_ROLE_KEY!,
);
const sql = neon(process.env.DATABASE_URL!);

const { data: rows, error } = await supabase
  .from('monthly_data')
  .select('month_key, data, created_at');

if (error) throw error;
if (!rows?.length) {
  console.log('Nothing to migrate.');
  process.exit(0);
}

for (const row of rows) {
  await sql`
    insert into monthly_data (month_key, data, created_at)
    values (${row.month_key}, ${JSON.stringify(row.data)}::jsonb, ${row.created_at})
    on conflict (month_key) do update set data = excluded.data
  `;
  const count = Array.isArray(row.data) ? row.data.length : 0;
  console.log(`✓ ${row.month_key} — ${count} employees`);
}

// verify
const check = await sql`select month_key, jsonb_array_length(data) as n
                        from monthly_data order by month_key desc`;
console.table(check);
