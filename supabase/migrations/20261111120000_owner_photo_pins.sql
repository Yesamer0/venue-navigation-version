create or replace function public.set_account_photo_pinned(p_photo_id uuid, p_pinned boolean) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare photo public.venue_account_photos;
begin
 select * into photo from public.venue_account_photos where id=p_photo_id;
 if not found then raise exception 'Fotoğraf bulunamadı.'; end if;
 if photo.user_id is distinct from auth.uid() or not exists(select 1 from public.users where id=auth.uid() and is_venue is true) then raise exception 'Yalnızca kendi mekan paylaşımını sabitleyebilirsin.'; end if;
 perform 1 from public.venues where id::text=photo.venue_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Bu mekanın sahibi değilsin.'; end if;
 select * into photo from public.venue_account_photos where id=p_photo_id for update;
 if p_pinned and photo.pinned_at is null and (select count(*) from public.venue_account_photos where venue_id=photo.venue_id and pinned_at is not null)>=3 then
 raise exception 'En fazla 3 fotoğraf sabitleyebilirsin. Önce bir sabitlemeyi kaldır.'; end if;
 update public.venue_account_photos set pinned_at=case when p_pinned then coalesce(pinned_at,now()) else null end where id=p_photo_id;
end $$;
