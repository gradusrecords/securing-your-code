create function public.admin_answer_question(p_question_id uuid, p_answer text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if coalesce(btrim(p_answer), '') = '' then raise exception 'an answer is required'; end if;
  update public.questions set answer = btrim(p_answer), answered_at = now() where id = p_question_id;
  if not found then raise exception 'question not found'; end if;
  perform public.write_audit('question.answer', 'question', p_question_id::text, '{}');
end;
$$;

create function public.admin_set_blocked(p_user_id uuid, p_blocked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_user_id = auth.uid() then raise exception 'you cannot block yourself'; end if;
  update public.profiles set is_blocked = p_blocked where id = p_user_id;
  if not found then raise exception 'user not found'; end if;
  perform public.write_audit(case when p_blocked then 'user.block' else 'user.unblock' end, 'user', p_user_id::text, '{}');
end;
$$;

-- Same signature as before, now audited.
create or replace function public.review_model(target uuid, new_status public.review_status, comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.model_profiles set status = new_status, review_comment = comment where id = target;
  perform public.write_audit('model.review', 'model', target::text, jsonb_build_object('status', new_status, 'comment', comment));
end;
$$;

create view public.admin_questions as
  select q.id as question_id, q.author_id, p.role::text as author_role,
         coalesce(bp.full_name, mp.full_name) as author_name,
         q.order_id, q.body, q.answer, q.answered_at, q.created_at
  from public.questions q
  join public.profiles p on p.id = q.author_id
  left join public.business_profiles bp on bp.id = q.author_id
  left join public.model_profiles mp on mp.id = q.author_id
  where public.is_admin();

create view public.admin_users as
  select p.id as user_id, u.email, p.role::text as role, p.is_blocked,
         coalesce(bp.full_name, mp.full_name) as display_name, p.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.business_profiles bp on bp.id = p.id
  left join public.model_profiles mp on mp.id = p.id
  where public.is_admin();

create view public.admin_models as
  select m.id as model_id, m.full_name, m.display_name, m.gender, m.city, m.phone, m.telegram, m.instagram,
         m.birth_date, m.parent_contact, m.height_cm, m.experience, m.directions, m.photos,
         m.status::text as status, m.review_comment, c.agency_rating, c.agency_note,
         coalesce(c.is_published, false) as is_published, m.created_at
  from public.model_profiles m
  left join public.catalog_entries c on c.model_id = m.id
  where public.is_admin();

revoke all on public.admin_questions, public.admin_users, public.admin_models from anon, authenticated;
grant select on public.admin_questions, public.admin_users, public.admin_models to authenticated;
revoke all on function public.admin_answer_question(uuid, text), public.admin_set_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_answer_question(uuid, text), public.admin_set_blocked(uuid, boolean) to authenticated;
