create table public.menu_import_previews (
 id uuid primary key default gen_random_uuid(), user_id uuid not null,
 venue_id text not null, image_hash text not null, items jsonb not null,
 before_hash text not null, changes jsonb not null,
 expires_at timestamptz not null default (now()+interval '15 minutes'),
 consumed_count integer
);
alter table public.menu_import_previews enable row level security;
revoke all on public.menu_import_previews from public,anon,authenticated;
create function public.menu_preview_snapshot(p_venue_id text) returns jsonb
language sql volatile security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(m) order by m.id::text),'[]'::jsonb)
 from public.menu_items m where m.venue_id::text=p_venue_id
$$;
revoke all on function public.menu_preview_snapshot(text) from public,anon,authenticated;
create function public.prepare_venue_menu_preview(p_venue_id text,p_hash text,p_items jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare before_rows jsonb;after_rows jsonb;changes jsonb;count_items integer;preview_id uuid;
begin
 if not public.can_manage_venue_menu(p_venue_id) then raise exception 'Menüyü yalnızca mekan sahibi değiştirebilir.'; end if;
 perform 1 from public.venues where id::text=p_venue_id for update;
 before_rows:=public.menu_preview_snapshot(p_venue_id);
 -- Run the real reconciliation engine, capture the exact result, then roll it back.
 -- PL/pgSQL local variables survive a subtransaction rollback; table writes do not.
 begin
  count_items:=public.commit_venue_menu_import(p_venue_id,p_hash,p_items);
  after_rows:=public.menu_preview_snapshot(p_venue_id);
  select jsonb_build_object(
   'added',coalesce((select jsonb_agg(a) from jsonb_array_elements(after_rows) a where not exists(select 1 from jsonb_array_elements(before_rows) b where b->>'id'=a->>'id')),'[]'::jsonb),
   'removed',coalesce((select jsonb_agg(b) from jsonb_array_elements(before_rows) b where not exists(select 1 from jsonb_array_elements(after_rows) a where a->>'id'=b->>'id')),'[]'::jsonb),
   'updated',coalesce((select jsonb_agg(jsonb_build_object('before',b,'after',a)) from jsonb_array_elements(before_rows) b join jsonb_array_elements(after_rows) a on a->>'id'=b->>'id' where (a-'menu_updated_at'-'created_at') is distinct from (b-'menu_updated_at'-'created_at')),'[]'::jsonb),
   'count',count_items
  ) into changes;
  raise exception using errcode='ZP001',message='preview rollback';
 exception when sqlstate 'ZP001' then null;
 end;
 delete from public.menu_import_previews where user_id=auth.uid() and expires_at<now()-interval '1 day';
 insert into public.menu_import_previews(user_id,venue_id,image_hash,items,before_hash,changes)
 values(auth.uid(),p_venue_id,p_hash,p_items,md5(before_rows::text),changes) returning id into preview_id;
 return jsonb_build_object('previewId',preview_id,'changes',changes,'count',count_items);
end $$;
create function public.confirm_venue_menu_preview(p_preview_id uuid) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare preview public.menu_import_previews;result_count integer;
begin
 select * into preview from public.menu_import_previews where id=p_preview_id and user_id=auth.uid();
 if not found then raise exception 'Önizleme bulunamadı. Menüyü yeniden oku.'; end if;
 if not public.can_manage_venue_menu(preview.venue_id) then raise exception 'Bu mekanın sahibi değilsin.'; end if;
 perform 1 from public.venues where id::text=preview.venue_id for update;
 select * into preview from public.menu_import_previews where id=p_preview_id and user_id=auth.uid() for update;
 if preview.consumed_count is not null then return preview.consumed_count; end if;
 if preview.expires_at <= clock_timestamp() then raise exception 'Önizlemenin süresi doldu. Menüyü yeniden oku.' using errcode='40001'; end if;
 if md5(public.menu_preview_snapshot(preview.venue_id)::text)<>preview.before_hash then
  raise exception 'Menü önizlemeden sonra değişti. Güncel değişiklikleri görmek için menüyü yeniden oku.' using errcode='40001';
 end if;
 result_count:=public.commit_venue_menu_import(preview.venue_id,preview.image_hash,preview.items);
 update public.menu_import_previews set consumed_count=result_count where id=p_preview_id;
 return result_count;
end $$;
revoke all on function public.prepare_venue_menu_preview(text,text,jsonb),public.confirm_venue_menu_preview(uuid) from public,anon;
grant execute on function public.prepare_venue_menu_preview(text,text,jsonb),public.confirm_venue_menu_preview(uuid) to authenticated;
-- Keep direct/manual menu writes serialized with preview/confirm operations too.
create function public.lock_menu_preview_venue() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' then
  perform 1 from public.venues where id::text=old.venue_id::text for update;return old;
 end if;
 perform 1 from public.venues where id::text=new.venue_id::text for update;return new;
end $$;
revoke all on function public.lock_menu_preview_venue() from public,anon,authenticated;
create trigger menu_preview_parent_lock before insert or update or delete on public.menu_items for each row execute function public.lock_menu_preview_venue();
