# Migration plan: Supabase → Neon

**Status:** plan only — no code in this repo has been changed.
**Chosen route:** Vercel serverless functions (`/api`) + `@neondatabase/serverless`, own session auth.
**Public read:** kept — the dashboard stays viewable without signing in.
**Scope:** `monthly_data` only. The Supabase project hosts other live apps and stays running.
**Last verified against the live database:** 7 Sep 2026.

---

## 1. Why this is not a driver swap

`supabase-js` works from a browser because Supabase runs three things in front of Postgres:

| Supabase piece | What this app uses it for | Neon equivalent |
|---|---|---|
| PostgREST | every query in `src/supabase/data.ts` | none on this route — we write `/api` handlers |
| GoTrue (Auth) | `signInWithPassword`, `getSession`, `onAuthStateChange` | none — we write a session cookie |
| RLS on the JWT | `anon` can read, `app_metadata.role = 'admin'` can write | the `/api` layer becomes the gate |

A Neon connection string is raw Postgres over TCP. It can only be used from a Node process.

> **Never put the Neon connection string in a `VITE_*` variable.** Vite inlines `VITE_*` into the public JS bundle at build time. It would ship the database password to every visitor. All Neon credentials on this route are server-only env vars with no `VITE_` prefix.

The upside: after this migration the **frontend needs no environment variables at all**. It calls same-origin `/api/*`. `src/config.ts` and the config-error screen in `src/main.ts` largely disappear.

---

## 2. Target architecture

```
browser (Vite static bundle, dist/)
   │  fetch('/api/months')            same origin, cookie auth
   ▼
Vercel serverless functions (api/*.ts, Node runtime)
   │  @neondatabase/serverless over HTTP
   ▼
Neon Postgres  ·  monthly_data
```

Excel parsing stays in the browser exactly as it is today (`src/excel/**` is untouched). The browser POSTs the parsed JSON array to `/api/months`.

---

## 3. Schema on Neon

> **Verified against the live project on 7 Sep 2026** (Supabase project `vnuvmbnlxhhhbfpiwzef`, "demographics", eu-west-1).

### What is actually in there

The project had **paused** through free-tier inactivity, which is why the live app was down. It has been restored. Two things this revealed:

**The Demographics app is not the only tenant of this project.** These tables are live and written by other apps — they stay on Supabase and are out of scope:

| Table | Rows | Owner |
|---|---|---|
| `monthly_rosters` | 1,329 | another app |
| `employees` | 618 | another app |
| `analyses` | 14 | CallAudit AI — holds 9.4 MB of base64 audio in `audio_base64` |
| `Guests` | 0 | empty |
| `storage.objects` (`Export_Calls` bucket) | 6 | Vicidial CSV exports — see §10 |

**So the Supabase project does not get retired.** Only `monthly_data` moves. Plan on running both databases indefinitely.

### Schema drift — read this before writing the DDL

The live table does **not** match `supabase/migrations/001_monthly_data_rls.sql`. That file was evidently never the thing that ran:

| | live table | repo migration |
|---|---|---|
| primary key | `id bigint` | `month_key text` |
| `month_key` | `text UNIQUE` | PK |
| `updated_at` | **absent** | present |
| `updated_at` trigger | **absent** | present |

The `id` column is vestigial — nothing in the app reads it; every query goes through `month_key`, and the upsert relies on the `UNIQUE (month_key)` constraint. The DDL below deliberately **drops `id`** and adopts the schema the migration file always intended, `month_key` as the real primary key. That is a clean-up, not a port — don't let anyone "fix" the script to preserve `id`.

**Drop every RLS policy.** They reference `auth.jwt()`, which does not exist on Neon, and the API layer is now the boundary.

Create `neon/001_schema.sql`:

```sql
create table if not exists public.monthly_data (
  month_key   text primary key,
  data        jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists monthly_data_month_key_idx
  on public.monthly_data (month_key desc);

create or replace function public.set_monthly_data_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists monthly_data_set_updated_at on public.monthly_data;
create trigger monthly_data_set_updated_at
  before update on public.monthly_data
  for each row
  execute function public.set_monthly_data_updated_at();
```

Run it in the Neon SQL Editor (Neon console → your project → SQL Editor).

**Delete after migrating:** `RUN_IN_SUPABASE.sql`, `CLEAR_STORED_MONTHS.sql`, `supabase/migrations/001_monthly_data_rls.sql`, `supabase/seed/assign_admin_role.sql`, `supabase/seed/verify_admin_user.sql` — the two seed files write to `auth.users`, a table that only exists on Supabase.

---

## 4. Move the data

One table of JSONB. Skip `pg_dump` (Supabase/Neon server-version mismatches make it fiddly) and use a one-shot script. Create `scripts/migrate-to-neon.ts`, run it once, then delete it:

```ts
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
```

`.env.migrate` (gitignored) holds the old Supabase URL + service-role key and the new `DATABASE_URL`.

**Verify before cutting over.** These are the exact live figures as of 7 Sep 2026 — the script's final `console.table` must match this, row for row:

| month_key | employees |
|---|---|
| 2026-08 | 112 |
| 2026-07 | 106 |
| 2026-06 | 101 |
| 2026-05 | 105 |
| 2026-04 | 98 |
| 2026-03 | 113 |
| 2026-02 | 114 |
| 2026-01 | 118 |

8 months, 867 employee records, 320 kB total. If a month is missing or a count is off by even one, stop and diagnose before touching the frontend.

Note the script selects `month_key, data, created_at` only — do **not** add `updated_at` to that SELECT, the source table has no such column.

---

## 5. The API layer

Add `@vercel/node` and `@neondatabase/serverless`; drop `@supabase/supabase-js`.

```bash
npm i @neondatabase/serverless
npm i -D @vercel/node
npm uninstall @supabase/supabase-js
```

### `api/_lib/db.ts`

```ts
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// HTTP mode — one round trip per query, no pooling state to leak
// between serverless invocations. Use the -pooler host in the URL.
export const sql = neon(process.env.DATABASE_URL);
```

### `api/_lib/auth.ts`

Zero new dependencies — `node:crypto` covers hashing and signing.

```ts
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const SECRET = process.env.SESSION_SECRET!;
export const COOKIE_NAME = 'dp_session';
const MAX_AGE = 60 * 60 * 12; // 12 hours

/** Run once locally to generate ADMIN_PASSWORD_HASH. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const expected = Buffer.from(hex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sign = (payload: string) =>
  createHmac('sha256', SECRET).update(payload).digest('base64url');

export function issueToken(email: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readToken(token?: string): { email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.exp !== 'number' || data.exp < Date.now() / 1000) return null;
    return { email: String(data.email) };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: VercelResponse, token: string | null): void {
  const base = `${COOKIE_NAME}=${token ?? ''}; HttpOnly; Secure; SameSite=Strict; Path=/`;
  res.setHeader('Set-Cookie', token ? `${base}; Max-Age=${MAX_AGE}` : `${base}; Max-Age=0`);
}

export function getSession(req: VercelRequest): { email: string } | null {
  const raw = req.headers.cookie ?? '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return readToken(match?.slice(COOKIE_NAME.length + 1));
}

/** Returns false and writes 401 if the caller is not the admin. */
export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  if (getSession(req)) return true;
  res.status(401).json({ error: 'Admin sign-in required.' });
  return false;
}
```

`HttpOnly` means the token is unreadable from JavaScript, so an XSS bug can't exfiltrate it — a real improvement over the current `localStorage`-backed Supabase session.

### Route files

| File | Method | Replaces | Auth |
|---|---|---|---|
| `api/months/index.ts` | `GET` | `fetchMonthKeys()` | public |
| | `POST` | `storeMonthData()` | admin |
| | `DELETE` | `deleteAllMonthData()` | admin |
| `api/months/[key].ts` | `GET` | `fetchMonthData()` | public |
| | `DELETE` | `deleteMonthData()` | admin |
| `api/repair.ts` | `POST` | `repairAllStoredMonths()` | admin |
| `api/auth/login.ts` | `POST` | `login()` | — |
| `api/auth/logout.ts` | `POST` | `logout()` | — |
| `api/auth/session.ts` | `GET` | `initAuth()` / `getSession()` | — |

`api/months/index.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_lib/db';
import { requireAdmin } from '../_lib/auth';
import { normalizeEmployees } from '../../src/utils/normalize';
import { sanitizeEmployees } from '../_lib/sanitize';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const rows = await sql`select month_key from monthly_data order by month_key desc`;
    return res.status(200).json(rows.map((r) => r.month_key));
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const { monthKey, data } = req.body ?? {};

    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res.status(400).json({ error: 'Invalid reporting month key. Use a month like January 2026.' });
    }
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No employee records to store.' });
    }

    const clean = sanitizeEmployees(normalizeEmployees(data));
    await sql`
      insert into monthly_data (month_key, data)
      values (${monthKey}, ${JSON.stringify(clean)}::jsonb)
      on conflict (month_key) do update set data = excluded.data
    `;
    return res.status(200).json({ stored: clean.length });
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const rows = await sql`delete from monthly_data returning month_key`;
    return res.status(200).json({ cleared: rows.length });
  }

  res.setHeader('Allow', 'GET, POST, DELETE');
  return res.status(405).json({ error: 'Method not allowed' });
}
```

`api/auth/login.ts`:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyPassword, issueToken, setSessionCookie } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');

  const ok =
    email === process.env.ADMIN_EMAIL!.toLowerCase() &&
    verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);

  if (!ok) {
    // deliberately vague, and no timing signal about which half was wrong
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  setSessionCookie(res, issueToken(email));
  return res.status(200).json({ email, role: 'admin' });
}
```

**Move `sanitizeEmployee`/`sanitizeEmployees` to `api/_lib/sanitize.ts`.** Right now that logic is duplicated verbatim in `src/supabase/data.ts` and `scripts/watch-upload.ts` (the watcher even has a comment apologising for the copy). Server-side is where it belongs — it's a trust boundary, not a formatting nicety — and this collapses the two copies into one.

---

## 6. Frontend changes, file by file

### Rewrite: `src/supabase/data.ts` → `src/api/data.ts`

Keep every exported function name identical, so `src/app/events.ts` and `src/app/months.ts` only change their import path.

```ts
import { hydrateEmployeeDates } from '../utils/date';
import { normalizeEmployees } from '../utils/normalize';
import type { Employee } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchMonthKeys(): Promise<string[]> {
  return request<string[]>('/api/months');
}

export async function fetchMonthData(monthKey: string): Promise<Employee[] | null> {
  try {
    const rows = await request<Employee[]>(`/api/months/${encodeURIComponent(monthKey)}`);
    return normalizeEmployees(hydrateEmployeeDates(rows));
  } catch (err) {
    console.error('Error fetching month data:', err);
    return null;   // preserves current caller behaviour in months.ts
  }
}

export async function storeMonthData(monthKey: string, data: Employee[]): Promise<void> {
  await request('/api/months', { method: 'POST', body: JSON.stringify({ monthKey, data }) });
}

export async function deleteMonthData(monthKey: string): Promise<void> {
  await request(`/api/months/${encodeURIComponent(monthKey)}`, { method: 'DELETE' });
}

export async function deleteAllMonthData(): Promise<number> {
  const { cleared } = await request<{ cleared: number }>('/api/months', { method: 'DELETE' });
  return cleared;
}

export async function repairAllStoredMonths(): Promise<{ repaired: number; months: string[] }> {
  return request('/api/repair', { method: 'POST' });
}
```

`repairAllStoredMonths` gets meaningfully better here. Today it does a fetch-normalize-store round trip **per month from the browser**; server-side it's one call that never ships the data over the wire twice.

Then delete `src/supabase/client.ts` and the `src/supabase/` folder.

### Rewrite: `src/auth.ts`

Only the four Supabase calls change. `setRole()` — all the DOM show/hide logic — stays exactly as written.

```ts
import { getById } from './utils/dom';
import type { UserRole } from './types';

let currentRole: UserRole = 'viewer';

export function getCurrentRole(): UserRole { return currentRole; }

export function setRole(role: UserRole, authenticated = false): void {
  /* unchanged from the current file */
}

export async function initAuth(): Promise<void> {
  try {
    const res = await fetch('/api/auth/session');
    const session = res.ok ? await res.json() : null;
    setRole(session ? 'admin' : 'viewer', Boolean(session));
  } catch {
    setRole('viewer', false);
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return body.error ?? 'Sign-in failed.';
  }
  setRole('admin', true);
  return null;
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  setRole('viewer', false);
}
```

`onAuthStateChange` has no equivalent and isn't needed — nothing else in the app mutates the session. Drop it.

Delete `friendlyAuthError()` entirely: all three of its messages are Supabase-dashboard instructions ("Authentication → Users → Add user") that are meaningless on Neon.

### `src/config.ts`

Delete `isSupabaseConfigured`, `getSupabaseConfigError`, `assertSupabaseConfigured`, `getSupabaseUrl`, `getSupabaseAnonKey`. **Keep `SALARY_BRACKETS` and `TENURE_DAY_LABELS`** — they're unrelated constants that happen to live in this file and are imported elsewhere.

### `src/main.ts`

Delete `showConfigurationError()` and the `isSupabaseConfigured()` guard — there's no frontend config left to be missing. `init()` becomes:

```ts
async function init(): Promise<void> {
  bindEvents();
  await initAuth();
  await refreshMonthSelector();
}

init().catch((err) => {
  console.error('Failed to initialize app:', err);
});
```

Consider keeping a minimal error banner for the case where `/api` is unreachable.

### `src/app/events.ts`

- Line 5: change the import path to `'../api/data'`.
- Lines ~250–253: the "run `supabase/seed/assign_admin_role.sql`" alert is dead — on Neon anyone who signs in successfully *is* the admin. Delete that whole `if (getCurrentRole() !== 'admin')` block after login.

### `src/app/months.ts`

- Line 4: import path → `'../api/data'`.
- Line 68: reword "Check your connection or Supabase configuration" → "Check your connection, then refresh the page."

### Untouched

`src/excel/**`, `src/charts/**`, `src/dashboard/**`, `src/utils/**`, `src/teams.ts`, `src/types.ts`, `src/state.ts`, `src/styles.css`, `index.html`. Roughly 80% of the codebase doesn't move.

---

## 7. The two Node scripts

These are the easy wins — they already run in Node, so they can use the connection string directly.

### `scripts/watch-upload.ts`

Replace the service-role Supabase client with `neon()`:

```ts
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL!);

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
```

Everything else in that file — chokidar, `waitForFileStable`, the processed/failed folder shuffle, `deriveMonthKey` — is unchanged. Rename `.env.watch` keys: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → a single `DATABASE_URL`. Update `scripts/.env.watch.example` and the file's header comment to match. `scripts/start-watcher.bat` needs no change.

Nice side effect: the service-role key — a credential that bypassed RLS on everything in the project — disappears from that Windows machine entirely, replaced by a connection string scoped to one database.

### `scripts/repair-and-upload.ts`

Same swap. Two things to fix while you're in there:

- It currently uses the **anon** key to upsert, which only worked because it ran before RLS was tightened, or against a permissive policy. On Neon this is moot, but note the file has never been safe to run from an untrusted context.
- Lines 21–27 hardcode absolute paths to `C:/Users/ALPHA KONNECT/OneDrive/...`. Move those to env vars or argv so the script isn't machine-specific.

`scripts/inspect-salaries.ts` and `scripts/verify-normalize.ts` never touch Supabase — no changes.

---

## 8. Environment variables

| Variable | Where | Value |
|---|---|---|
| `DATABASE_URL` | Vercel (all 3 envs), `.env` local, `.env.watch` | the Neon pooler connection string |
| `ADMIN_EMAIL` | Vercel, `.env` | `jillian@iconaf.com` |
| `ADMIN_PASSWORD_HASH` | Vercel, `.env` | output of `hashPassword('...')` |
| `SESSION_SECRET` | Vercel, `.env` | `openssl rand -base64 32` |

All four are **server-only — no `VITE_` prefix**. Rewrite `.env.example` accordingly and delete the two `VITE_SUPABASE_*` entries.

Unlike the current setup, these are read at *runtime*, not baked in at build time — so changing the admin password no longer requires a redeploy, just an env var update. Worth removing the "Vite embeds them at build time; changing vars requires a new deploy" warnings from the README, since they stop being true.

Generate the hash once:

```bash
npx tsx -e "import {hashPassword} from './api/_lib/auth.ts'; console.log(hashPassword('your-new-password'))"
```

---

## 9. Build config gotchas

Three things that will bite during the first build:

**1. `tsconfig.json` only includes `src`.** `npm run build` runs `tsc && vite build`, so nothing in `api/` gets typechecked, and `api/` needs Node types while `src/` needs DOM. Add a second config:

`tsconfig.api.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["api", "src/utils", "src/types.ts"]
}
```
and update the script: `"build": "tsc && tsc -p tsconfig.api.json && vite build"`. Add `@types/node` as a devDependency.

**2. `api/` importing from `src/`.** Vercel bundles each function with its imports, so `import { normalizeEmployees } from '../../src/utils/normalize'` works — but only for files with no DOM dependency. `src/utils/normalize.ts`, `src/utils/date.ts` and `src/types.ts` are pure and safe. Do **not** import anything from `src/dashboard/`, `src/charts/` or `src/utils/dom.ts` into a function.

**3. `netlify.toml` becomes a lie.** It configures a pure static build with no functions, so a Netlify deploy would serve a frontend whose `/api/*` calls all 404. Either delete `netlify.toml` and the Netlify section of the README, or port the handlers to Netlify Functions. Deleting is the honest option if Vercel is the real deployment.

`vercel.json` needs one change — the current catch-all rewrite would swallow `/api` routes:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }]
}
```

---

## 10. Security cleanup while you're in here

Three findings from reading the repo. None are caused by the migration, but this is the natural moment to fix them.

**`index.legacy.html` is committed with live credentials.** Lines 647–648 hardcode the Supabase project URL and anon key; lines 654–655 hardcode `admin/ak2026` and `access/user01`. The README says "Hardcoded client-side passwords were removed" — they were removed from the TypeScript app, but they're still sitting in this file in git history. Delete the file (git history keeps it if you ever want it), and treat `ak2026` as burned wherever else it might be used.

**Rotate the Neon password.** The connection string was shared in plaintext chat. Neon console → your project → Roles → reset the `neondb_owner` password, then update the env vars in Vercel and `.env.watch`.

**Consider a scoped role instead of `neondb_owner`.** The functions only need CRUD on one table. Owner-level access from a serverless function is more privilege than the job requires:

```sql
create role app_api login password '...';
grant connect on database neondb to app_api;
grant usage on schema public to app_api;
grant select, insert, update, delete on public.monthly_data to app_api;
```
Use that role's connection string as `DATABASE_URL`.

**Open item — the `Export_Calls` bucket is public.** It holds five Vicidial campaign-status CSVs from 25 May 2026 (~540 kB) plus an empty-folder placeholder, and `public = true` means anyone with the object URL can download them without authenticating. Nothing in this repo reads them. You said you'd check what depends on those URLs before changing it — flagging it here so it doesn't get lost. Flipping it is one statement: `update storage.buckets set public = false where id = 'Export_Calls';`

**RLS is disabled on three tables in this project** — `employees`, `monthly_rosters` and `Guests`. With RLS off, anyone holding the project's anon key can read or modify every row, and anon keys ship in browser bundles by design. That's ~1,950 rows of workforce data. Out of scope for this migration, but it belongs to whoever owns those apps. Do **not** just run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` — enabling RLS with no policies blocks all access and breaks the app that writes them. Each table needs policies written first.

One thing to sit with: this dataset is real workforce PII — names, dates of birth, nationalities, exact salaries, whether someone rents or lives with family, how many children they have — and the dashboard serves it to anyone with the URL, no sign-in. That's the current behaviour and this plan preserves it as you asked. But it's the kind of thing worth a deliberate decision with whoever owns the data at Alpha Konnect, rather than one inherited from an RLS policy written months ago. Flipping it later is a two-line change: add `requireAdmin` to the two `GET` handlers.

---

## 11. Order of operations

Nothing here is destructive until step 9 — Supabase stays live and serving the whole time.

1. Run `neon/001_schema.sql` in the Neon SQL Editor.
2. Run `scripts/migrate-to-neon.ts`; verify month count and per-month row counts against the live app.
3. `npm i @neondatabase/serverless`, `npm i -D @vercel/node @types/node`.
4. Add `api/_lib/{db,auth,sanitize}.ts` and the six route files.
5. Add `tsconfig.api.json`, update `build` script and `vercel.json`.
6. Rewrite the frontend: `src/api/data.ts`, `src/auth.ts`, `src/config.ts`, `src/main.ts`, plus the import paths in `events.ts` / `months.ts`.
7. Set the four env vars in Vercel (Preview first). Deploy to a preview URL and test: browse a month unauthenticated → sign in → upload a file → delete a month → repair → sign out.
8. Point the watcher at Neon; drop a test `.xlsx` in the watch folder and confirm it lands.
9. **Only then:** `npm uninstall @supabase/supabase-js`, delete `src/supabase/`, `supabase/`, the four `*_SUPABASE*.sql` files, `index.legacy.html`, `netlify.toml`, and `scripts/migrate-to-neon.ts`. Rewrite the README's Stack / Quick start / Deploy sections.
10. **Leave the Supabase project running.** `monthly_rosters`, `employees` and `analyses` are live for other apps — pausing or deleting it would break them. Keep `monthly_data` in place as a read-only rollback for a few weeks, then `drop table public.monthly_data;` once you're confident. Rotate the Neon password at that point.

Because the project stays up, the free-tier inactivity pause that took the app down remains a live risk for whatever still depends on it. If the other apps are also low-traffic, that's worth solving separately — either a paid plan or a scheduled keep-alive query.

**Rough effort:** the API layer and auth are the real work (~350 lines of new code). The frontend rewrite is mechanical — roughly 200 lines changed across 6 files, with the same function signatures throughout. The two scripts are ~20 lines each. Call it a focused day, plus testing.
