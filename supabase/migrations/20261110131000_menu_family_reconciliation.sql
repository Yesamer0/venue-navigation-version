begin;
create table public.menu_merge_archive(
 menu_item_id text primary key,venue_id text not null,item jsonb not null,reason text not null,archived_at timestamptz not null default now()
);
alter table public.menu_merge_archive enable row level security;
revoke all on public.menu_merge_archive from public,anon,authenticated;
grant all on public.menu_merge_archive to service_role;
create or replace function public.menu_product_key(p_name text) returns text
language sql immutable strict set search_path=public,pg_temp as $$
 with folded as(select trim(regexp_replace(translate(lower(normalize(p_name,NFKC)),'çğıöşüâîûéèêë','cgiosuaiueeee'),'[^a-z0-9]+',' ','g')) as s),
 sized as(select regexp_replace(regexp_replace(regexp_replace(s,'\m(s|small)\M','kucuk','g'),'\m(m|medium)\M','orta','g'),'\m(l|large)\M','buyuk','g') as s from folded)
 select string_agg(t,' ' order by t) from sized cross join lateral unnest(string_to_array(s,' ')) t
$$;
create function public.menu_family_key(p_name text) returns text
language sql immutable strict set search_path=public,pg_temp as $$
 with base as(select public.menu_product_key(regexp_replace(p_name,'\([^)]*\)|\[[^]]*\]',' ','g')) as s)
 select coalesce((select nullif(string_agg(t,' ' order by t),'')
 from unnest(string_to_array(s,' ')) t
 where t not in ('kucuk','orta','buyuk','xl','xxl','demlik','bardak','porsiyon','mevsimlik')
 and not(t in ('ev','yapimi') and 'ev'=any(string_to_array(s,' ')) and 'yapimi'=any(string_to_array(s,' ')))),s) from base
$$;
alter table public.menu_items add column menu_updated_at timestamptz;
update public.menu_items set menu_updated_at=coalesce(created_at,now());
alter table public.menu_items alter column menu_updated_at set default now();
alter table public.menu_items alter column menu_updated_at set not null;
-- Keep the variants from the latest recorded page for a family. Archive every removed row.
with ranked as(
 select m.id,row_number() over(partition by venue_id,public.menu_product_key(name) order by menu_updated_at desc,id desc) as same_name,
 max(menu_updated_at) over(partition by venue_id,public.menu_family_key(name)) as newest_family
 from public.menu_items m
), removed as(
 delete from public.menu_items m using ranked r where m.id=r.id and (r.same_name>1 or m.menu_updated_at<r.newest_family) returning m.*
) insert into public.menu_merge_archive(menu_item_id,venue_id,item,reason)
 select id::text,venue_id::text,to_jsonb(removed),'legacy duplicate or superseded variant' from removed;
create unique index menu_items_product_identity on public.menu_items(venue_id,public.menu_product_key(name));
create function public.mark_menu_product_updated() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin new.menu_updated_at=now();return new;end $$;
create trigger mark_menu_product_updated before update on public.menu_items for each row execute function public.mark_menu_product_updated();
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
 -- The latest page is authoritative for variants of every represented product family.
 with removed as (
  delete from public.menu_items m where m.venue_id::text=p_venue_id
   and exists(select 1 from jsonb_array_elements(p_items) j where public.menu_family_key(j->>'name')=public.menu_family_key(m.name))
   and not exists(select 1 from jsonb_array_elements(p_items) j where public.menu_product_key(j->>'name')=public.menu_product_key(m.name))
  returning m.*
 ) insert into public.menu_merge_archive(menu_item_id,venue_id,item,reason)
 select id::text,venue_id::text,to_jsonb(removed),'superseded by newer photo variants' from removed
 on conflict(menu_item_id) do update set item=excluded.item,reason=excluded.reason,archived_at=now();
 imported:=0;
 -- Collapse repeated lines on the same page; prefer a readable price over null.
 for row_item in select distinct on (public.menu_product_key(j->>'name')) j
   from jsonb_array_elements(p_items) j
   order by public.menu_product_key(j->>'name'), (j->>'price') is null
 loop
  update public.menu_items m set
   name=trim(row_item->>'name'),
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
