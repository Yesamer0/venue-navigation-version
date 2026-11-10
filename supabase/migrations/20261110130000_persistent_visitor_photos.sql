begin;
-- The cleanup schedule remains, but it now cleans files only after the author deletes a post.
create or replace function public.queue_expired_visitor_photos() returns integer
language sql security definer set search_path=public,pg_temp as $$ select 0 $$;
update public.venue_moments set expires_at=null;
delete from public.expired_visitor_photo_files q where exists(select 1 from public.venue_moments m where m.storage_path=q.storage_path);
alter policy moments_read on public.venue_moments using(true);
create policy moments_author_delete_only on public.venue_moments as restrictive for delete to authenticated using(user_id=auth.uid());
create or replace function public.prepare_visitor_photo() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.users where id=new.user_id and is_venue is true) then
  raise exception 'Mekan hesapları kendi Fotoğraflar bölümünden paylaşmalı.';
 end if;
 new.expires_at=null;new.profile_hidden=false;return new;
end $$;
create or replace function public.set_venue_photo_closing(p_venue_id text,p_close time) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.venues set photo_closing_time=p_close where id::text=p_venue_id and owner_id=auth.uid();
 if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
end $$;
create function public.queue_deleted_visitor_photo() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.expired_visitor_photo_files(storage_path) values(old.storage_path) on conflict do nothing;
 return old;
end $$;
revoke all on function public.queue_deleted_visitor_photo() from public,anon,authenticated;
create trigger queue_author_deleted_photo after delete on public.venue_moments for each row execute function public.queue_deleted_visitor_photo();
-- Honor earlier author removals in the old profile-only UI; surviving posts stay in both views.
delete from public.venue_moments where profile_hidden=true;
create or replace function public.hide_photo_from_profile(p_photo_id uuid,p_kind text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_kind='visitor' then
  delete from public.venue_moments where id=p_photo_id and user_id=auth.uid();
 elsif p_kind='account' then
  update public.venue_account_photos set profile_hidden=true where id=p_photo_id and user_id=auth.uid();
 else raise exception 'Geçersiz paylaşım türü.'; end if;
 if not found then raise exception 'Bu paylaşım sana ait değil.'; end if;
end $$;
create function public.delete_venue_moment(p_moment_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.venue_moments where id=p_moment_id and user_id=auth.uid();
 if not found then raise exception 'Yalnızca kendi fotoğrafını silebilirsin.'; end if;
end $$;
revoke all on function public.delete_venue_moment(uuid) from public,anon;
grant execute on function public.delete_venue_moment(uuid) to authenticated;
create or replace function public.can_upload_venue_moment(p_name text)
returns boolean language sql stable security definer set search_path = pg_catalog
as $$
  select auth.uid() is not null
    and not exists(select 1 from public.users u where u.id = auth.uid() and u.is_venue is true)
    and exists(select 1 from public.venues v where v.id::text = split_part(p_name, '/', 2))
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
    and (p_venue_id is null or m.venue_id::text = p_venue_id)
    and (p_user_id is null or m.user_id = p_user_id)
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;


create table public.venue_moment_comments(
 id uuid primary key default gen_random_uuid(),
 moment_id uuid not null references public.venue_moments(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(trim(body)) between 1 and 500),
 request_id text not null check(length(request_id) between 1 and 100),
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create index moment_comments_page on public.venue_moment_comments(moment_id,created_at desc,id desc);
alter table public.venue_moment_comments enable row level security;
revoke all on public.venue_moment_comments from public,anon,authenticated;
grant select,delete on public.venue_moment_comments to authenticated;
grant all on public.venue_moment_comments to service_role;
create policy moment_comments_read on public.venue_moment_comments for select to authenticated using(true);
create policy moment_comments_delete_own on public.venue_moment_comments for delete to authenticated using(user_id=auth.uid());
create function public.add_venue_moment_comment(p_moment_id uuid,p_body text,p_request_id text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Yorum yazmak için giriş yapmalısın.'; end if;
 if p_body is null or length(trim(p_body)) not between 1 and 500 then raise exception 'Yorum 1–500 karakter olmalı.'; end if;
 if p_request_id is null or length(p_request_id) not between 1 and 100 then raise exception 'Geçersiz yorum isteği.'; end if;
 perform 1 from public.venue_moments where id=p_moment_id for key share;
 if not found then raise exception 'Fotoğraf artık bulunamıyor.'; end if;
 insert into public.venue_moment_comments(moment_id,user_id,body,request_id) values(p_moment_id,auth.uid(),trim(p_body),p_request_id)
 on conflict(user_id,request_id) do nothing returning id into result;
 if result is null then
  select id into result from public.venue_moment_comments where user_id=auth.uid() and request_id=p_request_id and moment_id=p_moment_id;
 end if;
 if result is null then raise exception 'Bu yorum isteği başka bir fotoğrafta kullanılmış.'; end if;
 return result;
end $$;
create function public.list_venue_moment_comments(p_moment_id uuid,p_offset integer default 0,p_limit integer default 20)
returns table(id uuid,user_id uuid,username text,body text,created_at timestamptz,is_mine boolean)
language sql stable security definer set search_path=pg_catalog as $$
 select c.id,c.user_id,coalesce(u.username,'Gezgin')::text,c.body,c.created_at,c.user_id=auth.uid()
 from public.venue_moment_comments c left join public.users u on u.id=c.user_id
 where auth.uid() is not null and c.moment_id=p_moment_id
 order by c.created_at desc,c.id desc limit least(greatest(coalesce(p_limit,20),1),50) offset greatest(coalesce(p_offset,0),0)
$$;
revoke all on function public.add_venue_moment_comment(uuid,text,text),public.list_venue_moment_comments(uuid,integer,integer) from public,anon;
grant execute on function public.add_venue_moment_comment(uuid,text,text),public.list_venue_moment_comments(uuid,integer,integer) to authenticated;
commit;
