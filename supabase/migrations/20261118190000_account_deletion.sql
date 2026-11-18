begin;

create table public.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.account_deletions enable row level security;
revoke all on public.account_deletions from public, anon, authenticated;

create function public.account_can_upload() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id = auth.uid())
    and not exists(select 1 from public.account_deletions where user_id = auth.uid())
$$;
revoke all on function public.account_can_upload() from public, anon;
grant execute on function public.account_can_upload() to authenticated;
create policy prevent_deleting_account_upload on storage.objects as restrictive
  for insert to authenticated with check (public.account_can_upload());
create policy prevent_deleting_account_object_update on storage.objects as restrictive
  for update to authenticated using (public.account_can_upload()) with check (public.account_can_upload());

create function public.prepare_account_deletion(p_actor uuid, p_application uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if p_application is null then
    target := p_actor;
  else
    if not exists(select 1 from auth.users where id = p_actor
      and raw_app_meta_data->>'venue_applications_admin' = 'true' and deleted_at is null) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select u.id into target from auth.users u join public.business_applications a
      on a.id = p_application and a.status = 'approved'
      where u.raw_app_meta_data->>'venue_application_id' = a.id::text
        and u.raw_app_meta_data->>'venue_business_approved' = 'true' and u.deleted_at is null;
  end if;

  perform 1 from auth.users where id = target and deleted_at is null
    and (raw_app_meta_data->>'venue_applications_admin') is distinct from 'true' for update;
  if not found then return null; end if;
  insert into public.account_deletions(user_id) values (target) on conflict do nothing;
  return target;
end;
$$;

create function public.account_deletion_files(p_user uuid)
returns table(bucket_id text, name text)
language sql stable security definer set search_path = '' as $$
  select o.bucket_id, o.name from storage.objects o
  where exists(select 1 from public.account_deletions d where d.user_id = p_user)
    and (o.owner_id = p_user::text or o.owner = p_user
      or (o.owner_id is null and o.owner is null
        and o.bucket_id in ('venue-account','venue-moments') and split_part(o.name,'/',1) = p_user::text))
  order by o.bucket_id, o.name limit 100
$$;

create function public.finish_account_deletion() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.account_deletions where user_id = old.id) then return old; end if;
  if exists(select 1 from public.account_deletion_files(old.id)) then raise exception 'account_files_remain'; end if;

  delete from public.venue_presence p using public.venues v where p.venue_id = v.id and v.owner_id = old.id;
  delete from public.venue_campaigns c using public.venues v where c.venue_id = v.id and v.owner_id = old.id;
  delete from public.campaigns c using public.venues v where c.venue_id = v.id and v.owner_id = old.id;
  delete from public.menu_items m using public.venues v where m.venue_id = v.id and v.owner_id = old.id;
  delete from public.menu_merge_archive m using public.venues v where m.venue_id = v.id::text and v.owner_id = old.id;
  delete from public.venue_menu_imports m using public.venues v where m.venue_id = v.id::text and v.owner_id = old.id;
  update public.venues set owner_id = null, closed_at = coalesce(closed_at, clock_timestamp()), image_url = null
    where owner_id = old.id;

  delete from public.venue_account_photos where user_id = old.id or split_part(storage_path,'/',1) = old.id::text;
  delete from public.menu_import_previews where user_id = old.id;
  delete from public.profiles where id = old.id;
  delete from public.business_applications
    where id::text = old.raw_app_meta_data->>'venue_application_id';
  delete from public.users where id = old.id;
  return old;
end;
$$;

revoke all on function public.prepare_account_deletion(uuid,uuid), public.account_deletion_files(uuid),
  public.finish_account_deletion() from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(uuid,uuid), public.account_deletion_files(uuid) to service_role;
create trigger finish_venue_account_deletion before delete on auth.users
  for each row execute function public.finish_account_deletion();
commit;
