-- Run once in the project's Supabase SQL Editor before opening the new photo UI.
-- Photos are publicly readable; only signed-in members can browse profiles/like.
begin;

-- Preserve the existing venues.id type (UUID, bigint, etc.).
do $$
declare venue_id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into venue_id_type
  from pg_attribute a where a.attrelid = 'public.venues'::regclass
    and a.attname = 'id' and not a.attisdropped;
  if venue_id_type is null then raise exception 'venues.id bulunamadı'; end if;
  execute format($ddl$
    create table if not exists public.venue_moments (
      id uuid primary key default gen_random_uuid(),
      venue_id %s not null references public.venues(id) on delete cascade,
      user_id uuid not null references auth.users(id) on delete cascade,
      storage_path text not null unique,
      caption text not null default '' check (char_length(caption) <= 500),
      created_at timestamptz not null default now()
    )
  $ddl$, venue_id_type);
end $$;

create table if not exists public.venue_moment_likes (
  moment_id uuid not null references public.venue_moments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);
create index if not exists venue_moments_venue_created on public.venue_moments(venue_id, created_at desc, id desc);
create index if not exists venue_moments_user_created on public.venue_moments(user_id, created_at desc, id desc);
alter table public.venue_moments enable row level security;
alter table public.venue_moment_likes enable row level security;
revoke all on public.venue_moments, public.venue_moment_likes from anon, authenticated;
grant select, delete on public.venue_moments to authenticated;
grant select on public.venue_moment_likes to authenticated;

drop policy if exists moments_read on public.venue_moments;
create policy moments_read on public.venue_moments for select to authenticated using (true);
drop policy if exists moments_delete_own on public.venue_moments;
create policy moments_delete_own on public.venue_moments for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists moment_likes_read on public.venue_moment_likes;
create policy moment_likes_read on public.venue_moment_likes for select to authenticated using (true);

-- Direct inserts are deliberately unavailable. Publication checks presence and GPS.
create or replace function public.can_upload_venue_moment(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and split_part(p_name, '/', 1) = auth.uid()::text
    and array_length(string_to_array(p_name, '/'), 1) = 3
    and p_name ~ '\.(jpg|png)$'
    and exists (
      select 1 from public.venue_presence p
      where p.user_id = auth.uid() and p.venue_id::text = split_part(p_name, '/', 2)
        and p.last_seen_at >= now() - interval '30 minutes'
        and p.last_seen_at <= now() + interval '1 minute'
    )
$$;
revoke all on function public.can_upload_venue_moment(text) from public, anon;
grant execute on function public.can_upload_venue_moment(text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('venue-moments', 'venue-moments', true, 8388608, array['image/jpeg','image/png'])
on conflict (id) do update set public = true, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg','image/png'];
drop policy if exists moments_storage_insert on storage.objects;
create policy moments_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'venue-moments' and public.can_upload_venue_moment(name));
drop policy if exists moments_storage_select_own on storage.objects;
create policy moments_storage_select_own on storage.objects for select to authenticated
  using (bucket_id = 'venue-moments' and split_part(name, '/', 1) = (select auth.uid())::text);
drop policy if exists moments_storage_delete_own on storage.objects;
create policy moments_storage_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'venue-moments' and split_part(name, '/', 1) = (select auth.uid())::text);

create or replace function public.publish_venue_moment(
  p_venue_id text, p_storage_path text, p_caption text,
  p_latitude double precision, p_longitude double precision,
  p_accuracy double precision, p_captured_at timestamptz
) returns uuid language plpgsql security definer set search_path = pg_catalog
as $$
declare v public.venues%rowtype; result_id uuid; distance_m double precision;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.'; end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text
    or split_part(p_storage_path, '/', 2) <> p_venue_id
    or p_storage_path is null then raise exception 'Geçersiz fotoğraf yolu.'; end if;
  -- An RPC whose response was lost can safely be retried with the same path.
  select m.id into result_id from public.venue_moments m
    where m.storage_path = p_storage_path and m.user_id = auth.uid();
  if result_id is not null then return result_id; end if;
  if not public.can_upload_venue_moment(p_storage_path) then
    raise exception 'Önce mekânda Buradayım ile konumunu doğrula.';
  end if;
  if p_caption is null or char_length(p_caption) > 500 then raise exception 'Açıklama en fazla 500 karakter olabilir.'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null
    or not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180)
    or not (p_accuracy between 0 and 50) or p_captured_at is null
    or p_captured_at < now() - interval '60 seconds'
    or p_captured_at > now() + interval '30 seconds' then
    raise exception 'Güncel ve hassas bir konum gerekiyor. Yeniden dene.';
  end if;
  select * into v from public.venues where id::text = p_venue_id;
  if not found or v.latitude is null or v.longitude is null
    or not (v.latitude::double precision between -90 and 90)
    or not (v.longitude::double precision between -180 and 180) then
    raise exception 'Mekân konumu bulunamadı.';
  end if;
  distance_m := 6371000 * 2 * asin(sqrt(least(1::double precision,
    power(sin(radians(v.latitude::double precision - p_latitude) / 2), 2)
    + cos(radians(p_latitude)) * cos(radians(v.latitude::double precision))
    * power(sin(radians(v.longitude::double precision - p_longitude) / 2), 2))));
  if distance_m + p_accuracy > 100 then raise exception 'Fotoğraf paylaşmak için mekânda olmalısın.'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'venue-moments' and o.name = p_storage_path) then
    raise exception 'Fotoğraf yüklenemedi. Yeniden seç.';
  end if;
  insert into public.venue_moments(venue_id, user_id, storage_path, caption)
    values (v.id, auth.uid(), p_storage_path, btrim(p_caption))
    on conflict (storage_path) do nothing returning id into result_id;
  if result_id is null then
    select id into result_id from public.venue_moments where storage_path = p_storage_path and user_id = auth.uid();
  end if;
  return result_id;
end $$;
revoke all on function public.publish_venue_moment(text,text,text,double precision,double precision,double precision,timestamptz) from public, anon;
grant execute on function public.publish_venue_moment(text,text,text,double precision,double precision,double precision,timestamptz) to authenticated;

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
    m.user_id = auth.uid()
  from public.venue_moments m
    join public.venues v on v.id = m.venue_id
    left join public.users u on u.id::text = m.user_id::text
  where auth.uid() is not null
    and (p_venue_id is null or m.venue_id::text = p_venue_id)
    and (p_user_id is null or m.user_id = p_user_id)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;
revoke all on function public.list_venue_moments(text,uuid,integer,integer) from public, anon;
grant execute on function public.list_venue_moments(text,uuid,integer,integer) to authenticated;

create or replace function public.get_venue_moment_profile(p_user_id uuid)
returns table (id uuid, username text)
language sql stable security definer set search_path = pg_catalog
as $$
  select u.id::text::uuid, coalesce(u.username::text,'Gezgin')
  from public.users u where auth.uid() is not null and u.id::text = p_user_id::text
$$;
revoke all on function public.get_venue_moment_profile(uuid) from public, anon;
grant execute on function public.get_venue_moment_profile(uuid) to authenticated;

create or replace function public.set_venue_moment_like(p_moment_id uuid, p_liked boolean)
returns table (like_count bigint, liked_by_me boolean)
language plpgsql security definer set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'Beğenmek için giriş yapmalısın.'; end if;
  -- Serializes simultaneous likes on the same photo; retries express desired state.
  perform 1 from public.venue_moments where id = p_moment_id for update;
  if not found then raise exception 'Fotoğraf artık bulunamıyor.'; end if;
  if p_liked then
    insert into public.venue_moment_likes(moment_id, user_id) values(p_moment_id, auth.uid()) on conflict do nothing;
  else
    delete from public.venue_moment_likes where moment_id = p_moment_id and user_id = auth.uid();
  end if;
  return query select count(*), coalesce(bool_or(user_id = auth.uid()), false)
    from public.venue_moment_likes where moment_id = p_moment_id;
end $$;
revoke all on function public.set_venue_moment_like(uuid,boolean) from public, anon;
grant execute on function public.set_venue_moment_like(uuid,boolean) to authenticated;
commit;
