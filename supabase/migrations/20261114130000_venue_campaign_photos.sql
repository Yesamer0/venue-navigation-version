alter table public.venue_campaigns
  add column photo_base64 text check (
    photo_base64 is null or (
      length(photo_base64) between 4 and 131072
      and length(photo_base64) % 4 = 0
      and photo_base64 ~ '^/9j/[A-Za-z0-9+/]*={0,2}$'
    )
  );

create or replace function public.get_venue_campaign(p_venue_id text) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object('title', c.title, 'description', c.description, 'photo_base64', c.photo_base64)
  from public.venue_campaigns c
  where c.venue_id::text = p_venue_id
    and (public.can_view_public_venue(p_venue_id) or public.can_manage_venue_menu(p_venue_id))
$$;

drop function public.set_venue_campaign(text, text, text);

create function public.set_venue_campaign(
  p_venue_id text, p_title text, p_description text,
  p_photo_base64 text default null, p_replace_photo boolean default false,
  p_existing_only boolean default false
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare target_id public.venues.id%type;
declare saved public.venue_campaigns%rowtype;
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

  if p_existing_only and not exists (
    select 1 from public.venue_campaigns where venue_id = target_id
  ) then
    raise exception 'Kampanya artık yayında değil.' using errcode = 'P0002';
  end if;

  insert into public.venue_campaigns as c (venue_id, title, description, photo_base64)
  values (target_id, btrim(p_title), btrim(p_description), case when p_replace_photo then p_photo_base64 end)
  on conflict (venue_id) do update
  set title = excluded.title, description = excluded.description,
      photo_base64 = case when p_replace_photo then excluded.photo_base64 else c.photo_base64 end
  returning * into saved;

  return jsonb_build_object('title', saved.title, 'description', saved.description, 'photo_base64', saved.photo_base64);
end
$$;

revoke all on function public.set_venue_campaign(text, text, text, text, boolean, boolean) from public, anon;
grant execute on function public.set_venue_campaign(text, text, text, text, boolean, boolean) to authenticated;
