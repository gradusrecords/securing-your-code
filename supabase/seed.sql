-- Local development users (password-less; for tests with `supabase start` only).
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'model@zaya.test', '{"role":"model"}'),
  ('22222222-2222-2222-2222-222222222222', 'business@zaya.test', '{"role":"business"}')
on conflict do nothing;
