-- Background jobs using service_role need table privileges in addition to RLS bypass.
grant select, insert, update, delete on table public.venue_moments to service_role;
