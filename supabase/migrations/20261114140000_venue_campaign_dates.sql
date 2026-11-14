alter table public.venue_campaigns
  add column starts_on date,
  add column ends_on date,
  add constraint venue_campaign_date_range check (
    (starts_on is null and ends_on is null)
    or (starts_on is not null and ends_on is not null and starts_on <= ends_on)
  );

drop function public.get_venue_campaign(text);
create function public.get_venue_campaign(p_venue_id text, p_manage boolean default false) returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'title', c.title, 'description', c.description, 'photo_base64', c.photo_base64,
    'starts_on', c.starts_on, 'ends_on', c.ends_on,
    'is_active', c.starts_on is null or today between c.starts_on and c.ends_on
  )
  from public.venue_campaigns c
  cross join (select (statement_timestamp() at time zone 'Europe/Istanbul')::date as today) clock
  where c.venue_id::text = p_venue_id
    and (
      (p_manage and public.can_manage_venue_menu(p_venue_id))
      or (
        public.can_view_public_venue(p_venue_id)
        and (
          c.starts_on is null
          or today between c.starts_on and c.ends_on
        )
      )
    )
$$;

revoke all on function public.get_venue_campaign(text, boolean) from public;
grant execute on function public.get_venue_campaign(text, boolean) to anon, authenticated;

drop function public.set_venue_campaign(text, text, text, text, boolean, boolean);

create function public.set_venue_campaign(
  p_venue_id text, p_title text, p_description text,
  p_photo_base64 text default null, p_replace_photo boolean default false,
  p_existing_only boolean default false,
  p_starts_on date default null, p_ends_on date default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
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

  if p_existing_only and not exists (
    select 1 from public.venue_campaigns where venue_id = target_id
  ) then
    raise exception 'Kampanya artık yayında değil.' using errcode = 'P0002';
  end if;

  if (p_starts_on is null) <> (p_ends_on is null) or p_starts_on > p_ends_on then
    raise exception 'Geçersiz duyuru tarih aralığı.' using errcode = '22023';
  end if;

  insert into public.venue_campaigns as c (venue_id, title, description, photo_base64, starts_on, ends_on)
  values (target_id, btrim(p_title), btrim(p_description), case when p_replace_photo then p_photo_base64 end,
          p_starts_on, p_ends_on)
  on conflict (venue_id) do update
  set title = excluded.title, description = excluded.description,
      photo_base64 = case when p_replace_photo then excluded.photo_base64 else c.photo_base64 end,
      starts_on = coalesce(excluded.starts_on, c.starts_on),
      ends_on = coalesce(excluded.ends_on, c.ends_on);

  return public.get_venue_campaign(p_venue_id, true);
end
$$;

revoke all on function public.set_venue_campaign(text, text, text, text, boolean, boolean, date, date) from public, anon;
grant execute on function public.set_venue_campaign(text, text, text, text, boolean, boolean, date, date) to authenticated;
