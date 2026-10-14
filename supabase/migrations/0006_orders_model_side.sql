create type public.order_status as enum ('draft', 'in_review', 'open', 'selected', 'completed', 'cancelled');
create type public.response_status as enum ('confirmed', 'declined', 'needs_reconfirm');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id),
  status public.order_status not null default 'draft',
  current_version int not null default 1,
  created_at timestamptz not null default now()
);

create table public.order_versions (
  order_id uuid not null references public.orders (id) on delete cascade,
  version int not null,
  brief jsonb not null,
  review_status public.review_status not null default 'pending',
  changes jsonb,
  primary key (order_id, version)
);

create table public.order_recipients (
  order_id uuid not null references public.orders (id) on delete cascade,
  model_id uuid not null references public.model_profiles (id) on delete cascade,
  primary key (order_id, model_id)
);

create table public.order_responses (
  order_id uuid not null references public.orders (id) on delete cascade,
  model_id uuid not null references public.model_profiles (id) on delete cascade,
  version int not null,
  status public.response_status not null,
  updated_at timestamptz not null default now(),
  primary key (order_id, model_id)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id),
  order_id uuid references public.orders (id) on delete set null,
  body text not null check (length(btrim(body)) > 0),
  answer text,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_versions enable row level security;
alter table public.order_recipients enable row level security;
alter table public.order_responses enable row level security;
alter table public.questions enable row level security;
revoke all on public.orders, public.order_versions, public.order_recipients,
  public.order_responses, public.questions from anon, authenticated;

-- Admin manages orders; business policies come with stage 3, models read through model_order_cards only.
create policy o_admin on public.orders for all using (public.is_admin()) with check (public.is_admin());
create policy ov_admin on public.order_versions for all using (public.is_admin()) with check (public.is_admin());
create policy orc_admin on public.order_recipients for all using (public.is_admin()) with check (public.is_admin());
create policy ors_admin on public.order_responses for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.orders, public.order_versions,
  public.order_recipients, public.order_responses to authenticated;

create policy q_own on public.questions for select using (author_id = auth.uid() and public.my_role() is not null);
create policy q_admin on public.questions for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.questions to authenticated;

-- A newly approved version resets earlier confirmations.
create function public.reset_confirmations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.review_status = 'approved' and new.version > 1 then
    update public.order_responses set status = 'needs_reconfirm', updated_at = now()
    where order_id = new.order_id and status = 'confirmed' and version < new.version;
  end if;
  return new;
end;
$$;
create trigger order_version_approved
  after insert or update of review_status on public.order_versions
  for each row execute function public.reset_confirmations();

-- What a model may see: latest approved version without the contact section, no business identity.
create view public.model_order_cards as
  select o.id as order_id,
         v.version,
         o.status::text as status,
         (v.brief - 'contact') as brief,
         v.changes,
         r.status::text as my_response,
         coalesce(r.version < v.version, false) as updated_flag
  from public.orders o
  join public.order_recipients rc on rc.order_id = o.id and rc.model_id = auth.uid()
  join lateral (
    select x.version, x.brief, x.changes from public.order_versions x
    where x.order_id = o.id and x.review_status = 'approved'
    order by x.version desc limit 1
  ) v on true
  left join public.order_responses r on r.order_id = o.id and r.model_id = rc.model_id
  where o.status in ('open', 'selected', 'completed') and public.is_approved_model();
revoke all on public.model_order_cards from anon, authenticated;
grant select on public.model_order_cards to authenticated;

create function public.respond_to_order(p_order_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  select version into v from public.model_order_cards where order_id = p_order_id;
  if v is null then raise exception 'order not available'; end if;
  insert into public.order_responses (order_id, model_id, version, status)
  values (p_order_id, auth.uid(), v, case when p_confirm then 'confirmed' else 'declined' end::public.response_status)
  on conflict (order_id, model_id) do update
    set version = excluded.version, status = excluded.status, updated_at = now();
end;
$$;

create function public.ask_question(p_order_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  qid uuid;
begin
  if coalesce(btrim(p_body), '') = '' then raise exception 'empty question'; end if;
  if not exists (select 1 from public.model_order_cards where order_id = p_order_id) then
    raise exception 'order not available';
  end if;
  insert into public.questions (author_id, order_id, body) values (auth.uid(), p_order_id, btrim(p_body))
  returning id into qid;
  return qid;
end;
$$;

revoke all on function public.respond_to_order(uuid, boolean), public.ask_question(uuid, text) from public, anon;
grant execute on function public.respond_to_order(uuid, boolean), public.ask_question(uuid, text) to authenticated;
