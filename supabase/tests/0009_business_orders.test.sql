begin;
select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b1@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'b2@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}');
insert into public.business_profiles (id, full_name, company, phone) values
  ('00000000-0000-0000-0000-0000000000b1', 'Biz One', 'Co One', '+998911111111'),
  ('00000000-0000-0000-0000-0000000000b2', 'Biz Two', 'Co Two', '+998922222222');
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Secret Legal One', '2000-01-01', 'female', '+998900000001', '@m1', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'Secret Legal Two', '2000-01-01', 'female', '+998900000002', '@m2', 170, '0', 'approved');
update public.model_profiles set display_name = 'Aziza' where id = '00000000-0000-0000-0000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok($$select public.create_order('{}')$$, null, null, 'a model cannot create orders');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select throws_ok($$select public.create_order('{"project":{"type":"photo"},"when_where":{"date":"2026-12-01","city":"Tashkent"},"who":{"count":2},"contact":{"name":"B","phone":"+998911111111"}}')$$, null, null, 'brief without a title is rejected');
select throws_ok($$select public.create_order('{"project":{"title":"T","type":"photo"},"when_where":{"date":"2026-12-01","city":"Tashkent"},"who":{"count":0},"contact":{"name":"B","phone":"+998911111111"}}')$$, null, null, 'brief with zero models is rejected');

select public.create_order('{"project":{"title":"Shoot","type":"photo"},"when_where":{"date":"2026-12-01","city":"Tashkent"},"who":{"count":2},"conditions":{"meals":true},"contact":{"name":"B","phone":"+998911111111"}}') as oid \gset
select is((select status from public.business_orders where order_id = :'oid'), 'in_review', 'a new order goes to review');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
select is((select count(*)::int from public.business_orders), 0, 'another business sees no orders');
select throws_ok('select public.update_order(''' || :'oid' || ''', ''{}'')', null, null, 'another business cannot update');
select throws_ok('select public.cancel_order(''' || :'oid' || ''')', null, null, 'another business cannot cancel');
select throws_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', null, null, 'another business cannot select models');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.update_order(:'oid', '{"project":{"title":"Shoot 2","type":"photo"},"when_where":{"date":"2026-12-01","city":"Tashkent"},"who":{"count":2},"contact":{"name":"B","phone":"+998911111111"}}'::jsonb);
reset role;
select is((select count(*)::int from public.order_versions where order_id = :'oid'), 1, 'editing an order in review changes the draft in place');

-- admin opens the order: v1 approved, two recipients, M1 confirmed, M2 declined
update public.order_versions set review_status = 'approved' where order_id = :'oid' and version = 1;
update public.orders set status = 'open' where id = :'oid';
insert into public.order_recipients (order_id, model_id) values
  (:'oid', '00000000-0000-0000-0000-0000000000a1'), (:'oid', '00000000-0000-0000-0000-0000000000a2');
insert into public.order_responses (order_id, model_id, version, status) values
  (:'oid', '00000000-0000-0000-0000-0000000000a1', 1, 'confirmed'),
  (:'oid', '00000000-0000-0000-0000-0000000000a2', 1, 'declined');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is(public.update_order(:'oid', '{"project":{"title":"Shoot 3","type":"photo"},"when_where":{"date":"2026-12-02","city":"Tashkent"},"who":{"count":2},"contact":{"name":"B","phone":"+998000000000"}}'::jsonb), 2, 'editing an open order creates version 2');
reset role;
select is((select review_status::text from public.order_versions where order_id = :'oid' and version = 2), 'pending', 'version 2 waits for review');
select ok((select changes is not null and changes::text not like '%contact%' and changes::text like '%when_where.date%' from public.order_versions where order_id = :'oid' and version = 2), 'changes list the edits but never the contact section');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select version from public.model_order_cards), 1, 'the model still sees version 1');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select pending_version from public.business_orders where order_id = :'oid'), 2, 'the owner sees the pending version');
select throws_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a2'']::uuid[])', null, null, 'a model who declined cannot be selected');
select lives_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', 'a confirmed model can be selected');
select is((select is_selected from public.order_confirmed_models where model_id = '00000000-0000-0000-0000-0000000000a1'), true, 'selection is visible');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'order_confirmed_models'
  and column_name in ('phone', 'telegram', 'instagram', 'birth_date', 'parent_contact', 'full_name')), 0, 'confirmed models expose no contacts or legal name');
select is((select count(*)::int from public.orders) + (select count(*)::int from public.order_versions) + (select count(*)::int from public.order_responses), 0, 'no direct table access for business');
select ok((select public.ask_question(:'oid', 'When do we get the photos?')) is not null, 'the owner asks the manager');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
select throws_ok('select public.ask_question(''' || :'oid' || ''', ''spy'')', null, null, 'another business cannot ask about this order');

select * from finish();
rollback;
