begin;
alter table public.venue_account_photos
  add column user_id uuid references auth.users(id) on delete set null,
  add column username text;

-- Existing objects have the original uploader's id as their first folder.
update public.venue_account_photos p set user_id = u.id
from auth.users u where u.id::text = split_part(p.storage_path, '/', 1);
update public.venue_account_photos p set username = nullif(trim(u.username), '')
from public.users u where u.id = p.user_id;

create or replace function public.publish_venue_account_photo(p_venue_id text, p_path text, p_caption text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare result uuid; author_name text;
begin
  perform 1 from public.venues where id::text = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
  if split_part(p_path,'/',1) <> auth.uid()::text or split_part(p_path,'/',2) <> p_venue_id or length(p_caption) > 500 then raise exception 'Geçersiz fotoğraf.'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'venue-account' and name = p_path) then raise exception 'Fotoğraf yüklenemedi.'; end if;
  select nullif(trim(username), '') into author_name from public.users where id = auth.uid();
  insert into public.venue_account_photos(venue_id, storage_path, caption, user_id, username)
    values (p_venue_id, p_path, p_caption, auth.uid(), author_name)
    on conflict(storage_path) do update set caption = excluded.caption returning id into result;
  return result;
end $$;
commit;
