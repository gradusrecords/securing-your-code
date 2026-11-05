create table public.dev_tasks (
  id uuid primary key default gen_random_uuid(),
  title jsonb not null,
  description jsonb not null default '{}'::jsonb,
  points smallint not null check (points between 1 and 10),
  is_active boolean not null default true
);

create table public.dev_task_assignments (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.model_profiles (id) on delete cascade,
  task_id uuid not null references public.dev_tasks (id),
  assigned_on date not null,
  completed_at timestamptz,
  completed_on date,
  points_awarded smallint,
  unique (model_id, task_id, assigned_on)
);

create table public.ranks (
  id smallint primary key,
  name jsonb not null,
  min_points int not null
);
insert into public.ranks (id, name, min_points) values
  (1, '{"ru":"Новичок","uz":"Yangi boshlovchi","en":"Newcomer"}', 0),
  (2, '{"ru":"Восходящая звезда","uz":"Ko‘tarilayotgan yulduz","en":"Rising star"}', 100),
  (3, '{"ru":"Лицо ZAYA","uz":"ZAYA yuzi","en":"Face of ZAYA"}', 300),
  (4, '{"ru":"Икона ZAYA","uz":"ZAYA ikonasi","en":"ZAYA icon"}', 700);

create table public.badges (
  code text primary key,
  name jsonb not null
);
insert into public.badges (code, name) values
  ('first_task', '{"ru":"Первое задание","uz":"Birinchi topshiriq","en":"First task"}'),
  ('streak_3', '{"ru":"3 дня подряд","uz":"Ketma-ket 3 kun","en":"3-day streak"}'),
  ('streak_7', '{"ru":"7 дней подряд","uz":"Ketma-ket 7 kun","en":"7-day streak"}'),
  ('streak_14', '{"ru":"14 дней подряд","uz":"Ketma-ket 14 kun","en":"14-day streak"}'),
  ('streak_30', '{"ru":"30 дней подряд","uz":"Ketma-ket 30 kun","en":"30-day streak"}'),
  ('full_week', '{"ru":"Полная неделя","uz":"To‘liq hafta","en":"Full week"}');

create table public.user_badges (
  model_id uuid not null references public.model_profiles (id) on delete cascade,
  badge_code text not null references public.badges (code),
  earned_on date not null,
  primary key (model_id, badge_code)
);

alter table public.dev_tasks enable row level security;
alter table public.dev_task_assignments enable row level security;
alter table public.ranks enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
revoke all on public.dev_tasks, public.dev_task_assignments, public.ranks, public.badges, public.user_badges from anon, authenticated;

create policy dt_read on public.dev_tasks for select using (public.my_role() = 'model' and is_active);
create policy dt_admin on public.dev_tasks for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.dev_tasks to authenticated;

create policy dta_own on public.dev_task_assignments for select using (model_id = auth.uid() and public.my_role() = 'model');
create policy dta_admin on public.dev_task_assignments for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.dev_task_assignments to authenticated;

create policy rk_read on public.ranks for select using (public.my_role() is not null);
create policy rk_admin on public.ranks for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.ranks to authenticated;

create policy bd_read on public.badges for select using (public.my_role() is not null);
create policy bd_admin on public.badges for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.badges to authenticated;

create policy ub_own on public.user_badges for select using (model_id = auth.uid() and public.my_role() = 'model');
create policy ub_admin on public.user_badges for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.user_badges to authenticated;

-- Day boundary is Tashkent midnight; zaya.today_override exists only for tests.
create function public.tashkent_today() returns date language sql stable as $$
  select coalesce(nullif(current_setting('zaya.today_override', true), '')::date,
                  (now() at time zone 'Asia/Tashkent')::date)
$$;

create function public.is_approved_model() returns boolean language sql stable security definer set search_path = public as $$
  select public.my_role() = 'model'
     and exists (select 1 from public.model_profiles where id = auth.uid() and status = 'approved');
$$;

create function public.calc_streak(p_model uuid, p_today date) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  d date := p_today;
  n int := 0;
begin
  if not exists (select 1 from public.dev_task_assignments where model_id = p_model and completed_on = d) then
    d := p_today - 1;
  end if;
  while exists (select 1 from public.dev_task_assignments where model_id = p_model and completed_on = d) loop
    n := n + 1;
    d := d - 1;
  end loop;
  return n;
end;
$$;

create function public.get_today_tasks() returns setof jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public.tashkent_today();
begin
  if not public.is_approved_model() then return; end if;
  if not exists (select 1 from public.dev_task_assignments where model_id = uid and assigned_on = today) then
    insert into public.dev_task_assignments (model_id, task_id, assigned_on)
    select uid, t.id, today from public.dev_tasks t
    where t.is_active and not exists (
      select 1 from public.dev_task_assignments a
      where a.model_id = uid and a.task_id = t.id and a.assigned_on > today - 14)
    order by random() limit 3;
  end if;
  return query
    select jsonb_build_object('assignment_id', a.id, 'title', t.title, 'description', t.description,
                              'points', t.points, 'completed', a.completed_at is not null)
    from public.dev_task_assignments a join public.dev_tasks t on t.id = a.task_id
    where a.model_id = uid and a.assigned_on = today
    order by a.id;
end;
$$;

create function public.complete_task(p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public.tashkent_today();
  a public.dev_task_assignments;
  pts smallint;
  total int;
  streak int;
  new_badges text[] := '{}';
  th int;
  code text;
  got boolean;
begin
  if not public.is_approved_model() then raise exception 'not allowed'; end if;
  select * into a from public.dev_task_assignments where id = p_assignment_id and model_id = uid for update;
  if not found then raise exception 'not your assignment'; end if;
  if a.completed_at is null then
    select points into pts from public.dev_tasks where id = a.task_id;
    update public.dev_task_assignments
      set completed_at = now(), completed_on = today, points_awarded = pts
      where id = a.id returning * into a;
  end if;

  streak := public.calc_streak(uid, today);
  select coalesce(sum(points_awarded), 0) into total from public.dev_task_assignments where model_id = uid;

  insert into public.user_badges (model_id, badge_code, earned_on) values (uid, 'first_task', today)
    on conflict do nothing returning true into got;
  if got then new_badges := array_append(new_badges, 'first_task'); end if;

  foreach th in array array[3, 7, 14, 30] loop
    if streak >= th then
      code := 'streak_' || th;
      got := null;
      insert into public.user_badges (model_id, badge_code, earned_on) values (uid, code, today)
        on conflict do nothing returning true into got;
      if got then new_badges := array_append(new_badges, code); end if;
    end if;
  end loop;

  -- full_week: every assigned task done on each of the last 7 days
  if not exists (
    select 1 from generate_series(today - 6, today, interval '1 day') g(day)
    where not exists (select 1 from public.dev_task_assignments x where x.model_id = uid and x.assigned_on = g.day::date)
       or exists (select 1 from public.dev_task_assignments x where x.model_id = uid and x.assigned_on = g.day::date and x.completed_at is null)
  ) then
    got := null;
    insert into public.user_badges (model_id, badge_code, earned_on) values (uid, 'full_week', today)
      on conflict do nothing returning true into got;
    if got then new_badges := array_append(new_badges, 'full_week'); end if;
  end if;

  return jsonb_build_object('points_awarded', a.points_awarded, 'total_points', total,
                            'streak', streak, 'new_badges', to_jsonb(new_badges));
end;
$$;

create function public.my_progress() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  total int;
  r public.ranks;
  nxt int;
begin
  if not public.is_approved_model() then raise exception 'not allowed'; end if;
  select coalesce(sum(points_awarded), 0) into total from public.dev_task_assignments where model_id = uid;
  select * into r from public.ranks where min_points <= total order by min_points desc limit 1;
  select min(min_points) into nxt from public.ranks where min_points > total;
  return jsonb_build_object(
    'total_points', total,
    'rank', jsonb_build_object('id', r.id, 'name', r.name),
    'next_rank_points', nxt,
    'streak', public.calc_streak(uid, public.tashkent_today()),
    'badges', coalesce((select jsonb_agg(badge_code order by earned_on, badge_code) from public.user_badges where model_id = uid), '[]'::jsonb));
end;
$$;

revoke all on function public.get_today_tasks(), public.complete_task(uuid), public.my_progress(),
  public.calc_streak(uuid, date), public.is_approved_model() from public, anon;
grant execute on function public.get_today_tasks(), public.complete_task(uuid), public.my_progress(),
  public.is_approved_model() to authenticated;
