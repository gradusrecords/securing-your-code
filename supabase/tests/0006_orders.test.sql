begin;
select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'n@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'u@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'x@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x', '{"role":"business"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1';
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M', '2000-01-01', 'female', '+998900000001', '@m', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'N', '2000-01-01', 'female', '+998900000002', '@n', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a3', 'U', '2000-01-01', 'female', '+998900000003', '@u', 170, '0', 'pending');
insert into public.business_profiles (id, full_name, company, phone) values
  ('00000000-0000-0000-0000-0000000000b1', 'Biz One', 'Co One Secret', '+998911111111'),
  ('00000000-0000-0000-0000-0000000000b2', 'Biz Two', 'Co Two', '+998922222222');
insert into public.orders (id, business_id, status, current_version) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000b1', 'open', 1);
insert into public.order_versions (order_id, version, brief, review_status) values
  ('00000000-0000-0000-0000-00000000f001', 1,
   '{"project":{"title":"Shoot"},"when_where":{"city":"Tashkent"},"who":{"count":2},"conditions":{"meals":true},"requirements":{"dresscode":"black"},"contact":{"name":"Secret Person","phone":"+998000"}}',
   'approved');
insert into public.order_recipients (order_id, model_id) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-0000000000a3');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.model_order_cards), 1, 'recipient model sees the order');
select is((select brief->'contact' from public.model_order_cards), null, 'brief has no contact section');
select ok((select to_jsonb(c)::text not like '%Secret%' and to_jsonb(c)::text not like '%0000000000b1%' from public.model_order_cards c), 'no company name or business id leaks into the card');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from public.model_order_cards), 0, 'non-recipient model sees nothing');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
select is((select count(*)::int from public.model_order_cards), 0, 'unapproved model sees nothing');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from public.model_order_cards), 0, 'the owner business cannot use the model view');
select is((select count(*)::int from public.order_responses), 0, 'business cannot read responses directly');

-- responses
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lives_ok($$select public.respond_to_order('00000000-0000-0000-0000-00000000f001', true)$$, 'model confirms');
select is((select my_response from public.model_order_cards), 'confirmed', 'response is confirmed');
select lives_ok($$select public.respond_to_order('00000000-0000-0000-0000-00000000f001', false)$$, 'model changes mind');
reset role;
select is((select count(*)::int from public.order_responses where order_id='00000000-0000-0000-0000-00000000f001' and model_id='00000000-0000-0000-0000-0000000000a1'), 1, 're-answering updates, not duplicates');
select is((select status::text from public.order_responses where model_id='00000000-0000-0000-0000-0000000000a1'), 'declined', 'last answer wins');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select throws_ok($$select public.respond_to_order('00000000-0000-0000-0000-00000000f001', true)$$, null, null, 'non-recipient cannot respond');

-- order changed: version 2 approved resets confirmed answers
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select public.respond_to_order('00000000-0000-0000-0000-00000000f001', true);
reset role;
update public.orders set current_version = 2 where id = '00000000-0000-0000-0000-00000000f001';
insert into public.order_versions (order_id, version, brief, review_status, changes) values
  ('00000000-0000-0000-0000-00000000f001', 2, '{"project":{"title":"Shoot v2"},"contact":{"name":"Secret Person"}}', 'approved', '{"project.title":"changed"}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select my_response from public.model_order_cards), 'needs_reconfirm', 'confirmation resets to needs_reconfirm on a new version');
select is((select updated_flag from public.model_order_cards), true, 'card is flagged as updated');
select lives_ok($$select public.respond_to_order('00000000-0000-0000-0000-00000000f001', true)$$, 're-confirm the new version');
select is((select updated_flag from public.model_order_cards), false, 'flag clears after re-confirming');

-- questions
select throws_ok($$select public.ask_question('00000000-0000-0000-0000-00000000f001', '   ')$$, null, null, 'empty question rejected');
select ok((select public.ask_question('00000000-0000-0000-0000-00000000f001', 'Is parking available?')) is not null, 'model asks the manager a question');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select is((select count(*)::int from public.questions), 0, 'another model cannot read the question');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select is((select count(*)::int from public.questions), 1, 'admin reads the question');
select lives_ok($$update public.questions set answer='Yes', answered_at=now()$$, 'admin answers the question');

select * from finish();
rollback;
