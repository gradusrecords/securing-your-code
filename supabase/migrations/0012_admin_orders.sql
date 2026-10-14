alter table public.order_versions add column review_comment text;

create table public.audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
create policy audit_admin_read on public.audit_log for select using (public.is_admin());
grant select on public.audit_log to authenticated;
revoke all on sequence public.audit_log_id_seq from anon, authenticated;

create function public.write_audit(p_action text, p_target_type text, p_target_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_details);
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public, anon, authenticated;

create function public.require_admin() returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
end;
$$;
revoke all on function public.require_admin() from public, anon;
grant execute on function public.require_admin() to authenticated;

create function public.admin_suggest_recipients(p_order_id uuid)
returns table (model_id uuid, display_name text, gender text, height_cm int, score int)
language plpgsql stable security definer set search_path = public as $$
declare
  b jsonb;
  want_gender text;
  ptype text;
  pcity text;
begin
  perform public.require_admin();
  select brief into b from public.order_versions where order_id = p_order_id order by version desc limit 1;
  if b is null then raise exception 'order not found'; end if;
  want_gender := case
    when lower(coalesce(b #>> '{who,gender}', '')) ~ '^(f|ж|a)' then 'female'
    when lower(coalesce(b #>> '{who,gender}', '')) ~ '^(m|м|e)' then 'male'
    else null end;
  ptype := b #>> '{project,type}';
  pcity := lower(coalesce(b #>> '{when_where,city}', ''));
  return query
    select m.id, coalesce(m.display_name, m.full_name), m.gender, m.height_cm::int,
           (case when want_gender is not null and m.gender = want_gender then 3 else 0 end
          + case when ptype is not null and ptype = any (m.directions) then 3 else 0 end
          + case when pcity <> '' and lower(m.city) = pcity then 1 else 0 end
          + coalesce(c.agency_rating, 0) / 10)::int as score
    from public.model_profiles m
    left join public.catalog_entries c on c.model_id = m.id
    where m.status = 'approved'
    order by score desc, 2;
end;
$$;

create function public.admin_approve_order(p_order_id uuid, p_recipients uuid[] default '{}') returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  pend public.order_versions;
  m uuid;
begin
  perform public.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  select * into pend from public.order_versions
    where order_id = o.id and review_status = 'pending' order by version desc limit 1;
  if not found then
    if o.status <> 'open' then raise exception 'nothing to approve'; end if;
  elsif o.status = 'in_review' and coalesce(array_length(p_recipients, 1), 0) = 0 then
    raise exception 'choose at least one recipient';
  end if;
  foreach m in array coalesce(p_recipients, '{}') loop
    if not exists (select 1 from public.model_profiles where id = m and status = 'approved') then
      raise exception 'model % is not approved', m;
    end if;
  end loop;
  if pend.order_id is not null then
    update public.order_versions set review_status = 'approved', review_comment = null
      where order_id = o.id and version = pend.version;
    update public.orders set current_version = greatest(current_version, pend.version),
      status = case when status = 'in_review' then 'open'::public.order_status else status end
      where id = o.id;
  end if;
  insert into public.order_recipients (order_id, model_id)
    select o.id, unnest(coalesce(p_recipients, '{}')) on conflict do nothing;
  perform public.write_audit('order.approve', 'order', o.id::text, jsonb_build_object('recipients', coalesce(p_recipients, '{}')));
end;
$$;

create function public.admin_return_order(p_order_id uuid, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v int;
begin
  perform public.require_admin();
  if coalesce(btrim(p_comment), '') = '' then raise exception 'a comment is required'; end if;
  select version into v from public.order_versions
    where order_id = p_order_id and review_status = 'pending' order by version desc limit 1;
  if v is null then raise exception 'nothing to return'; end if;
  update public.order_versions set review_status = 'returned', review_comment = btrim(p_comment)
    where order_id = p_order_id and version = v;
  perform public.write_audit('order.return', 'order', p_order_id::text, jsonb_build_object('comment', p_comment));
end;
$$;

create function public.admin_finalize_selection(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.orders where id = p_order_id and status = 'selected')
     or not exists (select 1 from public.order_selections where order_id = p_order_id) then
    raise exception 'the business has not selected models yet';
  end if;
  update public.order_selections set finalized = true where order_id = p_order_id;
  perform public.write_audit('order.finalize', 'order', p_order_id::text, '{}');
end;
$$;

create function public.admin_complete_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.orders set status = 'completed' where id = p_order_id and status in ('open', 'selected');
  if not found then raise exception 'order cannot be completed'; end if;
  perform public.write_audit('order.complete', 'order', p_order_id::text, '{}');
end;
$$;

create function public.admin_cancel_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.orders set status = 'cancelled' where id = p_order_id and status in ('in_review', 'open', 'selected');
  if not found then raise exception 'order cannot be cancelled'; end if;
  perform public.write_audit('order.cancel', 'order', p_order_id::text, '{}');
end;
$$;

create view public.admin_orders as
  select o.id as order_id, bp.full_name as business_name, bp.company, o.status::text as status,
         coalesce(ap.version, lv.version) as version,
         case when lv.review_status <> 'approved' then lv.version end as pending_version,
         lv.review_status::text as review_status,
         lv.brief #>> '{project,title}' as project_title,
         lv.brief #>> '{project,type}' as project_type,
         o.created_at,
         (select count(*)::int from public.order_responses r where r.order_id = o.id and r.status = 'confirmed' and r.version = ap.version) as confirmed_count,
         (select count(*)::int from public.order_selections s where s.order_id = o.id) as selected_count,
         (select count(*)::int from public.order_selections s where s.order_id = o.id and s.finalized) as finalized_count
  from public.orders o
  join public.business_profiles bp on bp.id = o.business_id
  join lateral (select x.* from public.order_versions x where x.order_id = o.id order by x.version desc limit 1) lv on true
  left join lateral (select x.version from public.order_versions x where x.order_id = o.id and x.review_status = 'approved' order by x.version desc limit 1) ap on true
  where public.is_admin();
revoke all on public.admin_orders from anon, authenticated;
grant select on public.admin_orders to authenticated;

revoke all on function public.admin_suggest_recipients(uuid), public.admin_approve_order(uuid, uuid[]),
  public.admin_return_order(uuid, text), public.admin_finalize_selection(uuid),
  public.admin_complete_order(uuid), public.admin_cancel_order(uuid) from public, anon;
grant execute on function public.admin_suggest_recipients(uuid), public.admin_approve_order(uuid, uuid[]),
  public.admin_return_order(uuid, text), public.admin_finalize_selection(uuid),
  public.admin_complete_order(uuid), public.admin_cancel_order(uuid) to authenticated;
