begin;
-- Exact product identity, tolerant of typography/case/spacing. Size/variant stays in the name.
create function public.menu_product_key(p_name text) returns text
language sql immutable strict set search_path=public,pg_temp as $$
 select translate(lower(trim(regexp_replace(normalize(p_name,NFKC), '[[:space:]]+', ' ', 'g'))), 'ı', 'i')
$$;

create or replace function public.commit_venue_menu_import(p_venue_id text,p_hash text,p_items jsonb) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare imported integer; row_item jsonb; matched integer;
begin
 if not public.can_manage_venue_menu(p_venue_id) then raise exception 'Menüyü yalnızca mekan hesabı olan mekan sahibi değiştirebilir.'; end if;
 -- Serialize every page for this cafe, including updates of existing products.
 perform 1 from public.venues where id::text=p_venue_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
 select item_count into imported from public.venue_menu_imports where venue_id=p_venue_id and image_hash=p_hash for update;
 if not found then raise exception 'Menü okuma kaydı bulunamadı.'; end if;
 -- Replaying an older photo must never undo a newer photo's price update.
 if imported is not null then return imported; end if;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Menüde 1–200 ürün olmalı.'; end if;
 if jsonb_array_length(p_items) not between 1 and 200 then raise exception 'Menüde 1–200 ürün olmalı.'; end if;
 for row_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(row_item->'name') is distinct from 'string'
   or length(trim(row_item->>'name')) not between 1 and 200
   or jsonb_typeof(row_item->'category') is distinct from 'string'
   or length(trim(row_item->>'category')) not between 1 and 100
   or (row_item->'price' is distinct from 'null'::jsonb and
       (jsonb_typeof(row_item->'price') is distinct from 'number' or (row_item->>'price')::numeric not between 0 and 1000000))
   or (row_item ? 'menu_group' and (row_item->>'menu_group') not in ('yiyecek','icecek','diger'))
  then raise exception 'Geçersiz menü ürünü.'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_items) j group by public.menu_product_key(j->>'name')
           having count(distinct (j->>'price')::numeric)>1) then
  raise exception 'Aynı ürün farklı fiyatlarla okunmuş. Boyut ve çeşit adlarının net göründüğü bir fotoğraf seç.';
 end if;
 imported:=0;
 -- Collapse repeated lines on the same page; prefer a readable price over null.
 for row_item in select distinct on (public.menu_product_key(j->>'name')) j
   from jsonb_array_elements(p_items) j
   order by public.menu_product_key(j->>'name'), (j->>'price') is null
 loop
  update public.menu_items m set
   price=coalesce((row_item->>'price')::numeric,m.price),
   category=trim(row_item->>'category'),
   menu_group=coalesce(row_item->>'menu_group',m.menu_group)
   where m.venue_id::text=p_venue_id and public.menu_product_key(m.name)=public.menu_product_key(row_item->>'name');
  get diagnostics matched=row_count;
  if matched=0 then
   insert into public.menu_items(venue_id,name,price,category,menu_group)
   select v.id,trim(row_item->>'name'),(row_item->>'price')::numeric,trim(row_item->>'category'),row_item->>'menu_group'
   from public.venues v where v.id::text=p_venue_id;
  end if;
  imported:=imported+1;
 end loop;
 update public.venue_menu_imports set item_count=imported where venue_id=p_venue_id and image_hash=p_hash;
 return imported;
end $$;
commit;
