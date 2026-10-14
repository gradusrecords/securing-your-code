create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pr', 'media', 'motivation')),
  title jsonb not null,
  body jsonb not null,
  sort int not null default 0,
  is_published boolean not null default true
);
alter table public.content_items enable row level security;
revoke all on public.content_items from anon, authenticated;
create policy ci_read on public.content_items for select using (is_published and public.my_role() = 'business');
create policy ci_admin on public.content_items for all using (public.is_admin()) with check (public.is_admin());
grant select, insert, update, delete on public.content_items to authenticated;
