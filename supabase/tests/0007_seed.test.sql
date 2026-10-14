begin;
select plan(6);

select cmp_ok((select count(*)::int from public.dev_tasks where is_active), '>=', 30, 'at least 30 active development tasks are seeded');
select is((select count(*)::int from public.dev_tasks
           where coalesce(btrim(title->>'ru'), '') = '' or points not between 1 and 10), 0, 'every task has a Russian title and 1..10 points');
select is((select count(*)::int from public.ranks), 4, 'four ranks');
select is((select array_agg(min_points order by id) from public.ranks), array[0, 100, 300, 700], 'rank thresholds ascend 0/100/300/700');
select is((select array_agg(code order by code) from public.badges),
          array['first_task', 'full_week', 'streak_14', 'streak_3', 'streak_30', 'streak_7'], 'the six badges exist');

create temp table before_count as select count(*)::int n from public.dev_tasks;
\ir ../seed/dev_content.sql
select is((select count(*)::int from public.dev_tasks), (select n from before_count), 're-applying the seed adds nothing');

select * from finish();
rollback;
