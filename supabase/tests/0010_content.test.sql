begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x', '{"role":"business"}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.content_items (id, kind, title, body, is_published) values
  ('00000000-0000-0000-0000-00000000c001', 'pr', '{"ru":"hidden"}', '{"ru":"x"}', false);

select cmp_ok((select count(*)::int from public.content_items where is_published), '>=', 17, 'at least 17 published ideas are seeded');
select is((select count(distinct kind)::int from public.content_items where is_published), 3, 'all three kinds are present');
select is((select count(*)::int from public.content_items where is_published and (coalesce(btrim(title->>'ru'), '') = '' or coalesce(btrim(body->>'ru'), '') = '')), 0, 'every published item has Russian text');

select is((select count(*)::int from public.content_items where is_published
           and (coalesce(btrim(title->>'uz'), '') = '' or coalesce(btrim(title->>'en'), '') = ''
             or coalesce(btrim(body->>'uz'), '') = '' or coalesce(btrim(body->>'en'), '') = '')), 0, 'every published idea is translated into Uzbek and English');

create temp table c0 as select count(*)::int n from public.content_items;
\ir ../seed/ideas_content.sql
select is((select count(*)::int from public.content_items), (select n from c0), 're-applying the seed adds nothing');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select cmp_ok((select count(*)::int from public.content_items), '>=', 17, 'business reads published ideas');
select is((select count(*)::int from public.content_items where title->>'ru' = 'hidden'), 0, 'business does not read unpublished ideas');
select throws_ok($$insert into public.content_items (kind, title, body) values ('pr', '{"ru":"x"}', '{"ru":"y"}')$$, null, null, 'business cannot write ideas');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((select count(*)::int from public.content_items), 0, 'a model reads no ideas');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select lives_ok($$insert into public.content_items (kind, title, body) values ('pr', '{"ru":"x"}', '{"ru":"y"}')$$, 'admin writes ideas');

select * from finish();
rollback;
