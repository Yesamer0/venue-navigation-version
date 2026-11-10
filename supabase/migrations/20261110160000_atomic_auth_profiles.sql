begin;
create unique index users_username_identity on public.users(lower(replace(trim(username),'İ','i')))
where username is not null and trim(username)<>'';

create function public.is_username_available(p_username text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select p_username is not null and length(trim(p_username)) between 3 and 30
 and not exists(select 1 from public.users where lower(replace(trim(username),'İ','i'))=lower(replace(trim(p_username),'İ','i')))
$$;
revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon,authenticated;

create function public.create_venue_signup_profile() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare chosen text;
begin
 chosen:=coalesce(nullif(trim(new.raw_user_meta_data->>'username'),''),'gezgin_'||left(replace(new.id::text,'-',''),12));
 if length(chosen) not between 3 and 30 then raise exception 'username_invalid'; end if;
 insert into public.users(id,username,name,email,is_venue)
 values(new.id,chosen,chosen,new.email,coalesce(new.raw_user_meta_data->>'is_venue'='true',false));
 return new;
end $$;
revoke all on function public.create_venue_signup_profile() from public,anon,authenticated;
create trigger create_venue_signup_profile after insert on auth.users
for each row execute function public.create_venue_signup_profile();

create function public.ensure_current_profile() returns table(id uuid,username text,is_venue boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare account auth.users%rowtype;chosen text;
begin
 if auth.uid() is null then raise exception 'Giriş yapmalısın.'; end if;
 if not exists(select 1 from public.users u where u.id=auth.uid()) then
  select * into account from auth.users where auth.users.id=auth.uid();
  if not found then raise exception 'Oturum bulunamadı.'; end if;
  chosen:=coalesce(nullif(trim(account.raw_user_meta_data->>'username'),''),'gezgin_'||left(replace(account.id::text,'-',''),12));
  if length(chosen) not between 3 and 30 then chosen:='gezgin_'||left(replace(account.id::text,'-',''),12); end if;
  begin
   insert into public.users(id,username,name,email,is_venue) values(account.id,chosen,chosen,account.email,coalesce(account.raw_user_meta_data->>'is_venue'='true',false));
  exception when unique_violation then
   insert into public.users(id,username,name,email,is_venue)
   values(account.id,'gezgin_'||left(replace(account.id::text,'-',''),12),chosen,account.email,coalesce(account.raw_user_meta_data->>'is_venue'='true',false))
   on conflict on constraint users_pkey do nothing;
  end;
 end if;
 return query select u.id,u.username,coalesce(u.is_venue,false) from public.users u where u.id=auth.uid();
end $$;
revoke all on function public.ensure_current_profile() from public,anon;
grant execute on function public.ensure_current_profile() to authenticated;
commit;
