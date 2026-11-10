begin;
create or replace function public.can_manage_venue_menu(p_venue_id text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.venues v join public.users u on u.id=v.owner_id
 where v.id::text=p_venue_id and v.owner_id=auth.uid() and u.is_venue is true)
$$;
revoke all on function public.can_manage_venue_menu(text) from public,anon;
grant execute on function public.can_manage_venue_menu(text) to authenticated;
alter table public.menu_items enable row level security;
create policy menu_business_insert on public.menu_items as restrictive for insert to authenticated
 with check (public.can_manage_venue_menu(venue_id::text));
create policy menu_business_update on public.menu_items as restrictive for update to authenticated
 using (public.can_manage_venue_menu(venue_id::text)) with check (public.can_manage_venue_menu(venue_id::text));
create policy menu_business_delete on public.menu_items as restrictive for delete to authenticated
 using (public.can_manage_venue_menu(venue_id::text));
create or replace function public.reserve_venue_menu_import(p_venue_id text, p_hash text) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare existing public.venue_menu_imports;
begin
  if not public.can_manage_venue_menu(p_venue_id) then raise exception 'Menüyü yalnızca mekan hesabı olan mekan sahibi değiştirebilir.'; end if;
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
create or replace function public.commit_venue_menu_import(p_venue_id text, p_hash text, p_items jsonb) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare imported integer; row_item jsonb;
begin
  if not public.can_manage_venue_menu(p_venue_id) then raise exception 'Menüyü yalnızca mekan hesabı olan mekan sahibi değiştirebilir.'; end if;
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

create function public.release_failed_menu_import(p_venue_id text,p_hash text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.can_manage_venue_menu(p_venue_id) then raise exception 'Menü yetkisi yok.'; end if;
 update public.venue_menu_imports set attempted_at=now()-interval '2 minutes'
 where venue_id=p_venue_id and image_hash=p_hash and item_count is null;
end $$;
revoke all on function public.release_failed_menu_import(text,text) from public,anon;
grant execute on function public.release_failed_menu_import(text,text) to authenticated;
create function public.get_demo_cafe() returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 select to_jsonb(v) from public.venues v join public.users u on u.id=v.owner_id
 where v.name='deneme' and u.is_venue is true order by v.created_at desc limit 1
$$;
revoke all on function public.get_demo_cafe() from public,anon;
grant execute on function public.get_demo_cafe() to authenticated;
commit;
