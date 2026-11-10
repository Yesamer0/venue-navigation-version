begin;
-- Fold dotted capital I before lower(): some database collations emit i + combining dot.
create or replace function public.menu_category_key(p_category text) returns text
language sql immutable set search_path=public,pg_temp as $$
 select coalesce(nullif(trim(regexp_replace(replace(lower(translate(normalize(coalesce(p_category,''),NFKC),'ÇĞİÖŞÜçğıöşü','cgiosucgiosu')),'&',' ve '),'[^a-z0-9]+',' ','g')),''),'diger')
$$;
update public.menu_items set category=public.menu_category_label(category)
where category is distinct from public.menu_category_label(category);
commit;
