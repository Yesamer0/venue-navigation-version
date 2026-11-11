-- The existing DELETE RLS policy restricts deletion to auth.uid() = user_id.
-- Without this table privilege, logout/automatic checkout fail before RLS runs.
grant delete on table public.venue_presence to authenticated;
