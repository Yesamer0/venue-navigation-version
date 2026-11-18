begin;

alter table public.venues add column closed_at timestamptz;
create policy venues_hide_closed on public.venues as restrictive for select to anon, authenticated
  using (closed_at is null);
create policy venues_keep_closed on public.venues as restrictive for update to authenticated
  using (closed_at is null) with check (closed_at is null);

create or replace function public.can_view_public_venue(p_venue_id text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.venues v
    where v.id::text = p_venue_id and v.closed_at is null and (
      lower(btrim(v.name)) is distinct from 'deneme'
      or p_venue_id = public.get_public_demo_cafe()->>'id'
    )
  )
$$;
create or replace function public.list_venue_moments(
  p_venue_id text default null, p_user_id uuid default null,
  p_offset integer default 0, p_limit integer default 20
) returns table (
  id uuid, venue_id text, user_id uuid, username text, venue_name text,
  storage_path text, caption text, created_at timestamptz,
  like_count bigint, liked_by_me boolean, is_mine boolean
) language sql stable security definer set search_path = pg_catalog
as $$
  select m.id, m.venue_id::text, m.user_id, coalesce(u.username::text, 'Gezgin'),
    v.name::text, m.storage_path, m.caption, m.created_at,
    (select count(*) from public.venue_moment_likes l where l.moment_id = m.id),
    exists(select 1 from public.venue_moment_likes l where l.moment_id = m.id and l.user_id = auth.uid()),
    coalesce(m.user_id = auth.uid(), false)
  from public.venue_moments m
    join public.venues v on v.id = m.venue_id
    left join public.users u on u.id::text = m.user_id::text
  where (auth.uid() is not null
    or (p_venue_id is not null and public.can_view_public_venue(p_venue_id)))
    and (v.closed_at is null or (p_user_id is not null and p_venue_id is null))
    and (p_venue_id is null or m.venue_id::text = p_venue_id)
    and (p_user_id is null or m.user_id = p_user_id)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;

create function public.list_application_venues(p_application_id uuid)
returns table(id text, name text, closed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_application_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select v.id::text, v.name::text, v.closed_at
    from public.business_applications a
    join auth.users u on u.raw_app_meta_data->>'venue_application_id' = a.id::text
      and u.raw_app_meta_data->>'venue_business_approved' = 'true'
    join public.venues v on v.owner_id = u.id
    where a.id = p_application_id and a.status = 'approved'
    order by v.name, v.id;
end;
$$;

create function public.close_application_venue(p_application_id uuid, p_venue_id text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_application_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.venues v set closed_at = coalesce(v.closed_at, clock_timestamp())
  where v.id::text = p_venue_id and exists (
    select 1 from public.business_applications a
    join auth.users u on u.raw_app_meta_data->>'venue_application_id' = a.id::text
      and u.raw_app_meta_data->>'venue_business_approved' = 'true'
    where a.id = p_application_id and a.status = 'approved' and v.owner_id = u.id
  );
  if not found then raise exception 'venue_not_linked'; end if;
  delete from public.venue_presence where venue_id::text = p_venue_id;
end;
$$;

revoke all on function public.list_application_venues(uuid), public.close_application_venue(uuid,text) from public, anon;
grant execute on function public.list_application_venues(uuid), public.close_application_venue(uuid,text) to authenticated;
commit;
