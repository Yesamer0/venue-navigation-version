begin;
-- Qualify the outer Storage column: an unqualified name inside EXISTS
-- resolves to venues.name instead of storage.objects.name.
alter policy account_storage_insert on storage.objects with check (
  bucket_id = 'venue-account'
  and (storage.foldername(storage.objects.name))[1] = auth.uid()::text
  and exists (
    select 1 from public.venues v
    where v.id::text = (storage.foldername(storage.objects.name))[2]
      and v.owner_id = auth.uid()
  )
);
alter policy account_storage_delete on storage.objects using (
  bucket_id = 'venue-account'
  and exists (
    select 1 from public.venues v
    where v.id::text = (storage.foldername(storage.objects.name))[2]
      and v.owner_id = auth.uid()
  )
);
commit;
