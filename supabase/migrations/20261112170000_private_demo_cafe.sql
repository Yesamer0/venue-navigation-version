create function public.can_use_demo_cafe() returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and is_venue is true
      and lower(btrim(username)) = U&'mekanc\0131'
  )
$$;
revoke all on function public.can_use_demo_cafe() from public;
grant execute on function public.can_use_demo_cafe() to anon, authenticated;

create policy demo_venue_read on public.venues as restrictive
for select to anon, authenticated using (
  lower(btrim(name)) is distinct from 'deneme'
  or (owner_id = (select auth.uid()) and (select public.can_use_demo_cafe()))
);

create policy demo_venue_insert on public.venues as restrictive
for insert to authenticated with check (
  lower(btrim(name)) is distinct from 'deneme'
  or (owner_id = (select auth.uid()) and (select public.can_use_demo_cafe()))
);

create policy demo_venue_update on public.venues as restrictive
for update to authenticated using (
  lower(btrim(name)) is distinct from 'deneme'
  or (owner_id = (select auth.uid()) and (select public.can_use_demo_cafe()))
) with check (
  lower(btrim(name)) is distinct from 'deneme'
  or (owner_id = (select auth.uid()) and (select public.can_use_demo_cafe()))
);

-- Venue RLS also determines whether its menu can be read.
create policy menu_requires_visible_venue on public.menu_items as restrictive
for select to anon, authenticated using (
  exists (select 1 from public.venues where id = menu_items.venue_id)
);

create or replace function public.get_demo_cafe() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select to_jsonb(v) from public.venues v
  where v.owner_id = auth.uid() and v.name = 'deneme'
    and public.can_use_demo_cafe()
  order by v.id limit 1
$$;
