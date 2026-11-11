-- Test access is provisioned administratively, never by the client.
create table public.photo_test_access (
 user_id uuid not null references public.users(id) on delete cascade,
 venue_id text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 primary key(user_id,venue_id),
 check(expires_at > created_at and expires_at <= created_at + interval '1 hour')
);
alter table public.photo_test_access enable row level security;
revoke all on public.photo_test_access from public,anon,authenticated;
create function public.has_photo_test_access(p_venue_id text) returns boolean
language sql volatile security definer set search_path=pg_catalog as $$
 select auth.uid() is not null
 and exists(select 1 from public.users u where u.id=auth.uid() and u.is_venue is false)
 and exists(select 1 from public.photo_test_access t where t.user_id=auth.uid()
   and t.venue_id=p_venue_id and t.expires_at > clock_timestamp())
$$;
revoke all on function public.has_photo_test_access(text) from public,anon;
grant execute on function public.has_photo_test_access(text) to authenticated;
CREATE OR REPLACE FUNCTION public.publish_venue_moment(p_venue_id text, p_storage_path text, p_caption text, p_latitude double precision, p_longitude double precision, p_accuracy double precision, p_captured_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare v public.venues%rowtype; result_id uuid; distance_m double precision;
begin
  if auth.uid() is null then raise exception 'Giriş yapmalısın.'; end if;
  if split_part(p_storage_path, '/', 1) <> auth.uid()::text
    or split_part(p_storage_path, '/', 2) <> p_venue_id
    or p_storage_path is null then raise exception 'Geçersiz fotoğraf yolu.'; end if;
  -- An RPC whose response was lost can safely be retried with the same path.
  select m.id into result_id from public.venue_moments m
    where m.storage_path = p_storage_path and m.user_id = auth.uid();
  if result_id is not null then return result_id; end if;
  if not public.can_upload_venue_moment(p_storage_path) then
    raise exception 'Önce mekânda Buradayım ile konumunu doğrula.';
  end if;
  if p_caption is null or char_length(p_caption) > 500 then raise exception 'Açıklama en fazla 500 karakter olabilir.'; end if;
  if p_latitude is null or p_longitude is null or p_accuracy is null
    or not (p_latitude between -90 and 90) or not (p_longitude between -180 and 180)
    or not (p_accuracy between 0 and 50) or p_captured_at is null
    or p_captured_at < now() - interval '60 seconds'
    or p_captured_at > now() + interval '30 seconds' then
    raise exception 'Güncel ve hassas bir konum gerekiyor. Yeniden dene.';
  end if;
  select * into v from public.venues where id::text = p_venue_id;
  if not found then raise exception 'Mekân konumu bulunamadı.'; end if;
  if not public.has_photo_test_access(p_venue_id) then
  if v.latitude is null or v.longitude is null
    or not (v.latitude::double precision between -90 and 90)
    or not (v.longitude::double precision between -180 and 180) then
    raise exception 'Mekân konumu bulunamadı.';
  end if;
  distance_m := 6371000 * 2 * asin(sqrt(least(1::double precision,
    power(sin(radians(v.latitude::double precision - p_latitude) / 2), 2)
    + cos(radians(p_latitude)) * cos(radians(v.latitude::double precision))
    * power(sin(radians(v.longitude::double precision - p_longitude) / 2), 2))));
  if distance_m + p_accuracy > 100 then raise exception 'Fotoğraf paylaşmak için mekânda olmalısın.'; end if;
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'venue-moments' and o.name = p_storage_path) then
    raise exception 'Fotoğraf yüklenemedi. Yeniden seç.';
  end if;
  insert into public.venue_moments(venue_id, user_id, storage_path, caption)
    values (v.id, auth.uid(), p_storage_path, btrim(p_caption))
    on conflict (storage_path) do nothing returning id into result_id;
  if result_id is null then
    select id into result_id from public.venue_moments where storage_path = p_storage_path and user_id = auth.uid();
  end if;
  return result_id;
end $function$
;
