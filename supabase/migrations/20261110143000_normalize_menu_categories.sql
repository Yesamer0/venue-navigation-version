begin;
create function public.menu_category_key(p_category text) returns text
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(nullif(trim(regexp_replace(replace(translate(lower(normalize(coalesce(p_category,''),NFKC)),'çğıöşü','cgiosu'),'&',' ve '),'[^a-z0-9]+',' ','g')),''),'diger')
$$;
create function public.menu_category_label(p_category text) returns text
language sql immutable set search_path=public,pg_temp as $$
 select case public.menu_category_key(p_category)
 when 'sicak icecekler' then 'Sıcak İçecekler'
 when 'soguk icecekler' then 'Soğuk İçecekler'
 when 'sandvic ve tost' then 'Sandviç & Tost'
 when 'diger' then 'Diğer'
 else trim(regexp_replace(normalize(p_category,NFKC),'[[:space:]]+',' ','g')) end
$$;
-- Reconcile old case/spacing variants without removing or merging any products.
with labels as(
 select venue_id,public.menu_category_key(category) as key,min(public.menu_category_label(category)) as label
 from public.menu_items group by venue_id,public.menu_category_key(category)
)
update public.menu_items m set category=l.label from labels l
where m.venue_id=l.venue_id and public.menu_category_key(m.category)=l.key and m.category is distinct from l.label;
create function public.normalize_menu_category() returns trigger
language plpgsql set search_path=public,pg_temp as $$
declare existing text;
begin
 new.category:=public.menu_category_label(new.category);
 select category into existing from public.menu_items
 where venue_id=new.venue_id and id is distinct from new.id
 and public.menu_category_key(category)=public.menu_category_key(new.category)
 order by created_at,id limit 1;
 if found then new.category:=public.menu_category_label(existing); end if;
 return new;
end $$;
create trigger normalize_menu_category before insert or update of category on public.menu_items
for each row execute function public.normalize_menu_category();
commit;
