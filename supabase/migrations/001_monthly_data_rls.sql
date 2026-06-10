-- Table for monthly employee snapshots
create table if not exists public.monthly_data (
  month_key text primary key,
  data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monthly_data_month_key_idx on public.monthly_data (month_key desc);

alter table public.monthly_data enable row level security;

-- Public read access (anonymous viewers can browse the dashboard)
drop policy if exists "Public read access" on public.monthly_data;
create policy "Public read access"
  on public.monthly_data
  for select
  to anon, authenticated
  using (true);

-- Admin-only writes (requires app_metadata.role = 'admin' on the JWT)
drop policy if exists "Admin insert" on public.monthly_data;
create policy "Admin insert"
  on public.monthly_data
  for insert
  to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin update" on public.monthly_data;
create policy "Admin update"
  on public.monthly_data
  for update
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Admin delete" on public.monthly_data;
create policy "Admin delete"
  on public.monthly_data
  for delete
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Optional: keep updated_at current on writes
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
