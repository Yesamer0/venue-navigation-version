-- Expose only the published menu's identifier, never the demo venue's test coordinates.
create function public.get_public_demo_menu() returns text
language sql stable security definer set search_path = pg_catalog as $$
  select demo.id::text
  from (
    select v.id
    from public.venues v
    join public.users u on u.id = v.owner_id
    where v.name = 'deneme' and u.is_venue is true
      and lower(btrim(u.username)) = U&'mekanc\0131'
    order by v.id
    limit 1
  ) demo
  where exists (select 1 from public.menu_items m where m.venue_id = demo.id)
$$;
revoke all on function public.get_public_demo_menu() from public;
grant execute on function public.get_public_demo_menu() to anon, authenticated;

alter policy menu_requires_visible_venue on public.menu_items using (
  exists (select 1 from public.venues where id = menu_items.venue_id)
  or venue_id::text = (select public.get_public_demo_menu())
);
