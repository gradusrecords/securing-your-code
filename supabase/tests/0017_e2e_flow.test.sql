-- End-to-end: the whole product flow through the same entry points the apps use.
begin;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'aziza@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'dilnoza@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'biz@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'boss@x', '{"role":"business"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
update public.dev_tasks set is_active = false;
insert into public.dev_tasks (title, description, points) select jsonb_build_object('ru', 'task ' || g), '{}', 5 from generate_series(1, 5) g;

-- 1. profiles: models and the business fill in their cards like the apps do
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$insert into public.model_profiles (id, full_name, display_name, birth_date, gender, city, phone, telegram, height_cm, experience, directions, photos)
  values ('00000000-0000-0000-0000-0000000000a1', 'Aziza Legal', 'Aziza', '2000-05-20', 'female', 'Ташкент', '+998901111111', '@aziza', 175, 'none', '{photo,show}', '{a1/1.jpg}')$$, 'model 1 submits a card');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select lives_ok($$insert into public.model_profiles (id, full_name, display_name, birth_date, gender, city, phone, telegram, height_cm, experience, directions, photos)
  values ('00000000-0000-0000-0000-0000000000a2', 'Dilnoza Legal', 'Dilnoza', '2001-03-03', 'female', 'Ташкент', '+998902222222', '@dilnoza', 170, 'none', '{photo}', '{a2/1.jpg}')$$, 'model 2 submits a card');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select lives_ok($$insert into public.business_profiles (id, full_name, company, phone) values ('00000000-0000-0000-0000-0000000000b1', 'Biz Owner', 'Secret Brand', '+998903333333')$$, 'the business fills in its profile');
select is((select count(*)::int from public.public_model_cards), 0, 'pending cards are not in the catalog');

-- 2. admin approves and publishes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.review_model('00000000-0000-0000-0000-0000000000a1', 'approved', null);
select public.review_model('00000000-0000-0000-0000-0000000000a2', 'approved', null);
insert into public.catalog_entries (model_id, agency_rating, is_published) values
  ('00000000-0000-0000-0000-0000000000a1', 10, true), ('00000000-0000-0000-0000-0000000000a2', 9, true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from public.public_model_cards), 2, 'the business now sees both models in the catalog');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'public_model_cards' and column_name in ('phone','telegram','instagram','birth_date','full_name')), 0, 'the catalog exposes no contacts');

-- 3. order: create, review, send
select public.create_order('{"project":{"title":"Autumn campaign","type":"photo"},"when_where":{"date":"2026-12-01","city":"Ташкент"},"who":{"count":1,"gender":"female"},"contact":{"name":"Biz Owner","phone":"+998903333333"}}') as oid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select is((select model_id::text from public.admin_suggest_recipients(:'oid') limit 1), '00000000-0000-0000-0000-0000000000a1', 'the admin gets a sensible suggestion');
select public.admin_approve_order(:'oid', array['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2']::uuid[]);
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_new'), 2, 'both recipients get a push notification');

-- 4. models respond
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select ok((select (brief -> 'contact') is null and to_jsonb(c)::text not like '%Secret Brand%' from public.model_order_cards c), 'the model sees the brief without the client or contacts');
select public.respond_to_order(:'oid', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select public.respond_to_order(:'oid', false);

-- 5. business selects, admin finalizes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from public.order_confirmed_models), 1, 'the business sees exactly the confirmed model');
select throws_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a2'']::uuid[])', null, null, 'a model who declined cannot be picked');
select lives_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', 'the business picks the confirmed model');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_finalize_selection(:'oid');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select throws_ok('select public.update_order(''' || :'oid' || ''', ''{}'')', null, null, 'a selected order can no longer be edited');
reset role;
select is((select count(*)::int from public.notifications where kind = 'order_selected' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'the picked model is told it is confirmed');

-- 6. question and answer
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select public.ask_question(:'oid', 'Where is the studio?') as qid \gset
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_answer_question(:'qid', 'Amir Temur 1.');
reset role;
select is((select count(*)::int from public.notifications where kind = 'question_answered' and user_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'the model is notified of the answer');

-- 7. growth tab
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.get_today_tasks()), 3, 'the model gets three daily tasks');
select is((public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1))->>'streak')::int, 1, 'completing a task starts a streak');

-- 8. finish
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_complete_order(:'oid');
select is((select count(*)::int from public.audit_log where target_id = :'oid'), 3, 'approve, finalize and complete are all in the audit log');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select status from public.model_order_cards), 'completed', 'the model sees the order as completed');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select status from public.business_orders), 'completed', 'the business sees the order as completed');

select * from finish();
rollback;
