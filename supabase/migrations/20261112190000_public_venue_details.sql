-- Public demo details deliberately exclude the owner's live test coordinates.
create function public.get_public_demo_cafe() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select jsonb_build_object(
    'id', v.id, 'name', 'Deneme Kafesi', 'category', v.category,
    'image_url', v.image_url, 'has_wifi', v.has_wifi, 'is_outdoor', v.is_outdoor
  )
  from public.venues v
  join public.users u on u.id = v.owner_id
  where v.name = 'deneme' and u.is_venue is true
    and lower(btrim(u.username)) = U&'mekanc\0131'
  order by v.id limit 1
$$;
revoke all on function public.get_public_demo_cafe() from public;
grant execute on function public.get_public_demo_cafe() to anon, authenticated;

create function public.can_view_public_venue(p_venue_id text) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists (
    select 1 from public.venues v
    where v.id::text = p_venue_id and (
      lower(btrim(v.name)) is distinct from 'deneme'
      or p_venue_id = public.get_public_demo_cafe()->>'id'
    )
  )
$$;
revoke all on function public.can_view_public_venue(text) from public;

create function public.get_public_venue_live_count(p_venue_id text) returns bigint
language sql stable security definer set search_path = pg_catalog as $$
  select count(*)
  from public.venue_presence
  where venue_id::text = p_venue_id and public.can_view_public_venue(p_venue_id)
    and last_seen_at >= now() - interval '30 minutes'
$$;
revoke all on function public.get_public_venue_live_count(text) from public;
grant execute on function public.get_public_venue_live_count(text) to anon, authenticated;

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
    and (p_venue_id is null or m.venue_id::text = p_venue_id)
    and (p_user_id is null or m.user_id = p_user_id)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.list_venue_moment_comments(p_moment_id uuid,p_offset integer default 0,p_limit integer default 20)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz,is_mine boolean)
language sql stable security definer set search_path=pg_catalog as $$
 select c.id,c.user_id,coalesce(u.username,'Gezgin')::text,c.body,c.created_at,coalesce(c.user_id=auth.uid(), false)
 from public.venue_moment_comments c left join public.users u on u.id=c.user_id
 where c.moment_id=p_moment_id and (
   auth.uid() is not null or exists (
     select 1 from public.venue_moments m
     where m.id=c.moment_id and public.can_view_public_venue(m.venue_id::text)
   )
 )
 order by c.created_at desc,c.id desc limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;

grant execute on function public.list_venue_moments(text,uuid,integer,integer) to anon;
grant execute on function public.list_venue_moment_comments(uuid,integer,integer) to anon;
