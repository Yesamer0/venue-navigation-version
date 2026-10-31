begin;
create table public.venue_menu_imports (
  venue_id text not null,
  image_hash text not null check (image_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  attempted_at timestamptz not null default now(),
  attempts integer not null default 1,
  item_count integer,
  primary key (venue_id, image_hash)
);
alter table public.venue_menu_imports enable row level security;
revoke all on public.venue_menu_imports from anon, authenticated;

create function public.reserve_venue_menu_import(p_venue_id text, p_hash text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.venue_menu_imports;
begin
  -- Serializes imports and ownership changes for this venue.
  perform 1 from public.venues where id::text = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
  select * into existing from public.venue_menu_imports where venue_id = p_venue_id and image_hash = p_hash;
  if found then
    if existing.item_count is not null then return existing.item_count; end if;
    if existing.attempted_at > now() - interval '2 minutes' then raise exception 'Menü halen işleniyor. İki dakika sonra yeniden dene.'; end if;
    if existing.attempts >= 5 then raise exception 'Bu fotoğraf için deneme sınırına ulaşıldı. Daha net bir fotoğraf seç.'; end if;
    update public.venue_menu_imports set attempted_at = now(), attempts = attempts + 1 where venue_id = p_venue_id and image_hash = p_hash;
    return -1;
  end if;
  if (select count(*) from public.venue_menu_imports where venue_id = p_venue_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Saatlik 10 menü fotoğrafı sınırına ulaşıldı.';
  end if;
  insert into public.venue_menu_imports(venue_id, image_hash) values (p_venue_id, p_hash);
  return -1;
end $$;

create function public.commit_venue_menu_import(p_venue_id text, p_hash text, p_items jsonb) returns integer
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
  insert into public.menu_items(venue_id, name, price, category)
    select v.id, trim(j->>'name'), (j->>'price')::numeric, trim(j->>'category')
    from public.venues v cross join jsonb_array_elements(p_items) j where v.id::text = p_venue_id;
  get diagnostics imported = row_count;
  update public.venue_menu_imports set item_count = imported where venue_id = p_venue_id and image_hash = p_hash;
  return imported;
end $$;

create table public.venue_account_photos (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null,
  storage_path text not null unique,
  caption text not null default '' check (length(caption) <= 500),
  created_at timestamptz not null default now()
);
create index venue_account_photos_venue_created on public.venue_account_photos(venue_id, created_at desc);
alter table public.venue_account_photos enable row level security;
revoke all on public.venue_account_photos from anon, authenticated;
grant select on public.venue_account_photos to anon, authenticated;
grant delete on public.venue_account_photos to authenticated;
create policy account_photos_read on public.venue_account_photos for select using (true);
create policy account_photos_delete on public.venue_account_photos for delete to authenticated using (
  exists(select 1 from public.venues v where v.id::text = venue_id and v.owner_id = auth.uid())
);
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('venue-account', 'venue-account', true, 8388608, array['image/jpeg','image/png']);
create policy account_storage_read on storage.objects for select using (bucket_id = 'venue-account');
create policy account_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'venue-account' and (storage.foldername(name))[1] = auth.uid()::text
  and exists(select 1 from public.venues v where v.id::text = (storage.foldername(name))[2] and v.owner_id = auth.uid())
);
create policy account_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'venue-account' and exists(select 1 from public.venues v where v.id::text = (storage.foldername(name))[2] and v.owner_id = auth.uid())
);
create function public.publish_venue_account_photo(p_venue_id text, p_path text, p_caption text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare result uuid;
begin
  perform 1 from public.venues where id::text = p_venue_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
  if split_part(p_path,'/',1) <> auth.uid()::text or split_part(p_path,'/',2) <> p_venue_id or length(p_caption) > 500 then raise exception 'Geçersiz fotoğraf.'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'venue-account' and name = p_path) then raise exception 'Fotoğraf yüklenemedi.'; end if;
  insert into public.venue_account_photos(venue_id, storage_path, caption) values (p_venue_id, p_path, p_caption)
    on conflict(storage_path) do update set caption = excluded.caption returning id into result;
  return result;
end $$;
revoke all on function public.reserve_venue_menu_import(text,text), public.commit_venue_menu_import(text,text,jsonb), public.publish_venue_account_photo(text,text,text) from public, anon;
grant execute on function public.reserve_venue_menu_import(text,text), public.commit_venue_menu_import(text,text,jsonb), public.publish_venue_account_photo(text,text,text) to authenticated;
commit;
