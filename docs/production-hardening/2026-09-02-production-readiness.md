# Online2Day targeted production-hardening report

Date: 2 September 2026

## Outcome

The targeted pass is complete. Existing SSL, RLS, backup, leaked-password and Security Advisor hardening was left unchanged. The changes in this pass address measured production risks: wasteful Azure worker polling, process-local serverless rate limiting, excessive connection-pool ceilings, and Vercel/Supabase environment binding compatibility.

No existing database access policy or application permission was changed. No speculative application index was added or removed.

## Measured changes

### Azure worker polling

The deployed `companyplatformworker` image was traced end-to-end. Its three hosted services poll outbox, import, and revenue workflow/action queues. All seven polled business tables were empty and had no recorded inserts, updates or deletes, so the observed volume was idle-queue checking rather than business processing.

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Empty-queue SQL operations | 9.39/s | 2.293/s | -75.6% |
| Approximate operations/day | 811,296 | 198,115 | -613,181 |
| Idle polling interval | 1 second | 5 seconds | 5x longer |
| Npgsql maximum pool size | 20 | 5 | -75% |

Batch sizes, lease rules, retry rules and processing behaviour were preserved. The latest worker revision is healthy. The post-change sample covered 31.395 seconds and 72 relevant SQL operations. Four idle worker sessions and zero idle-in-transaction sessions were observed.

The current worker binary depends on session-level `set_config` state and uses short `FOR UPDATE SKIP LOCKED` transactions. Moving it to transaction pooling or `LISTEN/NOTIFY` would require a source redesign; neither was attempted without that dependency proof.

### Distributed rate limiting

The Vercel-local in-memory map was replaced with an atomic Postgres-backed fixed-window limiter shared by all Vercel instances and regions. Bucket identifiers are HMAC-derived, so raw IP addresses and user identifiers are not stored. The function is `SECURITY DEFINER`, validates its inputs, bounds counters, performs indexed incremental expiry cleanup, and is executable only by `service_role`.

Applied limits:

| Class | Routes | Limit |
| --- | --- | ---: |
| Authentication | login | 10 per 15 minutes |
| Authentication | signup | 5 per 15 minutes |
| Authentication | resend confirmation / reset request | 3 per 15 minutes |
| Authentication | password update | 5 per 15 minutes |
| Anonymous | view tracking | 60 per minute |
| Anonymous | CSP reports | 120 per minute |
| Anonymous | agreement download GET / POST | 30 / 20 per minute |
| Authenticated | agreement download GET / POST | 120 / 30 per minute per user |
| Expensive | agreement export | 10 per minute per user |
| Expensive | checkout | 10 per 10 minutes |
| Expensive | requirements intake | 5 per 15 minutes |

Blocked requests return HTTP 429 with `Retry-After`, `RateLimit-*`, and `X-RateLimit-*` information. Limiter dependency failures fail closed with HTTP 503 rather than silently allowing unbounded traffic.

Production evidence after the load tests:

- 115 limiter calls recorded by `pg_stat_statements`, mean database execution 2.578 ms, no temporary writes.
- Three active buckets occupied 49,152 bytes.
- Three inserts and 112 in-place counter updates; the cleanup index recorded 166 scans.
- A 70-request anonymous burst produced 58 validation responses and 12 HTTP 429 responses because two requests had already consumed the same 60-request window.
- An 11-request login burst produced 10 validation responses and one HTTP 429 response.
- The sampled 429 responses reported `Retry-After: 29` and `Retry-After: 900` respectively.
- Anonymous and authenticated roles cannot execute the limiter function; `service_role` can.

The first production regression correctly exposed that the Vercel integration uses `O2D_DB_*`-prefixed Supabase variables. Support for those bindings was added across browser, server, proxy, upload and privileged clients, then redeployed and retested.

### Connection management

| Component | Database path | Result |
| --- | --- | --- |
| Vercel application | Supabase HTTPS Data API | No direct Postgres connections or Postgres driver in the application |
| Azure gateway | Supabase HTTPS API | No direct Postgres connection in the gateway |
| Azure worker | Shared Supavisor session pooler, port 5432 | SSL required; min 0, max 5, idle lifetime 60s, pruning 10s |
| Azure API | Shared Supavisor session pooler, port 5432 | SSL required; min 0, max 10, idle lifetime 60s, pruning 10s |

Both .NET services require session mode because they install session-scoped application context. Transaction mode would be unsafe until that design changes. At the final sample there were 19 database sessions in total, zero idle-in-transaction sessions, four `company_worker` sessions, and no active `company_app` sessions.

The Azure API can theoretically open 100 client sessions if all ten allowed replicas simultaneously fill their ten-connection pools. Production telemetry currently shows no such demand. This ceiling should be revisited before sustained API autoscaling rather than reduced speculatively now.

## Performance Advisor triage

After the rate-limit migration, Performance Advisor reported zero errors, zero warnings, and 130 informational suggestions:

| Finding | Count | Classification | Decision |
| --- | ---: | --- | --- |
| Unindexed foreign keys | 48 | DEFER UNTIL SCALE | The 33 affected tables contain 14 estimated live rows in total; 29 are empty and the largest contains 5 rows. No material FK join or cascade bottleneck exists. |
| Unused indexes | 80 existing | INTENTIONALLY IGNORE | Retain until a representative workload window proves removal safe; current write volume is negligible. |
| New limiter cleanup index | 1 | INTENTIONALLY IGNORE | It supports bounded expired-bucket cleanup and already recorded 166 scans during production testing. |
| Auth connections configured as absolute 10 | 1 | DEFER UNTIL SCALE | Current connection use is well below the 60-connection database limit. Convert to percentage when compute size or sustained Auth demand changes. |

Every individual finding and its decision is recorded in `supabase-performance-advisor-triage.csv` in this directory.

## Query review

`pg_stat_statements` confirmed that the worker was the only material high-volume application source. Its queue queries individually averaged approximately 0.009-0.027 ms and performed no temporary writes; the defect was call frequency, not query shape. The authenticated `is_admin()` path averaged about 0.81 ms. Queries with high mean time were Supabase dashboard/catalog introspection, not application traffic.

No query plan or production telemetry justified adding or dropping an application index. The empty outbox plan was already optimal for its current cardinality.

## Network restrictions

Database network restrictions were intentionally not enabled. The current Azure Container Apps environment has public networking enabled, no infrastructure subnet, and no NAT gateway. Its reported `20.26.93.148` address is a static ingress address, not proof of fixed outbound egress. Allowlisting it could disconnect the two legitimate direct pooler clients.

Vercel and the Azure gateway use Supabase HTTPS APIs, which Supabase database network restrictions do not cover. Before restricting direct database access, migrate the Azure Container Apps environment to a workload-profile VNet with a NAT gateway or another documented static-egress design, verify both direct clients from that address, then allowlist the NAT IPv4 range plus approved administrative/migration sources.

## Regression and load results

- Unit tests: 6/6 passed.
- TypeScript: passed.
- ESLint: zero errors; 32 pre-existing warnings.
- Production build: passed; all 57 routes generated/validated.
- Production security E2E: 3/3 passed.
- Authenticated dashboard navigation: 13/13 routes loaded with no fatal UI state or auth regression.
- Public/auth redirect regression: 21/21 routes passed.
- Public homepage burst: 100/100 HTTP 200; 1.395s median and 3.385s p95 for a single-client 100-way concurrency test.
- Warm sequential homepage: 29 ms median and 117 ms maximum across ten samples.
- Database permissions: limiter RPC denied to `anon` and `authenticated`; permitted to `service_role` only.
- Transaction health: zero idle-in-transaction sessions after load and regression testing.

## Risk register

| Severity | Status | Risk | Disposition |
| --- | --- | --- | --- |
| Critical | Fixed | Per-instance memory rate limits could be bypassed across Vercel instances. | Replaced with an atomic shared limiter and verified under concurrent production bursts. |
| High | Fixed | Azure worker generated continuous empty-queue load. | Idle interval raised safely; measured SQL volume reduced 75.6% without changing processing semantics. |
| High | Fixed | Vercel's prefixed Supabase bindings were not accepted by privileged/server clients. | Added explicit legacy and `O2D_DB_*` compatibility; authenticated UI and protected routes retested. |
| Medium | Open / deferred | Direct database allowlisting is unsafe without stable Azure outbound egress. | Add VNet plus NAT/static egress, then enable restrictions after connectivity tests. |
| Medium | Monitor | Azure API theoretical pool ceiling can exceed database capacity if all ten replicas saturate. | Current usage is zero; monitor pool wait time and connection count, and revisit before sustained autoscale. |
| Medium | Accepted | The database-backed limiter depends on Supabase API availability. | It fails closed with 503 and retry information; monitor limiter RPC latency/error rate. |
| Low | Deferred | 48 FK-index suggestions may become relevant with data growth. | Re-evaluate from real plans once affected tables grow; do not add speculative indexes now. |
| Low | Deferred | Auth uses an absolute ten-connection allocation. | Convert to percentage when compute size or Auth traffic materially changes. |

## Reference architecture decisions

- [Supabase connection methods and pooler modes](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database network restrictions](https://supabase.com/docs/guides/platform/network-restrictions)
- [Azure Container Apps networking and outbound behaviour](https://learn.microsoft.com/en-us/azure/container-apps/networking)
- [Vercel WAF rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
