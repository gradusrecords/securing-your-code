-- Run once in the Supabase SQL editor (service role), AFTER the superadmin has signed up in the app:
select public.promote_to_admin('replace-with-superadmin-email');
