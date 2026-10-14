begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.business_profiles (id, full_name, company, phone) values ('00000000-0000-0000-0000-0000000000b1', 'Biz', 'Co', '+998911111111');
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience) values
  ('00000000-0000-0000-0000-0000000000a1', 'Model Legal', '2000-01-01', 'female', '+998900000001', '@m', 170, '0');
insert into public.questions (id, author_id, body) values ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-0000000000b1', 'Is parking free?');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select throws_ok($$select public.admin_set_blocked('00000000-0000-0000-0000-0000000000a1', true)$$, null, null, 'business cannot block users');
select throws_ok($$select public.admin_answer_question('00000000-0000-0000-0000-00000000d001', 'free')$$, null, null, 'business cannot answer questions');
select is((select count(*)::int from public.admin_users) + (select count(*)::int from public.admin_questions) + (select count(*)::int from public.admin_models), 0, 'business reads no admin views');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.admin_users) + (select count(*)::int from public.admin_questions) + (select count(*)::int from public.admin_models), 0, 'a model reads no admin views');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select is((select author_name from public.admin_questions), 'Biz', 'the question shows who asked');
select throws_ok($$select public.admin_answer_question('00000000-0000-0000-0000-00000000d001', '  ')$$, null, null, 'an empty answer is rejected');
select lives_ok($$select public.admin_answer_question('00000000-0000-0000-0000-00000000d001', 'Parking is free.')$$, 'admin answers');
select ok((select answer = 'Parking is free.' and answered_at is not null from public.admin_questions), 'the answer is stored');
select is((select email from public.admin_users where user_id = '00000000-0000-0000-0000-0000000000b1'), 'b@x', 'admin_users includes e-mail');
select is((select phone from public.admin_models), '+998900000001', 'admin_models includes contacts for the admin');
select lives_ok($$select public.admin_set_blocked('00000000-0000-0000-0000-0000000000b1', true)$$, 'admin blocks a user');
select throws_ok($$select public.admin_set_blocked('00000000-0000-0000-0000-0000000000c1', true)$$, null, null, 'admin cannot block themselves');
select lives_ok($$select public.review_model('00000000-0000-0000-0000-0000000000a1', 'approved', null)$$, 'admin approves a model');
reset role;
select is((select is_blocked from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), true, 'the user is blocked');
select cmp_ok((select count(*)::int from public.audit_log where action in ('question.answer', 'user.block', 'model.review')), '=', 3, 'all three actions are audited');

select * from finish();
rollback;
