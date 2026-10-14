begin;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'm3@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}');

-- guardian rule
select throws_ok(
  $$insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience)
    values ('00000000-0000-0000-0000-0000000000a1', 'Minor', current_date - interval '17 years', 'female', '+998900000001', '@m', 170, '0')$$,
  null, null, 'a 17-year-old without a guardian is rejected');
select lives_ok(
  $$insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, parent_contact)
    values ('00000000-0000-0000-0000-0000000000a1', 'Minor', current_date - interval '17 years', 'female', '+998900000001', '@m', 170, '0', 'Mom +998901112233')$$,
  'a 17-year-old with a guardian is accepted');
select lives_ok(
  $$insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience)
    values ('00000000-0000-0000-0000-0000000000a2', 'Adult', current_date - interval '18 years', 'female', '+998900000002', '@a', 170, '0')$$,
  'exactly 18 needs no guardian');
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a3', 'Hidden', '1999-01-01', 'female', '+998900000003', '@h', 170, '0', 'approved');
update public.model_profiles set status='approved' where id='00000000-0000-0000-0000-0000000000a2';
insert into public.catalog_entries (model_id, is_published) values
  ('00000000-0000-0000-0000-0000000000a2', true),
  ('00000000-0000-0000-0000-0000000000a3', false);

-- photos
insert into storage.objects (bucket_id, name) values
  ('model-photos', '00000000-0000-0000-0000-0000000000a2/a.jpg'),
  ('model-photos', '00000000-0000-0000-0000-0000000000a3/h.jpg');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('model-photos', '00000000-0000-0000-0000-0000000000a2/new.jpg')$$, 'model uploads into own folder');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('model-photos', '00000000-0000-0000-0000-0000000000a3/evil.jpg')$$, null, null, 'model cannot upload into another folder');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from storage.objects where name like '%a.jpg'), 1, 'business reads photos of a published approved model');
select is((select count(*)::int from storage.objects where name like '%h.jpg'), 0, 'business cannot read photos of an unpublished model');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
select is((select count(*)::int from storage.objects where name like '%a.jpg'), 0, 'another model cannot read photos');

select * from finish();
rollback;
