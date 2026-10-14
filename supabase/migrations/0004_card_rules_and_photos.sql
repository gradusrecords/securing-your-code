-- Models under 18 must provide a parent or guardian contact.
create function public.enforce_minor_guardian() returns trigger language plpgsql as $$
begin
  if new.birth_date > (current_date - interval '18 years')::date
     and coalesce(btrim(new.parent_contact), '') = '' then
    raise exception 'parent_contact is required for models under 18';
  end if;
  return new;
end;
$$;
create trigger model_profiles_minor_guardian
  before insert or update on public.model_profiles
  for each row execute function public.enforce_minor_guardian();

-- Helper so storage policies can see publication state without being blocked by model_profiles RLS.
create function public.is_published_model(p_model uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.model_profiles m
    join public.catalog_entries c on c.model_id = m.id
    where m.id = p_model and m.status = 'approved' and c.is_published);
$$;
revoke all on function public.is_published_model(uuid) from public, anon;
grant execute on function public.is_published_model(uuid) to authenticated;

insert into storage.buckets (id, name, public) values ('model-photos', 'model-photos', false)
  on conflict (id) do nothing;

create policy mp_photos_select on storage.objects for select using (
  bucket_id = 'model-photos' and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
    or (public.my_role() = 'business' and public.is_published_model(((storage.foldername(name))[1])::uuid))
  ));
create policy mp_photos_insert on storage.objects for insert with check (
  bucket_id = 'model-photos' and (
    public.is_admin()
    or (public.my_role() = 'model' and (storage.foldername(name))[1] = auth.uid()::text)
  ));
create policy mp_photos_update on storage.objects for update using (
  bucket_id = 'model-photos' and (public.is_admin()
    or (public.my_role() = 'model' and (storage.foldername(name))[1] = auth.uid()::text)));
create policy mp_photos_delete on storage.objects for delete using (
  bucket_id = 'model-photos' and (public.is_admin()
    or (public.my_role() = 'model' and (storage.foldername(name))[1] = auth.uid()::text)));
