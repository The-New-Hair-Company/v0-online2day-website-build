-- Keep future public-schema objects private until a migration explicitly
-- grants the Data API roles the privileges they need. This matches Supabase's
-- new secure-by-default posture and avoids accidental API exposure.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- Append-only provider health history used by the API-backed integrations
-- dashboard. Browser roles have no direct access: the Azure gateway reads and
-- writes this table with its server-side service role.
create table if not exists public.integration_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (char_length(provider) between 1 and 80),
  status text not null check (status in ('healthy', 'degraded', 'down', 'unknown')),
  latency_ms integer check (latency_ms is null or latency_ms between 0 and 120000),
  checked_at timestamptz not null default now(),
  detail text not null default '' check (char_length(detail) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_health_checks_checked_at
  on public.integration_health_checks (checked_at desc);

alter table public.integration_health_checks enable row level security;

revoke all on table public.integration_health_checks from public, anon, authenticated;
grant select, insert on table public.integration_health_checks to service_role;
