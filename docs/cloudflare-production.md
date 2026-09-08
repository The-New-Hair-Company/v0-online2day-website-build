# Cloudflare production configuration

Last verified: 2026-09-08 (Europe/London)

## Topology

```text
Browser / webhook sender
  -> Cloudflare authoritative DNS + reverse proxy
  -> Vercel project v0-online2day-website-build-d8v2
  -> Azure Container Apps API gateway
  -> Supabase / Stripe / Resend / HubSpot
```

Supabase Auth, Realtime, and Storage browser traffic continues to use the
Supabase public endpoint directly. Cloudflare fronts only `online2day.com` and
`www.online2day.com`; it does not proxy mail or Resend DNS records.

## Delegation and DNSSEC

- Registrar: Vercel
- Authoritative nameservers: `ali.ns.cloudflare.com`, `eoin.ns.cloudflare.com`
- DNSSEC: ECDSA P-256/SHA-256 (algorithm 13), SHA-256 digest (type 2)
- DS key tag: `2371`
- Rollback nameservers: `ns1.vercel-dns.com`, `ns2.vercel-dns.com`

The current Cloudflare zone contains:

| Type | Name | Target/value | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | `4993f9e9f7d9744a.vercel-dns-017.com` | Proxied |
| CNAME | `www` | `cname.vercel-dns-017.com` | Proxied |
| CNAME | `_domainconnect` | `_domainconnect.vercel-dns.com` | DNS only |
| MX 10 | `@` | `hi.deomail.com` | DNS only |
| TXT | `@` | `v=spf1 include:spf.privateemail.com mx ~all` | DNS only |
| TXT | `@` | Google site verification | DNS only |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@online2day.com` | DNS only |
| TXT | `dkim._domainkey` | PrivateEmail DKIM public key | DNS only |
| MX 10 | `auth` | `inbound-smtp.eu-west-1.amazonaws.com` | DNS only |
| CNAME | `track.auth` | `links1.resend-dns.com` | DNS only |
| MX 10 | `send.auth` | `feedback-smtp.eu-west-1.amazonses.com` | DNS only |
| TXT | `send.auth` | `v=spf1 include:amazonses.com ~all` | DNS only |
| TXT | `resend._domainkey.auth` | Resend DKIM public key | DNS only |
| CAA | `@` | `0 issue "amazon.com"` | DNS only |
| CAA | `@` | `0 issue "letsencrypt.org"` | DNS only |
| CAA | `@` | `0 issue "pki.goog"` | DNS only |
| CAA | `@` | `0 issue "sectigo.com"` | DNS only |

The former wildcard Vercel alias was intentionally replaced by an explicit
`www` alias. The application has no tenant/subdomain routing, and removing the
wildcard avoids exposing the same application on arbitrary hostnames.

## TLS and transport

- Origin mode: Full (strict)
- Minimum edge TLS: 1.2
- TLS 1.3: enabled
- Always Use HTTPS: enabled
- HSTS: one year, includeSubDomains, preload, nosniff
- HTTP/2 and HTTP/2 to origin: enabled
- HTTP/3: enabled
- WebSockets: enabled
- 0-RTT: intentionally disabled because authentication and write requests must
  not be replayable
- Early Hints: enabled
- Rocket Loader and Speed Brain: intentionally disabled; both can change Next.js
  execution/navigation semantics
- Smart Tiered Cache: enabled

## WAF and rate limiting

- Cloudflare Free Managed Ruleset: always active
- `WAF-10 Block secret and framework scanners`: blocks common secret-file,
  WordPress, phpMyAdmin, PHPUnit, and server-status reconnaissance paths
- `RATE-10 Auth and public write burst shield`: 20 requests per 10 seconds per
  source IP, followed by a 10-second block, for authentication endpoints plus
  chat, checkout, requirements, and agreement-download endpoints

Cloudflare Free provides one rate-limiting rule and a 10-second period. The
edge rule is therefore a burst shield. Endpoint-specific sustained limits and
standards-compliant `429`/`Retry-After` responses remain enforced by the
distributed Supabase-backed application limiter.

Webhook routes are deliberately excluded from the edge rate-limit rule. Resend
and WhatsApp authenticity is verified by their application-level signatures.

## Cache policy

- `CACHE-90 Bypass dynamic and sensitive routes` bypasses all non-GET requests
  and `/api`, `/auth`, `/dashboard`, `/user-dashboard`, `/protected`, `/v`, and
  `/sign` route families.
- `CACHE-01 Immutable Next.js assets` makes only `/_next/static/` explicitly
  eligible, respects origin Cache-Control, enables cache-deception armour, and
  preserves strong ETags.
- Public HTML is not forced into Cloudflare cache. Vercel remains responsible
  for framework-aware HTML and React Server Component caching.

## Origin protection

Cloudflare sets the private `x-online2day-edge-key` request header on all origin
requests. Vercel Production stores the same value in
`CLOUDFLARE_ORIGIN_SECRET`. The application compares it in constant time before
serving any non-static route. A missing or incorrect credential receives a
non-cacheable `404`, preventing the public Vercel alias and direct Vercel IP
routes from acting as equivalent application origins.

Do not write the secret into source control, logs, tickets, or this document.
Rotate both ends together. When Cloudflare is in service, update the transform
rule first, update the Vercel Production variable immediately afterward, and
redeploy. For an emergency rollback, remove the Vercel environment variable
first so the guard becomes inert.

Because Vercel overwrites `X-Forwarded-For` behind another proxy on non-
Enterprise plans, the application trusts `CF-Connecting-IP` only when the
private origin credential is valid. Otherwise it falls back to Vercel's
platform-generated `X-Vercel-Forwarded-For` value.

## Rollback

1. Remove `CLOUDFLARE_ORIGIN_SECRET` from Vercel Production and redeploy.
2. Set the Cloudflare apex and `www` CNAME records to DNS only.
3. Confirm Vercel serves both hosts over HTTPS.
4. If Cloudflare DNS must also be removed, disable DNSSEC at Cloudflare, remove
   the DS record at Vercel, wait until the DS is absent from public resolvers,
   then restore `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.
5. Restore the original Vercel DNS records if delegation returns to Vercel.

Never change nameservers while a Cloudflare DS record remains published; doing
so creates a DNSSEC validation failure.
