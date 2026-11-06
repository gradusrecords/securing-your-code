-- Role of the current user, or null when not signed in / blocked / role unset.
create function public.my_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and not is_blocked;
$$;

create type public.review_status as enum ('pending', 'approved', 'returned');

create table public.model_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  display_name text,
  birth_date date not null,
  gender text not null check (gender in ('female', 'male')),
  city text not null default 'Ташкент',
  phone text not null,
  telegram text not null,
  instagram text,
  parent_contact text,
  height_cm smallint not null check (height_cm between 100 and 230),
  weight_kg smallint check (weight_kg between 15 and 200),
  bust_cm smallint, waist_cm smallint, hips_cm smallint,
  shoe_size text, hair text, eyes text,
  experience text not null,
  directions text[] not null default '{}',
  other_agency_contract boolean not null default false,
  portfolio_url text,
  about text,
  photos text[] not null default '{}',
  status public.review_status not null default 'pending',
  review_comment text,
  created_at timestamptz not null default now()
);

create table public.business_profiles (
  id uuid primary key references public.profiles (id) on delete cascade,
  full_name text not null,
  company text,
  position text,
  phone text not null,
  telegram text,
  email text,
  city text,
  industry text
);

create table public.catalog_entries (
  model_id uuid primary key references public.model_profiles (id) on delete cascade,
  agency_rating smallint not null default 9 check (agency_rating between 0 and 10),
  agency_note text,
  is_published boolean not null default false
);

alter table public.model_profiles enable row level security;
alter table public.business_profiles enable row level security;
alter table public.catalog_entries enable row level security;

revoke all on public.model_profiles, public.business_profiles, public.catalog_entries from anon, authenticated;

-- model_profiles: owner model and admin; moderation columns are admin-only.
create policy mp_select on public.model_profiles for select
  using ((id = auth.uid() and public.my_role() = 'model') or public.is_admin());
create policy mp_insert on public.model_profiles for insert
  with check (id = auth.uid() and public.my_role() = 'model');
create policy mp_update_own on public.model_profiles for update
  using (id = auth.uid() and public.my_role() = 'model')
  with check (id = auth.uid() and public.my_role() = 'model');
create policy mp_admin_all on public.model_profiles for all
  using (public.is_admin()) with check (public.is_admin());
grant select, delete on public.model_profiles to authenticated;
grant insert (id, full_name, display_name, birth_date, gender, city, phone, telegram, instagram,
  parent_contact, height_cm, weight_kg, bust_cm, waist_cm, hips_cm, shoe_size, hair, eyes,
  experience, directions, other_agency_contract, portfolio_url, about, photos)
  on public.model_profiles to authenticated;
grant update (full_name, display_name, birth_date, gender, city, phone, telegram, instagram,
  parent_contact, height_cm, weight_kg, bust_cm, waist_cm, hips_cm, shoe_size, hair, eyes,
  experience, directions, other_agency_contract, portfolio_url, about, photos)
  on public.model_profiles to authenticated;
-- admin moderation: status/review_comment via a dedicated function, not direct update
create function public.review_model(target uuid, new_status public.review_status, comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.model_profiles set status = new_status, review_comment = comment where id = target;
end;
$$;
revoke all on function public.review_model(uuid, public.review_status, text) from public, anon;
grant execute on function public.review_model(uuid, public.review_status, text) to authenticated;

-- business_profiles: owner business and admin.
create policy bp_select on public.business_profiles for select
  using ((id = auth.uid() and public.my_role() = 'business') or public.is_admin());
create policy bp_insert on public.business_profiles for insert
  with check (id = auth.uid() and public.my_role() = 'business');
create policy bp_update on public.business_profiles for update
  using (id = auth.uid() and public.my_role() = 'business')
  with check (id = auth.uid() and public.my_role() = 'business');
create policy bp_admin_all on public.business_profiles for all
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.business_profiles to authenticated;

-- catalog_entries: admin only (business reads through public_model_cards).
create policy ce_admin_all on public.catalog_entries for all
  using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.catalog_entries to authenticated;

-- Public catalog cards: no contacts, birth date, parent data or legal name.
create view public.public_model_cards as
  select m.id as model_id,
         coalesce(m.display_name, m.full_name) as display_name,
         m.gender, m.height_cm, m.bust_cm, m.waist_cm, m.hips_cm,
         m.hair, m.eyes, m.directions, m.experience, m.photos,
         c.agency_rating, c.agency_note, (c.agency_rating = 10) as is_favorite
  from public.model_profiles m
  join public.catalog_entries c on c.model_id = m.id
  where m.status = 'approved' and c.is_published
    and public.my_role() in ('business', 'admin');
revoke all on public.public_model_cards from anon, authenticated;
grant select on public.public_model_cards to authenticated;
