-- Row-level policies already limit each operation to auth.uid().
grant select, insert, update, delete on table public.push_tokens to authenticated;
grant select, delete on table public.push_tokens to service_role;
