-- Keep the elevated lookup outside the PostgREST-exposed public schema.
-- Existing policies retain the public.is_admin() compatibility surface, but
-- the exposed function itself no longer runs with definer privileges.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) in ('oliverjosephking@gmail.com', 'info@online2day.com')
    or exists (
      select 1 from public.user_profiles
      where user_id = auth.uid() and role = 'admin'
    )
    or exists (
      select 1 from public.licensed_users
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))
        and role = 'admin' and status = 'active'
    );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = private, public, pg_temp
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;
