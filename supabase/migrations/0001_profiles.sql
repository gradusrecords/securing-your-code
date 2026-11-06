create type public.user_role as enum ('model', 'business', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role,
  language text not null default 'ru' check (language in ('ru', 'uz', 'en')),
  push_token text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- True only for a non-blocked admin. SECURITY DEFINER so policies can call it without recursion.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_blocked
  );
$$;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() and not is_blocked)
  with check (id = auth.uid() and not is_blocked);

-- Users may change only language and push_token; role and is_blocked are never self-editable.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (language, push_token) on public.profiles to authenticated;

-- Signup trigger: role comes from metadata only if it is model or business; admin is never accepted.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'role' in ('model', 'business')
         then (new.raw_user_meta_data ->> 'role')::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time role choice after social sign-in (or any signup without a role).
create function public.set_my_role(new_role public.user_role) returns void
language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('model', 'business') then
    raise exception 'role % cannot be self-assigned', new_role;
  end if;
  update public.profiles set role = new_role
  where id = auth.uid() and role is null and not is_blocked;
  if not found then
    raise exception 'role is already set or user not allowed';
  end if;
end;
$$;

revoke all on function public.set_my_role(public.user_role) from public, anon;
grant execute on function public.set_my_role(public.user_role) to authenticated;
