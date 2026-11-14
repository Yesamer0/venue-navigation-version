create or replace function public.get_venue_campaign(p_venue_id text, p_manage boolean default false) returns jsonb
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
        and (c.ends_on is null or today <= c.ends_on)
      )
    )
$$;
