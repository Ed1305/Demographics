-- Run this AFTER creating an admin user in Supabase Auth (Authentication > Users > Add user).
-- Replace the email below with your admin account email.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'jillian@iconaf.com';

-- Optional viewer account (can sign in but cannot upload/delete):
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"viewer"}'::jsonb
-- where email = 'viewer@example.com';
