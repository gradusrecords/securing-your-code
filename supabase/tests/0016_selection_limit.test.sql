begin;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm1@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'm2@x', '{"role":"model"}');
insert into public.business_profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000b1', 'B', '+998911111111');
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M1', '2000-01-01', 'female', '+998900000001', '@1', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'M2', '2000-01-01', 'female', '+998900000002', '@2', 170, '0', 'approved');
insert into public.orders (id, business_id, status) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1', 'open');
insert into public.order_versions (order_id, version, brief, review_status) values
  ('00000000-0000-0000-0000-00000000f001', 1, '{"project":{"title":"T","type":"photo"},"who":{"count":1}}', 'approved');
insert into public.order_recipients (order_id, model_id) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a2');
insert into public.order_responses (order_id, model_id, version, status) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1', 1, 'confirmed'),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a2', 1, 'confirmed');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select throws_ok($$select public.select_models('00000000-0000-0000-0000-00000000f001', array['00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2']::uuid[])$$, null, null, 'selecting more models than requested is rejected');
select lives_ok($$select public.select_models('00000000-0000-0000-0000-00000000f001', array['00000000-0000-0000-0000-0000000000a1']::uuid[])$$, 'selecting exactly the requested number works');
select is((select selected_count from public.business_orders), 1, 'one model is selected');
select lives_ok($$select public.select_models('00000000-0000-0000-0000-00000000f001', array['00000000-0000-0000-0000-0000000000a2']::uuid[])$$, 'the business can swap its pick before finalization');
select is((select model_id::text from public.order_confirmed_models where is_selected), '00000000-0000-0000-0000-0000000000a2', 'the swap took effect');

select * from finish();
rollback;
