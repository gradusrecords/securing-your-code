-- The business cannot pick more models than the brief asks for (who.count of the approved version).
create or replace function public.select_models(p_order_id uuid, p_model_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.orders;
  approved int;
  wanted int;
  m uuid;
begin
  if public.my_role() is distinct from 'business' then raise exception 'business only'; end if;
  select * into o from public.orders where id = p_order_id and business_id = auth.uid() for update;
  if not found then raise exception 'order not found'; end if;
  if o.status not in ('open', 'selected') then raise exception 'order is not open for selection'; end if;
  if exists (select 1 from public.order_selections where order_id = o.id and finalized) then raise exception 'selection is already finalized'; end if;
  if coalesce(array_length(p_model_ids, 1), 0) = 0 then raise exception 'select at least one model'; end if;
  select max(version) into approved from public.order_versions where order_id = o.id and review_status = 'approved';
  select coalesce((brief #>> '{who,count}')::int, 0) into wanted
    from public.order_versions where order_id = o.id and version = approved;
  if wanted > 0 and array_length(p_model_ids, 1) > wanted then
    raise exception 'the brief asks for % model(s), you picked %', wanted, array_length(p_model_ids, 1);
  end if;
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
