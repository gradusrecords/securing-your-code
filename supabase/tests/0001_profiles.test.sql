begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@x', '{"role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'd@x', '{"role":"model"}');

select is((select role::text from public.profiles where id='00000000-0000-0000-0000-00000000000a'), 'business', 'signup with role=business creates business profile');
select is((select role::text from public.profiles where id='00000000-0000-0000-0000-00000000000b'), null, 'signup metadata role=admin never yields admin');
select is((select role::text from public.profiles where id='00000000-0000-0000-0000-00000000000c'), null, 'social signup without role leaves role null');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select is((select count(*)::int from public.profiles), 1, 'user sees only own profile');
select is((select id::text from public.profiles), '00000000-0000-0000-0000-00000000000a', 'and it is theirs');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', true);
select throws_ok($$select public.set_my_role('admin')$$, null, null, 'set_my_role(admin) is rejected');
select lives_ok($$select public.set_my_role('model')$$, 'set_my_role(model) works while role is null');
select throws_ok($$select public.set_my_role('business')$$, null, null, 'role cannot be changed twice');

reset role;
update public.profiles set role='admin', is_blocked=true where id='00000000-0000-0000-0000-00000000000d';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', true);
select is(public.is_admin(), false, 'blocked admin is not admin');

select * from finish();
rollback;
