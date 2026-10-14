-- Models must see that an order was cancelled (it appears in their Archive).
create or replace view public.model_order_cards as
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
  where o.status in ('open', 'selected', 'completed', 'cancelled') and public.is_approved_model();
