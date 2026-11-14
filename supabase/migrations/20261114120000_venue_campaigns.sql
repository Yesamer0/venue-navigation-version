do $$
declare venue_id_type text;
begin
  select format_type(atttypid, atttypmod) into strict venue_id_type
  from pg_attribute
  where attrelid = 'public.venues'::regclass and attname = 'id' and not attisdropped;

  execute format($ddl$
    create table public.venue_campaigns (
      venue_id %s primary key references public.venues(id) on delete cascade,
      title text not null check (char_length(btrim(title)) between 1 and 60),
      description text not null check (char_length(btrim(description)) between 1 and 180)
    )
  $ddl$, venue_id_type);
end
$$;

alter table public.venue_campaigns enable row level security;
revoke all on public.venue_campaigns from public, anon, authenticated;

create function public.get_venue_campaign(p_venue_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('title', c.title, 'description', c.description)
  from public.venue_campaigns c
  where c.venue_id::text = p_venue_id
    and public.can_view_public_venue(p_venue_id)
$$;

revoke all on function public.get_venue_campaign(text) from public;
grant execute on function public.get_venue_campaign(text) to anon, authenticated;

create function public.set_venue_campaign(p_venue_id text, p_title text, p_description text)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare target_id public.venues.id%type;
begin
  select v.id into target_id
  from public.venues v
  where v.id::text = p_venue_id and v.owner_id = auth.uid()
  for update;

  if target_id is null or not public.can_manage_venue_menu(p_venue_id) then
    raise exception 'Kampanyayı yalnızca mekân sahibi yönetebilir.' using errcode = '42501';
  end if;

  if p_title is null and p_description is null then
    delete from public.venue_campaigns where venue_id = target_id;
    return null;
  end if;

  insert into public.venue_campaigns (venue_id, title, description)
  values (target_id, btrim(p_title), btrim(p_description))
  on conflict (venue_id) do update
  set title = excluded.title, description = excluded.description;

  return jsonb_build_object('title', btrim(p_title), 'description', btrim(p_description));
end
$$;

revoke all on function public.set_venue_campaign(text, text, text) from public, anon;
grant execute on function public.set_venue_campaign(text, text, text) to authenticated;
