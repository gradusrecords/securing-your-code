begin;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'm@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'n@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'u@x', '{"role":"model"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x', '{"role":"business"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'a@x', '{"role":"business"}');
update public.profiles set role='admin' where id='00000000-0000-0000-0000-0000000000c1';
insert into public.model_profiles (id, full_name, birth_date, gender, phone, telegram, height_cm, experience, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'M', '2000-01-01', 'female', '+998900000001', '@m', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a2', 'N', '2000-01-01', 'female', '+998900000002', '@n', 170, '0', 'approved'),
  ('00000000-0000-0000-0000-0000000000a3', 'U', '2000-01-01', 'female', '+998900000003', '@u', 170, '0', 'pending');
-- seeded starter content must not interfere with this test's own fixture
update public.dev_tasks set is_active = false;
insert into public.dev_tasks (title, description, points)
  select jsonb_build_object('ru', 'task ' || g), '{}'::jsonb, 5 from generate_series(1, 12) g;

select is(public.tashkent_today(), (now() at time zone 'Asia/Tashkent')::date, 'without override the day boundary is Tashkent midnight');

-- model M, Tashkent-day overrides
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('zaya.today_override', '2026-01-01', true);

select is((select count(*)::int from public.get_today_tasks()), 3, 'model gets 3 tasks for the day');
select is((select count(distinct j->>'assignment_id')::int from (select * from public.get_today_tasks() union select * from public.get_today_tasks()) x(j)), 3, 'second call the same day returns the same 3');

select is((select (public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1)))->>'points_awarded')::int, 5, 'completing awards the task points');
select is((select (public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1)))->>'total_points')::int, 5, 'completing again awards nothing more');
select ok((select (public.my_progress()->'badges') @> '"first_task"'::jsonb), 'first_task badge earned');

-- second task same day: streak stays 1
select is((select (public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' offset 1 limit 1)))->>'streak')::int, 1, 'two completions on one day count as streak 1');

-- consecutive days
select set_config('zaya.today_override', '2026-01-02', true);
select lives_ok($$select public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1))$$, 'day 2 completion');
select set_config('zaya.today_override', '2026-01-03', true);
select is((select (public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1)))->>'streak')::int, 3, 'three consecutive days make streak 3');
select ok((select (public.my_progress()->'badges') @> '"streak_3"'::jsonb), 'streak_3 badge earned');

-- skipped day resets
select set_config('zaya.today_override', '2026-01-05', true);
select is((select (public.complete_task((select (j->>'assignment_id')::uuid from public.get_today_tasks() j order by j->>'assignment_id' limit 1)))->>'streak')::int, 1, 'a skipped day resets the streak to 1');

-- rank crossing 100 points
reset role;
update public.dev_task_assignments set points_awarded = 120
  where id = (select id from public.dev_task_assignments where model_id='00000000-0000-0000-0000-0000000000a1' and completed_at is not null limit 1);
select id as mid from public.dev_task_assignments where model_id='00000000-0000-0000-0000-0000000000a1' limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select is((public.my_progress()->'rank'->>'id')::int, 2, 'rank rises after 100 points');

-- another model cannot complete M's assignment
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
select throws_ok('select public.complete_task(''' || :'mid' || ''')', null, null, 'cannot complete another model''s assignment');

-- unapproved model and business get nothing
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
select is((select count(*)::int from public.get_today_tasks()), 0, 'unapproved model gets no tasks');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select is((select count(*)::int from public.get_today_tasks()), 0, 'business gets no tasks');

-- permissions on content tables
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select throws_ok($$insert into public.dev_tasks (title, points) values ('{"ru":"x"}', 1)$$, null, null, 'model cannot write dev_tasks');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select lives_ok($$insert into public.dev_tasks (title, points) values ('{"ru":"admin task"}', 3)$$, 'admin writes dev_tasks');

select * from finish();
rollback;
