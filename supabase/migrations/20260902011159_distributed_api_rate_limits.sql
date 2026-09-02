create table if not exists public.api_rate_limit_buckets (
  bucket_key text primary key,
  request_count integer not null,
  reset_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint api_rate_limit_buckets_key_length check (char_length(bucket_key) between 1 and 96),
  constraint api_rate_limit_buckets_request_count check (request_count >= 1)
);

alter table public.api_rate_limit_buckets enable row level security;

revoke all on table public.api_rate_limit_buckets from public, anon, authenticated, service_role;

create index if not exists api_rate_limit_buckets_reset_at_idx
  on public.api_rate_limit_buckets (reset_at);

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_bucket_key is null or char_length(p_bucket_key) not between 1 and 96 then
    raise exception 'Invalid rate-limit bucket key' using errcode = '22023';
  end if;
  if p_limit not between 1 and 10000 then
    raise exception 'Invalid rate limit' using errcode = '22023';
  end if;
  if p_window_ms not between 1000 and 86400000 then
    raise exception 'Invalid rate-limit window' using errcode = '22023';
  end if;

  insert into public.api_rate_limit_buckets as bucket (
    bucket_key,
    request_count,
    reset_at,
    updated_at
  ) values (
    p_bucket_key,
    1,
    v_now + make_interval(secs => p_window_ms / 1000.0),
    v_now
  )
  on conflict (bucket_key) do update
  set request_count = case
        when bucket.reset_at <= v_now then 1
        else least(bucket.request_count + 1, p_limit + 1)
      end,
      reset_at = case
        when bucket.reset_at <= v_now then v_now + make_interval(secs => p_window_ms / 1000.0)
        else bucket.reset_at
      end,
      updated_at = v_now
  returning bucket.request_count, bucket.reset_at
    into v_count, v_reset_at;

  -- Keep durable state bounded without adding a separate scheduler dependency.
  -- The reset_at index makes this cleanup cheap, and it runs on roughly 0.2% of calls.
  if random() < 0.002 then
    delete from public.api_rate_limit_buckets
    where bucket_key in (
      select expired.bucket_key
      from public.api_rate_limit_buckets as expired
      where expired.reset_at < v_now - interval '1 day'
      order by expired.reset_at
      limit 500
    );
  end if;

  allowed := v_count <= p_limit;
  remaining := greatest(p_limit - v_count, 0);
  reset_at := v_reset_at;
  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

comment on table public.api_rate_limit_buckets is
  'Durable fixed-window counters shared by all Online2Day serverless instances.';
comment on function public.consume_api_rate_limit(text, integer, integer) is
  'Atomically consumes a distributed API rate-limit token. Callable only by service_role.';
