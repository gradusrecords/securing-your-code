begin;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x', '{"role":"business"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1';
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience) values
  ('00000000-0000-0000-0000-0000000000a1', 'M', '2000-01-01', 'female', '+998900000001', '@m', 170, '0');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok($$select public.review_model('00000000-0000-0000-0000-0000000000a1', 'approved', null)$$, null, null, 'a model cannot approve its own card');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select lives_ok($$select public.review_model('00000000-0000-0000-0000-0000000000a1', 'returned', 'Add a full-length photo')$$, 'admin returns a card with a comment');
reset role;
select is((select review_comment from public.model_profiles where id='00000000-0000-0000-0000-0000000000a1'), 'Add a full-length photo', 'the comment is stored');

select * from finish();
rollback;
