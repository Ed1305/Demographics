-- Run in Supabase → SQL Editor to check the admin account.
-- Replace the email if needed.

select
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  raw_app_meta_data ->> 'role' as app_role
from auth.users
where email = 'jillian@iconaf.com';

-- Expected: one row, email_confirmed_at is NOT null, app_role = 'admin'
-- If no rows: create the user in Authentication → Users → Add user
-- If app_role is null: run assign_admin_role.sql
-- Password cannot be read here — reset it in the Supabase Dashboard (see below)
