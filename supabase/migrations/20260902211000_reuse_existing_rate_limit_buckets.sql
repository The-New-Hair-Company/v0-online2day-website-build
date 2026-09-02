-- The shared limiter created earlier in this migration chain is already used
-- by Vercel. Remove the redundant compatibility function added by the
-- production-readiness migration; the Azure gateway now calls the established
-- consume_api_rate_limit RPC and shares the same durable counters.
drop function if exists public.consume_rate_limit(text, integer);
