begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'boss@zaya.test', '{"role":"business"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
select throws_ok($$select public.promote_to_admin('boss@zaya.test')$$, null, null, 'authenticated users cannot promote');

reset role;
set local role anon;
select throws_ok($$select public.promote_to_admin('boss@zaya.test')$$, null, null, 'anon cannot promote');

reset role;
set local role service_role;
select lives_ok($$select public.promote_to_admin('boss@zaya.test')$$, 'service_role can promote');
reset role;
select is((select role::text from public.profiles where id='00000000-0000-0000-0000-0000000000f1'), 'admin', 'target became admin');

set local role service_role;
select throws_ok($$select public.promote_to_admin('nobody@zaya.test')$$, null, null, 'unknown email is rejected');
reset role;

select * from finish();
rollback;
