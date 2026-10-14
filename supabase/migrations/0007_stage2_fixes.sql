-- PostgREST upsert includes `id` in the DO UPDATE SET list; the RLS check (id = auth.uid()) keeps it unchangeable.
grant update (id) on public.model_profiles to authenticated;

-- Answers can only be given or changed while the order is open.
create or replace function public.respond_to_order(p_order_id uuid, p_confirm boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v int;
  st text;
begin
  select version, status into v, st from public.model_order_cards where order_id = p_order_id;
  if v is null then raise exception 'order not available'; end if;
  if st <> 'open' then raise exception 'order is no longer open'; end if;
  insert into public.order_responses (order_id, model_id, version, status)
  values (p_order_id, auth.uid(), v, case when p_confirm then 'confirmed' else 'declined' end::public.response_status)
  on conflict (order_id, model_id) do update
    set version = excluded.version, status = excluded.status, updated_at = now();
end;
$$;
