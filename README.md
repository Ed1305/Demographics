# Alpha Konnect · Demographics Portal

**Live app:** [demographics-rust.vercel.app](https://demographics-rust.vercel.app/)

Workforce demographics and retention dashboard. Upload monthly Excel reports, store them in Neon Postgres, and explore charts, filters, and retention tables.

## Stack

- TypeScript + Vite
- Chart.js for visualizations
- ExcelJS for Excel parsing (green/red ribbon detection)
- Neon Postgres for storage
- Vercel serverless functions (`/api`) for data access and session auth

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy the example env file and add your server-only values:

   ```bash
   cp .env.example .env
   ```

   Required variables (never prefix these with `VITE_`):

   | Variable | Description |
   |----------|-------------|
   | `DATABASE_URL` | Neon pooler connection string |
   | `ADMIN_EMAIL` | Admin sign-in email |
   | `ADMIN_PASSWORD_HASH` | Output of `hashPassword()` in `api/_lib/auth.ts` |
   | `SESSION_SECRET` | Random secret for signing session cookies (`openssl rand -base64 32`) |

   Generate the password hash once:

   ```bash
   npx tsx -e "import {hashPassword} from './api/_lib/auth.ts'; console.log(hashPassword('your-new-password'))"
   ```

3. **Set up Neon**

   Run `neon/001_schema.sql` in the Neon SQL Editor (Neon console → your project → SQL Editor).

4. **Run locally**

   ```bash
   npx vercel dev
   ```

   This serves the Vite app and `/api` together so the dashboard can load stored months. `npm run dev` starts Vite only and will not serve the API.

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
| **Admin** | Upload Excel files, delete months, and repair stored data (requires sign-in; a successful login *is* the admin) |

Admin access is an HttpOnly session cookie issued by `/api/auth/login`. The dashboard stays readable without signing in.

## Deploy

The app builds to `dist/` and runs `/api` as Vercel serverless functions. The four server-only env vars are read at runtime.

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
   | `DATABASE_URL` | Neon pooler connection string |
   | `ADMIN_EMAIL` | Admin sign-in email |
   | `ADMIN_PASSWORD_HASH` | `scrypt` hash from `hashPassword()` |
   | `SESSION_SECRET` | Random secret (`openssl rand -base64 32`) |

   Apply to **Production**, **Preview**, and **Development** so all deploys work.
4. Click **Deploy**.

`vercel.json` in this repo sets the Vite build output and SPA routing that leaves `/api` alone.

## Project structure

```text
src/
  api/          Browser fetch wrappers for /api
  app/          Event handlers and month loading
  charts/       Chart.js rendering
  dashboard/    Filters, summary cards, tables
  utils/        Dates, DOM helpers, month keys
api/
  _lib/         Neon client, session auth, sanitization
  months/       Public reads, admin writes
  auth/         Login, logout, session
neon/
  001_schema.sql
```
