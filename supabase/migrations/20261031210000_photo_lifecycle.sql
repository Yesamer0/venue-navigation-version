begin;
alter table public.menu_items add column menu_group text check (menu_group in ('yiyecek','icecek','diger'));
create or replace function public.commit_venue_menu_import(p_venue_id text, p_hash text, p_items jsonb) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare imported integer; row_item jsonb;
begin
  perform 1 from public.venues where id::text = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
  select item_count into imported from public.venue_menu_imports where venue_id = p_venue_id and image_hash = p_hash for update;
  if not found then raise exception 'Menü okuma kaydı bulunamadı.'; end if;
  if imported is not null then return imported; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Menüde 1–200 ürün olmalı.'; end if;
  for row_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(row_item->'name') is distinct from 'string'
      or length(trim(row_item->>'name')) not between 1 and 200
      or jsonb_typeof(row_item->'category') is distinct from 'string'
      or length(trim(row_item->>'category')) not between 1 and 100
      or (row_item->'price' is distinct from 'null'::jsonb and
        (jsonb_typeof(row_item->'price') is distinct from 'number' or (row_item->>'price')::numeric not between 0 and 1000000))
    then raise exception 'Geçersiz menü ürünü.'; end if;
  end loop;
  -- Resolve the venue's real id type without assuming UUID/bigint.
  insert into public.menu_items(venue_id, name, price, category, menu_group)
    select v.id, trim(j->>'name'), (j->>'price')::numeric, trim(j->>'category'), j->>'menu_group'
    from public.venues v cross join jsonb_array_elements(p_items) j where v.id::text = p_venue_id;
  get diagnostics imported = row_count;
  update public.venue_menu_imports set item_count = imported where venue_id = p_venue_id and image_hash = p_hash;
  return imported;
end $$;


alter table public.venues add column photo_closing_time time, add column photo_timezone text not null default 'Europe/Istanbul';
alter table public.venue_account_photos add column pinned_at timestamptz, add column profile_hidden boolean not null default false;
alter table public.venue_moments add column expires_at timestamptz, add column profile_hidden boolean not null default false;
create index venue_moments_expiry on public.venue_moments(expires_at) where expires_at is not null;

create function public.next_photo_closing(p_created_at timestamptz, p_close time, p_timezone text) returns timestamptz
language sql stable set search_path = pg_catalog as $$
 select case when ((p_created_at at time zone p_timezone)::date + p_close) at time zone p_timezone > p_created_at
 then ((p_created_at at time zone p_timezone)::date + p_close) at time zone p_timezone
 else (((p_created_at at time zone p_timezone)::date + 1) + p_close) at time zone p_timezone end
$$;
create function public.set_venue_photo_closing(p_venue_id text, p_close time) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 perform 1 from public.venues where id::text=p_venue_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
 if p_close is null then raise exception 'Kapanış saati gerekiyor.'; end if;
 update public.venues set photo_closing_time=p_close where id::text=p_venue_id;
 update public.venue_moments m set expires_at=public.next_photo_closing(m.created_at,p_close,v.photo_timezone)
 from public.venues v where v.id=m.venue_id and v.id::text=p_venue_id;
end $$;
create function public.prepare_visitor_photo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare closing time; zone text;
begin
 if exists(select 1 from public.users where id=new.user_id and is_venue is true)
 or exists(select 1 from public.venues where owner_id=new.user_id) then
 raise exception 'Mekan hesapları Ziyaretçiler bölümünden paylaşamaz. Fotoğraflar bölümünü kullan.'; end if;
 select photo_closing_time,photo_timezone into closing,zone from public.venues where id=new.venue_id;
 if closing is null then raise exception 'Mekan sahibi önce kapanış saatini ayarlamalı.'; end if;
 new.expires_at=public.next_photo_closing(new.created_at,closing,zone);
 return new;
end $$;
create trigger visitor_photo_expiry before insert on public.venue_moments for each row execute function public.prepare_visitor_photo();
alter policy moments_read on public.venue_moments using (expires_at is null or expires_at>now());

create function public.set_account_photo_pinned(p_photo_id uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare photo public.venue_account_photos;
begin
 select * into photo from public.venue_account_photos where id=p_photo_id;
 if not found then raise exception 'Fotoğraf bulunamadı.'; end if;
 perform 1 from public.venues where id::text=photo.venue_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
 if p_pinned and photo.pinned_at is null and (select count(*) from public.venue_account_photos where venue_id=photo.venue_id and pinned_at is not null)>=3 then
 raise exception 'En fazla 3 fotoğraf sabitleyebilirsin. Önce bir sabitlemeyi kaldır.'; end if;
 update public.venue_account_photos set pinned_at=case when p_pinned then coalesce(pinned_at,now()) else null end where id=p_photo_id;
end $$;
create function public.hide_photo_from_profile(p_photo_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
 if p_kind='account' then
 update public.venue_account_photos set profile_hidden=true where id=p_photo_id and user_id=auth.uid();
 elsif p_kind='visitor' then
 update public.venue_moments set profile_hidden=true where id=p_photo_id and user_id=auth.uid();
 else raise exception 'Geçersiz paylaşım türü.'; end if;
 if not found then raise exception 'Bu paylaşım sana ait değil.'; end if;
end $$;
revoke all on function public.next_photo_closing(timestamptz,time,text), public.prepare_visitor_photo() from public,anon,authenticated;
revoke all on function public.set_venue_photo_closing(text,time),public.set_account_photo_pinned(uuid,boolean),public.hide_photo_from_profile(uuid,text) from public,anon;
grant execute on function public.set_venue_photo_closing(text,time),public.set_account_photo_pinned(uuid,boolean),public.hide_photo_from_profile(uuid,text) to authenticated;
create or replace function public.can_upload_venue_moment(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and not exists(select 1 from public.users u where u.id = auth.uid() and u.is_venue is true)
    and not exists(select 1 from public.venues v where v.owner_id = auth.uid())
    and exists(select 1 from public.venues v where v.id::text = split_part(p_name, '/', 2) and v.photo_closing_time is not null)
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
    and (m.expires_at is null or m.expires_at > now())
    and (p_user_id is null or not m.profile_hidden)
    and (p_venue_id is null or m.venue_id::text = p_venue_id)
    and (p_user_id is null or m.user_id = p_user_id)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;

-- Queue expired Storage paths before removing posts; a scheduled worker deletes the actual files.
create table public.expired_visitor_photo_files(storage_path text primary key, queued_at timestamptz not null default now());
alter table public.expired_visitor_photo_files enable row level security;
revoke all on public.expired_visitor_photo_files from public,anon,authenticated;
grant all on public.expired_visitor_photo_files to service_role;
create function public.queue_expired_visitor_photos() returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare removed integer;
begin
 with expired as (delete from public.venue_moments where expires_at<=now() returning storage_path)
 insert into public.expired_visitor_photo_files(storage_path) select storage_path from expired on conflict do nothing;
 get diagnostics removed=row_count; return removed;
end $$;
revoke all on function public.queue_expired_visitor_photos() from public,anon,authenticated;
grant execute on function public.queue_expired_visitor_photos() to service_role;
commit;
