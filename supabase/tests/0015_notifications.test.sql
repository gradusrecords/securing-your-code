begin;
select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'm3@x', '{"role":"model"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set is_blocked = true where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set language = 'uz' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.business_profiles (id, full_name, company, phone) values
  ('00000000-0000-0000-0000-0000000000b1', 'Secret Person', 'Secret Co', '+998911111111');
insert into public.model_profiles (id, full_name, birth_date, gender, city, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M1', '2000-01-01', 'female', 'Ташкент', '+998900000001', '@m1', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'M2', '2000-01-01', 'female', 'Ташкент', '+998900000002', '@m2', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a3', 'M3', '2000-01-01', 'female', 'Ташкент', '+998900000003', '@m3', 170, '0', 'approved');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.create_order('{"project":{"title":"Shoot","type":"photo"},"when_where":{"date":"2026-12-01","city":"Ташкент"},"who":{"count":1},"contact":{"name":"Secret Person","phone":"+998911111111"}}') as oid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_approve_order(:'oid', array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3']::uuid[]);
reset role;

select is((select count(*)::int from public.notifications where kind = 'order_new'), 1, 'one new-order notification: the blocked recipient is skipped and non-recipients get nothing');
select is((select user_id::text from public.notifications where kind = 'order_new'), '00000000-0000-0000-0000-0000000000a1', 'it goes to the recipient');
select is((select title from public.notifications where kind = 'order_new'), 'Yangi buyurtma', 'the text follows the recipient language (uz)');
select is((select title from public.notif_text('order_new', 'xx')), 'Новый заказ', 'an unknown language falls back to Russian');
select ok((select to_jsonb(n)::text not like '%Secret%' and to_jsonb(n)::text not like '%998911%' from public.notifications n where kind = 'order_new'), 'no company, contact or client name in the notification');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_approve_order(:'oid', array['00000000-0000-0000-0000-0000000000a1']::uuid[]);
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_new'), 1, 'approving again does not duplicate notifications');

-- order changed
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.update_order(:'oid', '{"project":{"title":"Shoot v2","type":"photo"},"when_where":{"date":"2026-12-02","city":"Ташкент"},"who":{"count":1},"contact":{"name":"Secret Person","phone":"+998911111111"}}'::jsonb);
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_changed'), 0, 'a pending edit notifies nobody yet');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_approve_order(:'oid');
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_changed' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'an approved edit notifies the recipients');

-- selected
insert into public.order_responses (order_id, model_id, version, status) values (:'oid', '00000000-0000-0000-0000-0000000000a1', 2, 'confirmed');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.select_models(:'oid', array['00000000-0000-0000-0000-0000000000a1']::uuid[]);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_finalize_selection(:'oid');
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_selected' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'finalizing notifies the selected model');

-- question answered
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.ask_question(:'oid', 'When?') as qid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_answer_question(:'qid', 'Tomorrow.');
reset role;
select is((select user_id::text from public.notifications where kind = 'question_answered'), '00000000-0000-0000-0000-0000000000b1', 'the asker is notified of the answer');

-- daily tasks
select is(public.notify_daily_tasks(), 2, 'daily reminders go to approved, non-blocked models');
select is(public.notify_daily_tasks(), 0, 'and only once a day');

-- visibility
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from public.notifications), 1, 'a model sees only its own notifications');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select cmp_ok((select count(*)::int from public.notifications), '>=', 4, 'the recipient sees its own');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select cmp_ok((select count(*)::int from public.notifications), '>=', 6, 'the admin sees all');

select * from finish();
rollback;
