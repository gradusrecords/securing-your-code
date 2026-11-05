create table public.order_selections (
  order_id uuid not null references public.orders (id) on delete cascade,
  model_id uuid not null references public.model_profiles (id) on delete cascade,
  finalized boolean not null default false,
  primary key (order_id, model_id)
);
alter table public.order_selections enable row level security;
revoke all on public.order_selections from anon, authenticated;
create policy osel_admin on public.order_selections for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.order_selections to authenticated;

-- Validates the required brief fields (see plan Global Constraints).
create function public.validate_brief(p jsonb) returns void language plpgsql immutable as $$
begin
  if coalesce(btrim(p #>> '{project,title}'), '') = '' then raise exception 'project.title is required'; end if;
  if coalesce(p #>> '{project,type}', '') not in ('show', 'photo', 'ad', 'clip', 'promo') then raise exception 'project.type is invalid'; end if;
  if coalesce(btrim(p #>> '{when_where,date}'), '') = '' then raise exception 'when_where.date is required'; end if;
  if coalesce(btrim(p #>> '{when_where,city}'), '') = '' then raise exception 'when_where.city is required'; end if;
  if coalesce((p #>> '{who,count}')::int, 0) < 1 then raise exception 'who.count must be at least 1'; end if;
  if coalesce(btrim(p #>> '{contact,name}'), '') = '' then raise exception 'contact.name is required'; end if;
  if coalesce(btrim(p #>> '{contact,phone}'), '') = '' then raise exception 'contact.phone is required'; end if;
end;
$$;

-- Changed fields between two briefs. The contact section is excluded on purpose: models can see `changes`.
create function public.brief_diff(old_b jsonb, new_b jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(d.sec || '.' || d.k, coalesce(d.nv, 'null'::jsonb)), '{}'::jsonb)
  from (
    select s.sec, k.k, new_b -> s.sec -> k.k as nv, old_b -> s.sec -> k.k as ov
    from (values ('project'), ('when_where'), ('who'), ('conditions'), ('requirements')) s(sec)
    cross join lateral (
      select jsonb_object_keys(coalesce(old_b -> s.sec, '{}'::jsonb) || coalesce(new_b -> s.sec, '{}'::jsonb)) as k
    ) k
  ) d
  where d.ov is distinct from d.nv;
$$;

create function public.create_order(p_brief jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  oid uuid;
begin
  if public.my_role() is distinct from 'business' then raise exception 'business only'; end if;
  if not exists (select 1 from public.business_profiles where id = auth.uid()) then raise exception 'fill in the business profile first'; end if;
  perform public.validate_brief(p_brief);
  insert into public.orders (business_id, status, current_version) values (auth.uid(), 'in_review', 1) returning id into oid;
  insert into public.order_versions (order_id, version, brief, review_status) values (oid, 1, p_brief, 'pending');
  return oid;
end;
$$;

create function public.update_order(p_order_id uuid, p_brief jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  latest public.order_versions;
  approved_brief jsonb;
  v int;
begin
  if public.my_role() is distinct from 'business' then raise exception 'business only'; end if;
  select * into o from public.orders where id = p_order_id and business_id = auth.uid() for update;
  if not found then raise exception 'order not found'; end if;
  if o.status not in ('in_review', 'open') then raise exception 'order cannot be edited in status %', o.status; end if;
  perform public.validate_brief(p_brief);
  select * into latest from public.order_versions where order_id = o.id order by version desc limit 1;
  select brief into approved_brief from public.order_versions
    where order_id = o.id and review_status = 'approved' order by version desc limit 1;
  if latest.review_status <> 'approved' then
    update public.order_versions
      set brief = p_brief, review_status = 'pending',
          changes = case when approved_brief is null then null else public.brief_diff(approved_brief, p_brief) end
      where order_id = o.id and version = latest.version;
    return latest.version;
  end if;
  v := latest.version + 1;
  insert into public.order_versions (order_id, version, brief, review_status, changes)
    values (o.id, v, p_brief, 'pending', public.brief_diff(latest.brief, p_brief));
  update public.orders set current_version = v where id = o.id;
  return v;
end;
$$;

create function public.cancel_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'cancelled'
  where id = p_order_id and business_id = auth.uid() and public.my_role() = 'business' and status in ('in_review', 'open');
  if not found then raise exception 'order cannot be cancelled'; end if;
end;
$$;

create function public.select_models(p_order_id uuid, p_model_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  approved int;
  m uuid;
begin
  if public.my_role() is distinct from 'business' then raise exception 'business only'; end if;
  select * into o from public.orders where id = p_order_id and business_id = auth.uid() for update;
  if not found then raise exception 'order not found'; end if;
  if o.status not in ('open', 'selected') then raise exception 'order is not open for selection'; end if;
  if exists (select 1 from public.order_selections where order_id = o.id and finalized) then raise exception 'selection is already finalized'; end if;
  if coalesce(array_length(p_model_ids, 1), 0) = 0 then raise exception 'select at least one model'; end if;
  select max(version) into approved from public.order_versions where order_id = o.id and review_status = 'approved';
  foreach m in array p_model_ids loop
    if not exists (select 1 from public.order_responses r
                   where r.order_id = o.id and r.model_id = m and r.status = 'confirmed' and r.version = approved) then
      raise exception 'model % has not confirmed this order', m;
    end if;
  end loop;
  delete from public.order_selections where order_id = o.id;
  insert into public.order_selections (order_id, model_id) select o.id, unnest(p_model_ids);
  update public.orders set status = 'selected' where id = o.id;
end;
$$;

create view public.business_orders as
  select o.id as order_id,
         o.status::text as status,
         coalesce(ap.version, lv.version) as version,
         case when lv.review_status <> 'approved' then lv.version end as pending_version,
         lv.brief,
         lv.review_status::text as review_status,
         (select count(*)::int from public.order_responses r
            where r.order_id = o.id and r.status = 'confirmed' and r.version = ap.version) as confirmed_count,
         (select count(*)::int from public.order_selections s where s.order_id = o.id) as selected_count,
         o.created_at
  from public.orders o
  join lateral (select x.* from public.order_versions x where x.order_id = o.id order by x.version desc limit 1) lv on true
  left join lateral (select x.version from public.order_versions x
                     where x.order_id = o.id and x.review_status = 'approved' order by x.version desc limit 1) ap on true
  where o.business_id = auth.uid() and public.my_role() = 'business';

create view public.order_confirmed_models as
  select o.id as order_id, m.id as model_id,
         coalesce(m.display_name, m.full_name) as display_name,
         m.gender, m.height_cm, m.bust_cm, m.waist_cm, m.hips_cm, m.hair, m.eyes,
         m.directions, m.experience, m.photos,
         c.agency_rating, coalesce(c.agency_rating = 10, false) as is_favorite,
         exists (select 1 from public.order_selections s where s.order_id = o.id and s.model_id = m.id) as is_selected
  from public.orders o
  join public.order_responses r on r.order_id = o.id and r.status = 'confirmed'
       and r.version = (select max(version) from public.order_versions where order_id = o.id and review_status = 'approved')
  join public.model_profiles m on m.id = r.model_id
  left join public.catalog_entries c on c.model_id = m.id
  where o.business_id = auth.uid() and public.my_role() = 'business';

revoke all on public.business_orders, public.order_confirmed_models from anon, authenticated;
grant select on public.business_orders, public.order_confirmed_models to authenticated;

create or replace function public.ask_question(p_order_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  qid uuid;
begin
  if coalesce(btrim(p_body), '') = '' then raise exception 'empty question'; end if;
  if not exists (select 1 from public.model_order_cards where order_id = p_order_id)
     and not exists (select 1 from public.orders where id = p_order_id and business_id = auth.uid() and public.my_role() = 'business') then
    raise exception 'order not available';
  end if;
  insert into public.questions (author_id, order_id, body) values (auth.uid(), p_order_id, btrim(p_body))
  returning id into qid;
  return qid;
end;
$$;

revoke all on function public.create_order(jsonb), public.update_order(uuid, jsonb), public.cancel_order(uuid),
  public.select_models(uuid, uuid[]), public.validate_brief(jsonb), public.brief_diff(jsonb, jsonb) from public, anon;
grant execute on function public.create_order(jsonb), public.update_order(uuid, jsonb), public.cancel_order(uuid),
  public.select_models(uuid, uuid[]) to authenticated;
