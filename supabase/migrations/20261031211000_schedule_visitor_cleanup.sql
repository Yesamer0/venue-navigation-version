begin;
create extension if not exists pg_net with schema extensions;
do $$
begin
  if not exists(select 1 from vault.secrets where name='venue_photo_cleanup_token') then
    raise exception 'Cleanup token must be provisioned before scheduling.';
  end if;
end $$;
select cron.schedule('venue-visitor-photo-cleanup', '* * * * *', $job$
  select net.http_post(
    url := 'https://rkqsobflqmkqzuzmiagn.supabase.co/functions/v1/cleanup-visitor-photos',
    headers := jsonb_build_object('Content-Type','application/json','X-Cleanup-Token',
      (select decrypted_secret from vault.decrypted_secrets where name='venue_photo_cleanup_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  );
$job$);
commit;
