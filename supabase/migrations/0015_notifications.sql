create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('order_new', 'order_changed', 'order_selected', 'question_answered', 'daily_task')),
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index notifications_unsent on public.notifications (created_at) where sent_at is null;
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
create policy notif_own on public.notifications for select using (user_id = auth.uid());
create policy notif_admin on public.notifications for select using (public.is_admin());
grant select on public.notifications to authenticated;

-- Localized texts. They never mention the client: models only learn that something needs their attention.
create function public.notif_text(p_kind text, p_lang text) returns table (title text, body text)
language sql immutable as $$
  select t.title, t.body
  from (values
    ('order_new', 'ru', 'Новый заказ', 'Для вас есть новый заказ. Откройте приложение, чтобы посмотреть.'),
    ('order_new', 'uz', 'Yangi buyurtma', 'Siz uchun yangi buyurtma bor. Ko‘rish uchun ilovani oching.'),
    ('order_new', 'en', 'New order', 'There is a new order for you. Open the app to take a look.'),
    ('order_changed', 'ru', 'Заказ изменён', 'Условия заказа изменились. Проверьте и подтвердите участие ещё раз.'),
    ('order_changed', 'uz', 'Buyurtma o‘zgardi', 'Buyurtma shartlari o‘zgardi. Tekshiring va ishtirokni qayta tasdiqlang.'),
    ('order_changed', 'en', 'Order changed', 'The order terms have changed. Please review and confirm again.'),
    ('order_selected', 'ru', 'Вы утверждены', 'Вас выбрали для заказа. Менеджер ZAYA свяжется с вами.'),
    ('order_selected', 'uz', 'Siz tasdiqlandingiz', 'Siz buyurtma uchun tanlandingiz. ZAYA menejeri siz bilan bog‘lanadi.'),
    ('order_selected', 'en', 'You are confirmed', 'You have been chosen for the order. A ZAYA manager will contact you.'),
    ('question_answered', 'ru', 'Ответ менеджера', 'Менеджер ZAYA ответил на ваш вопрос.'),
    ('question_answered', 'uz', 'Menejer javobi', 'ZAYA menejeri savolingizga javob berdi.'),
    ('question_answered', 'en', 'Manager''s reply', 'A ZAYA manager has answered your question.'),
    ('daily_task', 'ru', 'Задание на сегодня', 'Новые задания ждут вас в разделе «Развитие».'),
    ('daily_task', 'uz', 'Bugungi topshiriq', 'Yangi topshiriqlar «Rivojlanish» bo‘limida sizni kutmoqda.'),
    ('daily_task', 'en', 'Today''s task', 'New tasks are waiting for you in the Growth tab.')
  ) as t(kind, lang, title, body)
  where t.kind = p_kind and t.lang = case when p_lang in ('ru', 'uz', 'en') then p_lang else 'ru' end;
$$;

create function public.enqueue_notification(p_user uuid, p_kind text, p_data jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  lang text;
  blocked boolean;
begin
  select language, is_blocked into lang, blocked from public.profiles where id = p_user;
  if not found or blocked then return; end if;
  insert into public.notifications (user_id, kind, title, body, data)
  select p_user, p_kind, x.title, x.body, p_data from public.notif_text(p_kind, lang) x;
end;
$$;
revoke all on function public.enqueue_notification(uuid, text, jsonb) from public, anon, authenticated;

create function public.trg_notify_new_order() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.orders where id = new.order_id and status = 'open') then
    perform public.enqueue_notification(new.model_id, 'order_new', jsonb_build_object('order_id', new.order_id));
  end if;
  return new;
end;
$$;
create trigger notify_new_order after insert on public.order_recipients
  for each row execute function public.trg_notify_new_order();

create function public.trg_notify_order_changed() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if new.review_status = 'approved' and new.version > 1
     and (tg_op = 'INSERT' or old.review_status is distinct from 'approved') then
    for r in select model_id from public.order_recipients where order_id = new.order_id loop
      perform public.enqueue_notification(r.model_id, 'order_changed', jsonb_build_object('order_id', new.order_id));
    end loop;
  end if;
  return new;
end;
$$;
create trigger notify_order_changed after insert or update of review_status on public.order_versions
  for each row execute function public.trg_notify_order_changed();

create function public.trg_notify_selected() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.finalized and not old.finalized then
    perform public.enqueue_notification(new.model_id, 'order_selected', jsonb_build_object('order_id', new.order_id));
  end if;
  return new;
end;
$$;
create trigger notify_selected after update of finalized on public.order_selections
  for each row execute function public.trg_notify_selected();

create function public.trg_notify_answer() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.answer is not null and old.answer is distinct from new.answer then
    perform public.enqueue_notification(new.author_id, 'question_answered', jsonb_build_object('question_id', new.id, 'order_id', new.order_id));
  end if;
  return new;
end;
$$;
create trigger notify_answer after update of answer on public.questions
  for each row execute function public.trg_notify_answer();

-- Run once a day (pg_cron): reminds approved models who have open tasks or have not got today's tasks yet.
create function public.notify_daily_tasks() returns int language plpgsql security definer set search_path = public as $$
declare
  today date := public.tashkent_today();
  m record;
  n int := 0;
begin
  for m in
    select mp.id from public.model_profiles mp join public.profiles p on p.id = mp.id
    where mp.status = 'approved' and not p.is_blocked
      and not exists (select 1 from public.notifications x where x.user_id = mp.id and x.kind = 'daily_task'
                      and (x.created_at at time zone 'Asia/Tashkent')::date = today)
      and (not exists (select 1 from public.dev_task_assignments a where a.model_id = mp.id and a.assigned_on = today)
           or exists (select 1 from public.dev_task_assignments a where a.model_id = mp.id and a.assigned_on = today and a.completed_at is null))
  loop
    perform public.enqueue_notification(m.id, 'daily_task', '{}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.notify_daily_tasks() from public, anon, authenticated;
