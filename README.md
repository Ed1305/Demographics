# Alpha Konnect · Demographics Portal

**Live app:** [demographics-rust.vercel.app](https://demographics-rust.vercel.app/)

Workforce demographics and retention dashboard. Upload monthly Excel reports, store them in Supabase, and explore charts, filters, and retention tables.

## Stack

- TypeScript + Vite
- Chart.js for visualizations
- ExcelJS for Excel parsing (green/red ribbon detection)
- Supabase for storage and authentication

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and add your Supabase project values:

   ```bash
   cp .env.example .env
   ```

   Required variables:

   | Variable | Description |
   |----------|-------------|
   | `VITE_SUPABASE_URL` | Supabase project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

3. **Set up Supabase**

   Run the SQL migration in the Supabase SQL editor:

   - `supabase/migrations/001_monthly_data_rls.sql` — creates `monthly_data`, enables RLS, and adds policies

   Create an admin user:

   1. Supabase Dashboard → **Authentication** → **Users** → **Add user**
   2. Run `supabase/seed/assign_admin_role.sql` with your admin email to grant the `admin` role

4. **Run locally**

   ```bash
   npm run dev
   ```

5. **Build for production**

   ```bash
   npm run build
   npm run preview
   ```

## Excel format

Each workbook should contain two coloured header ribbons on the first sheet:

| Ribbon | Section | Header example |
|--------|---------|----------------|
| **Green** | Active employees | Active Start Dates, Names, Team, … |
| **Red** | Inactive employees | Inactive Start Dates, Names, Team, … |

The parser detects sections by **green/red row colour** and by header text. Columns are matched **by header name**, not fixed position — so column order can change between files.

Expected headers include: Names, Team, Age, D.O.B, Gender, Nationality, Qualification, Area, Kids, Renting/Family Home, Experience, Salaries (exact + bracket), Source.

Filenames like `January 2026.xlsx` are auto-detected for the month key. Use `.xlsx` format (not legacy `.xls`).

## Roles

| Role | Access |
|------|--------|
| **Viewer** (default) | Browse dashboard and charts without signing in |
| **Admin** | Upload Excel files and delete months (requires Supabase login with `app_metadata.role = admin`) |

Hardcoded client-side passwords were removed. Admin access is enforced by Supabase Auth and Row Level Security.

## Deploy

The app builds to `dist/`. Set the same `VITE_*` environment variables on your host **before** building (Vite embeds them at build time).

Find keys in Supabase Dashboard → **Project Settings** → **API**.

### Vercel

**Production URL:** [https://demographics-rust.vercel.app/](https://demographics-rust.vercel.app/) (Vercel project: `demographics-`)

1. **Import the repo** at [vercel.com/new](https://vercel.com/new) and connect your GitHub repository.
2. Vercel should auto-detect **Vite**. Confirm:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
3. **Before deploying**, open **Environment Variables** and add:

   | Name | Value |
   |------|--------|
   | `VITE_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon (public) key |

   Apply to **Production**, **Preview**, and **Development** so all deploys work.
4. Click **Deploy**.
5. If you add or change env vars later: **Project → Settings → Environment Variables**, then **Deployments → … → Redeploy** (a new build is required).

`vercel.json` in this repo sets the Vite build output and SPA routing.

### Netlify

`netlify.toml` is included. Connect the repo and configure:

1. **Site configuration → Environment variables** — add both (required before build):
   - `VITE_SUPABASE_URL` — e.g. `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key
2. **Build command:** `npm run build`
3. **Publish directory:** `dist`
4. **Redeploy** after adding env vars (Vite embeds them at build time; changing vars requires a new deploy)

Find keys in Supabase Dashboard → **Project Settings** → **API**.

### Other static hosts

Any static host (Vercel, Cloudflare Pages, GitHub Pages) works the same way: install, set env vars, run `npm run build`, publish `dist/`.

## Project structure

```text
src/
  app/          Event handlers and month loading
  charts/       Chart.js rendering
  dashboard/    Filters, summary cards, tables
  supabase/     Client and data access
  utils/        Dates, DOM helpers, month keys
supabase/
  migrations/   Database schema + RLS
  seed/         Admin role assignment SQL
```

## Legacy file

`index.legacy.html` is the original single-file version, kept for reference only. Use the TypeScript app for all new work.
