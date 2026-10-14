begin;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'blocked-admin@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'm3@x', '{"role":"model"}');
update public.profiles set role = 'admin' where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');
update public.profiles set is_blocked = true where id = '00000000-0000-0000-0000-0000000000c2';
insert into public.business_profiles (id, full_name, company, phone) values ('00000000-0000-0000-0000-0000000000b1', 'Biz', 'Co', '+998911111111');
insert into public.model_profiles (id, full_name, birth_date, gender, city, phone, telegram, height_cm, experience, directions, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M1', '2000-01-01', 'female', 'Ташкент', '+998900000001', '@m1', 170, '0', '{photo,ad}', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'M2', '2000-01-01', 'male', 'Самарканд', '+998900000002', '@m2', 180, '0', '{show}', 'approved'),
  ('00000000-0000-0000-0000-0000000000a3', 'M3', '2000-01-01', 'female', 'Ташкент', '+998900000003', '@m3', 170, '0', '{photo}', 'pending');

-- the business creates an order
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.create_order('{"project":{"title":"Shoot","type":"photo"},"when_where":{"date":"2026-12-01","city":"Ташкент"},"who":{"count":1,"gender":"female"},"contact":{"name":"B","phone":"+998911111111"}}') as oid \gset

-- non-admins are refused everywhere
select throws_ok('select public.admin_approve_order(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', null, null, 'business cannot approve orders');
select throws_ok('select * from public.admin_suggest_recipients(''' || :'oid' || ''')', null, null, 'business cannot get suggestions');
select is((select count(*)::int from public.admin_orders), 0, 'business sees no admin_orders');
select is((select count(*)::int from public.audit_log), 0, 'business reads no audit log');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok('select public.admin_cancel_order(''' || :'oid' || ''')', null, null, 'model cannot cancel via admin');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
select throws_ok('select public.admin_return_order(''' || :'oid' || ''', ''x'')', null, null, 'blocked admin is refused');

-- admin
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select is((select count(*)::int from public.admin_orders where status = 'in_review'), 1, 'admin sees the order in review');
select is((select model_id::text from public.admin_suggest_recipients(:'oid') limit 1), '00000000-0000-0000-0000-0000000000a1', 'the matching model is suggested first');
select is((select count(*)::int from public.admin_suggest_recipients(:'oid') where model_id = '00000000-0000-0000-0000-0000000000a3'), 0, 'unapproved models are never suggested');
select throws_ok('select public.admin_approve_order(''' || :'oid' || ''')', null, null, 'first approval needs recipients');
select throws_ok('select public.admin_approve_order(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a3'']::uuid[])', null, null, 'an unapproved model cannot be a recipient');
select lives_ok('select public.admin_approve_order(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', 'admin approves and sends the order');
select is((select status from public.admin_orders where order_id = :'oid'), 'open', 'the order is open');
select lives_ok('select public.admin_approve_order(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', 'approving again is harmless');
reset role;
select is((select count(*)::int from public.order_recipients where order_id = :'oid'), 1, 'recipients are not duplicated');
select cmp_ok((select count(*)::int from public.audit_log where target_id = :'oid'), '>=', 1, 'approval is audited');

-- model confirms, business selects, admin finalizes
insert into public.order_responses (order_id, model_id, version, status) values (:'oid', '00000000-0000-0000-0000-0000000000a1', 1, 'confirmed');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select throws_ok('select public.admin_finalize_selection(''' || :'oid' || ''')', null, null, 'cannot finalize before the business selects');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.select_models(:'oid', array['00000000-0000-0000-0000-0000000000a1']::uuid[]);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select lives_ok('select public.admin_finalize_selection(''' || :'oid' || ''')', 'admin finalizes the selection');
select is((select finalized_count from public.admin_orders where order_id = :'oid'), 1, 'one finalized model');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select throws_ok('select public.select_models(''' || :'oid' || ''', array[''00000000-0000-0000-0000-0000000000a1'']::uuid[])', null, null, 'the business cannot change a finalized selection');

-- version 2: edit, return, edit again, approve resets confirmations
reset role;
update public.orders set status = 'open' where id = :'oid';
update public.order_selections set finalized = false where order_id = :'oid';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.update_order(:'oid', '{"project":{"title":"Shoot v2","type":"photo"},"when_where":{"date":"2026-12-05","city":"Ташкент"},"who":{"count":1},"contact":{"name":"B","phone":"+998911111111"}}'::jsonb);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select lives_ok('select public.admin_return_order(''' || :'oid' || ''', ''Specify the address'')', 'admin returns the edit with a comment');
select is((select review_comment from public.order_versions where order_id = :'oid' and version = 2), 'Specify the address', 'the comment is stored');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select public.update_order(:'oid', '{"project":{"title":"Shoot v2","type":"photo"},"when_where":{"date":"2026-12-05","city":"Ташкент","address":"Amir Temur 1"},"who":{"count":1},"contact":{"name":"B","phone":"+998911111111"}}'::jsonb);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select public.admin_approve_order(:'oid');
reset role;
select is((select status::text from public.order_responses where order_id = :'oid'), 'needs_reconfirm', 'approving version 2 resets confirmations');

select * from finish();
rollback;
