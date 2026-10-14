begin;
select plan(20);

-- users: M1/M2 models, B1/B2 businesses, A admin, X blocked business
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b1@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x',  '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000d1', 'x@x',  '{"role":"business"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1';
update public.profiles set is_blocked=true where id='00000000-0000-0000-0000-0000000000d1';

insert into public.model_profiles (id, full_name, birth_date, gender, city, phone, telegram, instagram, height_cm, bust_cm, waist_cm, hips_cm, hair, eyes, experience, directions, photos, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Model One', '2000-01-01', 'female', 'Ташкент', '+998900000001', '@m1', '@m1ig', 175, 85, 60, 90, 'brown', 'green', '1-3', '{show,photo}', '{p1.jpg}', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'Model Two', '2001-02-02', 'female', 'Ташкент', '+998900000002', '@m2', '@m2ig', 170, 84, 60, 89, 'black', 'brown', '0', '{show}', '{p2.jpg}', 'pending');
insert into public.business_profiles (id, full_name, company, phone) values
  ('00000000-0000-0000-0000-0000000000b1', 'Biz One', 'Co One', '+998911111111'),
  ('00000000-0000-0000-0000-0000000000b2', 'Biz Two', 'Co Two', '+998922222222');
insert into public.catalog_entries (model_id, agency_rating, agency_note, is_published) values
  ('00000000-0000-0000-0000-0000000000a1', 10, 'top', true),
  ('00000000-0000-0000-0000-0000000000a2', 9, 'new', true);

-- model M1
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.model_profiles), 1, 'model reads only own card');
select is((select count(*)::int from public.business_profiles), 0, 'model cannot read business profiles');
select lives_ok($$update public.model_profiles set about='hi' where id='00000000-0000-0000-0000-0000000000a1'$$, 'model edits own card');
select throws_ok($$update public.model_profiles set status='approved', review_comment='x' where id='00000000-0000-0000-0000-0000000000a1'$$, null, null, 'model cannot change moderation fields');
select lives_ok($$update public.catalog_entries set agency_rating=1$$, 'model update of catalog_entries runs but touches no rows');

-- business B1
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from public.model_profiles), 0, 'business reads no raw model cards');
select is((select count(*)::int from public.business_profiles), 1, 'business reads only own profile');
select is((select count(*)::int from public.public_model_cards), 1, 'business sees only approved+published models');
select is((select model_id::text from public.public_model_cards), '00000000-0000-0000-0000-0000000000a1', 'and it is the approved one');
select is((select is_favorite from public.public_model_cards), true, 'rating 10 is a favorite');
select throws_ok($$insert into public.catalog_entries (model_id) values ('00000000-0000-0000-0000-0000000000a2')$$, null, null, 'business cannot write catalog_entries');

-- model M2 must not see the public cards view (only business/admin do)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from public.public_model_cards), 0, 'model sees no catalog cards');

-- blocked business
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);
select is((select count(*)::int from public.public_model_cards), 0, 'blocked user sees no catalog cards');
select is((select count(*)::int from public.business_profiles), 0, 'blocked user reads no business profile');
select is((select count(*)::int from public.profiles), 1, 'blocked user still reads own profile row');

-- admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select is((select count(*)::int from public.model_profiles), 2, 'admin reads all model cards');
select lives_ok($$update public.catalog_entries set agency_rating=8, is_published=false where model_id='00000000-0000-0000-0000-0000000000a2'$$, 'admin edits catalog entries');

reset role;
select is((select agency_rating::int from public.catalog_entries where model_id='00000000-0000-0000-0000-0000000000a1'), 10, 'catalog rating untouched by model update');
select is((select count(*)::int from information_schema.columns
  where table_schema='public' and table_name='public_model_cards'
    and column_name in ('phone','telegram','instagram','birth_date','parent_contact','full_name')), 0,
  'public_model_cards exposes no contact, birth date, parent or legal-name columns');
select is((select count(*)::int from information_schema.columns
  where table_schema='public' and table_name='public_model_cards' and column_name='display_name'), 1,
  'public_model_cards has display_name');
select * from finish();
rollback;
