begin;
select plan(3);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}');
insert into public.business_profiles (id, full_name, phone) values ('00000000-0000-0000-0000-0000000000b1', 'B', '+998911111111');
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M', '2000-01-01', 'female', '+998900000001', '@m', 170, '0', 'approved');
insert into public.orders (id, business_id, status) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1', 'open');
insert into public.order_versions (order_id, version, brief, review_status) values
  ('00000000-0000-0000-0000-00000000f001', 1, '{"project":{"title":"T"}}', 'approved');
insert into public.order_recipients (order_id, model_id) values ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select lives_ok($$select public.cancel_order('00000000-0000-0000-0000-00000000f001')$$, 'the owner cancels an open order');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select status from public.model_order_cards), 'cancelled', 'the recipient model still sees the order, marked cancelled');
select throws_ok($$select public.respond_to_order('00000000-0000-0000-0000-00000000f001', true)$$, null, null, 'a cancelled order cannot be answered');

select * from finish();
rollback;
