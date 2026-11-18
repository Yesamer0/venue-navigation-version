begin;

create table public.business_applications (
  id uuid primary key default gen_random_uuid(),
  receipt uuid not null unique default gen_random_uuid(),
  email text not null,
  details jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'changes', 'approved', 'rejected')),
  feedback text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
alter table public.business_applications enable row level security;
revoke all on public.business_applications from public, anon, authenticated;
grant select on public.business_applications to service_role;

create function public.is_application_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid() and raw_app_meta_data->>'venue_applications_admin' = 'true'
  );
$$;

create function public.submit_business_application(p_email text, p_details jsonb, p_receipt uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  address text := lower(btrim(p_email));
  result uuid;
begin
  if address is null or length(address) > 254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or jsonb_typeof(p_details) is distinct from 'object' or length(p_details::text) > 3000 then
    raise exception 'invalid_application';
  end if;
  if exists (
    select 1 from jsonb_each(p_details) as field(key, value)
    where field.key not in ('sign_name','owner_name','legal_name','tax_office','tax_number','business_type','branch_count','employee_count','phone','address')
  ) or exists (
    select 1 from unnest(array['sign_name','owner_name','legal_name','tax_office','tax_number','business_type','branch_count','phone','address']) as required(key)
    where nullif(btrim(p_details->>required.key),'') is null
  ) or (p_details->>'tax_number') !~ '^[0-9]{10}$'
    or (p_details->>'business_type') not in ('Kafe','Restoran','Bar','Pub','Etkinlik')
    or (p_details->>'phone') !~ '^\+?[0-9]{10,15}$'
    or (p_details->>'branch_count') !~ '^[1-9][0-9]{0,5}$'
    or (p_details ? 'employee_count' and coalesce(p_details->>'employee_count','') !~ '^[0-9]{1,6}$') then
    raise exception 'invalid_application';
  end if;

  if p_receipt is null then
    perform pg_advisory_xact_lock(hashtextextended(address, 710));
    if exists (select 1 from public.business_applications where email = address and created_at > now() - interval '10 minutes') then
      raise exception 'application_rate_limit';
    end if;
    insert into public.business_applications(email, details) values (address, p_details)
    returning receipt into result;
  else
    update public.business_applications set details = p_details, status = 'pending'
    where receipt = p_receipt and email = address and status = 'changes'
    returning receipt into result;
    if result is null then raise exception 'application_not_editable'; end if;
  end if;
  return result;
end;
$$;

create function public.get_business_application_status(p_receipt uuid)
returns table(status text, feedback text) language sql stable security definer set search_path = '' as $$
  select application.status, application.feedback from public.business_applications as application
  where application.receipt = p_receipt;
$$;

create function public.list_business_applications()
returns table(id uuid, email text, details jsonb, status text, feedback text, created_at timestamptz, reviewed_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_application_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select a.id, a.email, a.details, a.status, a.feedback, a.created_at, a.reviewed_at
    from public.business_applications a order by a.created_at, a.id;
end;
$$;

create function public.review_business_application(p_id uuid, p_status text, p_feedback text)
returns void language plpgsql security definer set search_path = '' as $$
declare note text := nullif(btrim(p_feedback),'');
begin
  if not public.is_application_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('approved','rejected','changes')
     or (p_status = 'changes' and note is null) or length(note) > 2000 then
    raise exception 'invalid_decision';
  end if;
  update public.business_applications
  set status = p_status, feedback = note, reviewed_at = clock_timestamp(), reviewed_by = auth.uid()
  where id = p_id and status = 'pending';
  if not found then raise exception 'application_already_reviewed'; end if;
end;
$$;

revoke all on function public.is_application_admin() from public, anon, authenticated;
revoke all on function public.submit_business_application(text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.get_business_application_status(uuid) from public, anon, authenticated;
revoke all on function public.list_business_applications() from public, anon, authenticated;
revoke all on function public.review_business_application(uuid,text,text) from public, anon, authenticated;
grant execute on function public.submit_business_application(text,jsonb,uuid) to anon, authenticated;
grant execute on function public.get_business_application_status(uuid) to anon, authenticated;
grant execute on function public.list_business_applications() to authenticated;
grant execute on function public.review_business_application(uuid,text,text) to authenticated;

-- Public signup metadata must never grant the business role.
create function public.enforce_business_profile_provisioning() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.is_venue := coalesce((
    select account.raw_app_meta_data->>'venue_business_approved' = 'true'
    from auth.users account where account.id = new.id
  ), false);
  return new;
end;
$$;
revoke all on function public.enforce_business_profile_provisioning() from public, anon, authenticated;
create trigger enforce_business_profile_provisioning
before insert on public.users for each row execute function public.enforce_business_profile_provisioning();

create function public.find_application_account(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('kind', case when account.raw_app_meta_data->>'venue_application_id' = p_id::text
    then 'application' else 'other' end)
  from public.business_applications application
  join auth.users account on lower(account.email) = application.email
  where application.id = p_id and application.status = 'approved'
    and account.deleted_at is null
  limit 1;
$$;
revoke all on function public.find_application_account(uuid) from public, anon, authenticated;
grant execute on function public.find_application_account(uuid) to service_role;

commit;
