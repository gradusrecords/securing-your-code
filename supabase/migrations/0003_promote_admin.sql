-- The single superadmin is assigned manually, with the service role only.
create function public.promote_to_admin(target_email text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where email = target_email;
  if uid is null then
    raise exception 'no user with email %', target_email;
  end if;
  update public.profiles set role = 'admin' where id = uid;
end;
$$;

revoke all on function public.promote_to_admin(text) from public, anon, authenticated;
grant execute on function public.promote_to_admin(text) to service_role;
