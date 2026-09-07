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
