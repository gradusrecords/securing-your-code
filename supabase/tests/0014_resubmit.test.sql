begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x', '{"role":"business"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status, review_comment) values
  ('00000000-0000-0000-0000-0000000000a1', 'Returned', '2000-01-01', 'female', '+998900000001', '@r', 170, '0', 'returned', 'Add a full-length photo'),
  ('00000000-0000-0000-0000-0000000000a2', 'Approved', '2000-01-01', 'female', '+998900000002', '@a', 170, '0', 'approved', null);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$update public.model_profiles set about = 'now with a full-length photo' where id = '00000000-0000-0000-0000-0000000000a1'$$, 'the returned model edits the card');
reset role;
select is((select status::text from public.model_profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'pending', 'a returned card goes back to review after the model edits it');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select lives_ok($$update public.model_profiles set about = 'small edit' where id = '00000000-0000-0000-0000-0000000000a2'$$, 'an approved model edits the card');
reset role;
select is((select status::text from public.model_profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'approved', 'an approved card stays approved after a small edit');

-- the admin returning a card again must not flip it to pending
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.review_model('00000000-0000-0000-0000-0000000000a2', 'returned', 'Please fix the phone');
reset role;
select is((select status::text from public.model_profiles where id = '00000000-0000-0000-0000-0000000000a2'), 'returned', 'an admin review is not turned back into pending');

select * from finish();
rollback;
