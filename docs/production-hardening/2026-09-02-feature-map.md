# Online2Day production feature map

This map records the architecture found before the production-readiness implementation. It is the reference used to avoid parallel data paths and to distinguish working, partial, and externally blocked capabilities.

| Area | User surface | Server/API owner | Persistent owner | External dependency | Baseline state | Completion target |
| --- | --- | --- | --- | --- | --- | --- |
| Authentication | `/auth/*`, dashboard guards | Next server auth helpers; Supabase Auth | Supabase Auth and `user_profiles` | Resend through Supabase SMTP | Working | Regression test redirects, reset flow, and permission gates |
| Leads | `/dashboard/leads`, lead detail | Azure gateway `/api/v1/leads*` and `/api/v1/online2day/leads*` | `leads`, events, tasks, assets, audit | HubSpot for CRM sync | Working, UX gaps | Accessible row open, double-click, mobile cards, durable detail routing |
| Videos | `/dashboard/videos*`, `/v/[slug]` | Azure media/video routes and Next upload proxy | `lead_assets`, `videos`, `media_processing_jobs`, Storage | Browser media APIs; Azure worker | Working after prior editor pass | Regression and responsive verification |
| Email mailbox | `/dashboard/emails` | Azure mailbox, inbound and email-event routes | `emails`, `email_threads`, documents, attachments, provider events | Resend | Functional but tracking event matching/idempotency incomplete | Idempotent delivery/open/click history, correct rich-mail matching, clear metrics |
| Website chat | Public contact/chat surface | Contact form only | HubSpot/contact lead only | HubSpot | Not a real conversation | Secure visitor session, durable conversation, dashboard reply, modest refresh cadence |
| Authenticated support | `/user-dashboard/chat` | Direct browser-to-Supabase writes | `messages` | Supabase Realtime | Functional but bypasses API | Route reads/writes through Azure API while retaining Realtime delivery |
| Dashboard messages | `/dashboard/messages` | Azure conversation routes | `conversations`, `messages` | None | Working for seeded/admin threads | Channel-aware replies, delivery state, internal messaging, website chat |
| Internal messaging | Dashboard/user messaging | None | No participant model | None | Missing | Licensed-workspace participants, private history, unread/read state |
| WhatsApp | Dashboard messages | None | Seeded channel labels only | No provider credentials configured | Not integrated | Meta Cloud adapter, signed/idempotent webhook, explicit disconnected state until credentials exist |
| Appearance | Settings and accessibility widget | Azure admin-preferences API | `admin_preferences` | None | Basic theme/readability persisted | Semantic brand tokens, validated colour controls, live preview, server-first application |
| Dashboard shell | All dashboard pages | Next layouts/components | Preferences only | None | Mobile drawer exists; short-height and hard-coded-colour issues | No page overflow, scrollable nav, semantic light/dark coverage, responsive tables/workspaces |
| Settings/health | `/dashboard/settings`, integrations | Azure preferences, support and integration-health routes | preferences, audit, failures, security events, health checks | Supabase, HubSpot, Resend | Powerful but mixed operational and user settings | Clear information architecture, actionable health states, diagnostics separated |
| Blog/CMS | `/dashboard/blog*`, `/blog*` | Azure blog admin/public API | `blog_posts` | Image host only | Draft/publish and SEO basics work | Scheduled/archive states, SEO quality feedback, image upload, sitemap inclusion, safe rendering |
| Enterprise | `/dashboard/enterprise`, reports, integrations | Azure compatibility and online2day routes | enterprise state/events/tasks, reports, integrations | Provider-specific | Mixture of durable actions and UI-only demonstrations | Remove fake success, label capability/provider state, persist material actions, regression test |
| Site requests | `/dashboard/site-requests` | Azure site-request routes | `site_requests`, `site_build_requests` | HubSpot where configured | Working | Responsive and error-state regression |

## Architecture boundaries

- Browsers receive only Supabase publishable credentials. Service-role and provider secrets remain in Azure or server-only Next routes.
- Business writes use the Azure gateway. Direct Supabase browser access is retained only where Supabase Realtime authorisation is the delivery mechanism; durable mutations still go through the API.
- The current product is one licensed workspace rather than a multi-organisation SaaS. Internal member discovery must therefore be limited to active licensed users; customer/support accounts are not workspace members and cannot enumerate staff.
- Resend is the email delivery and event provider. Supabase stores mailbox/thread/event state; HubSpot is not the mailbox source of truth.
- No WhatsApp provider is configured in the repository or production environment. The provider adapter must fail closed and the UI must state that configuration is required.

## Production baseline evidence

- 7 conversations: 3 Web, 2 Email, 2 WhatsApp-labelled seed/legacy records.
- 21 messages, with `messages` included in the Supabase Realtime publication.
- 9 emails: 4 delivered, 4 sent, 1 draft. Only one row currently carries `provider_id` and no provider events have been retained.
- Email records have first-open/first-click timestamps but no delivery timestamp, latest-open timestamp, or counts.
- Existing conversation RLS limits authenticated reads to admins or `assigned_to`; message RLS limits reads to the conversation user or admins.

## Completion map

| Area | Final server path | Final persistence / delivery | Permission boundary | Verification |
| --- | --- | --- | --- | --- |
| Branding | public/admin branding routes | singleton `site_branding` row; server-rendered CSS variables | public read, admin write | schema/API validation, contrast guard, type/build checks |
| Email | Azure mailbox + Resend event routes | emails, threads, attachments and idempotent provider events | admin mailbox; signed provider events | provider/threading integration tests |
| Website chat | Next same-origin cookie proxy → Azure communication routes | hashed visitor session and conversation/messages | private high-entropy visitor token; admin reply | visitor isolation and atomic unread tests |
| Internal chat | Azure workspace-member routes | participant pair, messages and per-user read state | active licensed users only | recipient rejection and third-party access tests |
| WhatsApp | signed Next webhook → Azure Meta adapter | provider event ledger and channel messages | Meta HMAC; admin send; idempotency | inbound duplicate and outbound-provider tests |
| Blog/CMS | Azure public/admin blog routes | lifecycle/SEO fields, managed Storage media, slug redirect trigger | public live posts; admin writes | sanitizer/scheduling test; dynamic build routes |
| Enterprise | Azure compatibility/API routes | events, tasks, feature flags, snippets, notes, permission matrix, banner and release drafts | admin route enforcement | API persistence tests and refresh-safe UI |

## Enterprise capability inventory

- Calendar and meetings: durable events, deletion, ICS export, agenda copy, availability and follow-up tasks.
- Video calling: local WebRTC room, device permission check, screen-share/consent checklists and persisted shared notes. No recording is claimed or stored.
- Pipeline intelligence: live lead export/data-quality scan, durable tasks, and input-driven forecast/ROI modelling. No synthetic deal or churn score is shown.
- Communications: persisted response classifications, shared snippets and user-scoped notifications.
- Governance: API-backed permission matrix, feature flags, audit entries and bounded exports.
- Operations: persisted incident-banner state, release-note drafts, integration health probes and task board.
- Growth: real usage/workflow counts and explicit input-driven estimates; plan and NPS controls no longer fabricate external outcomes.

All material Enterprise actions now await the server response before success feedback. Provider-dependent capabilities expose their actual configuration or probe state instead of a hard-coded health result.

## Regression evidence

- Gateway build and 30 integration/unit tests pass.
- Frontend typecheck, quiet lint, 7 unit tests and the 59-route production build pass.
- Responsive Playwright checks pass at 375×667, 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900 and 1920×1080 at default browser zoom.
- The responsive pass found and fixed the 768px marketing-header overflow and verified the public chat remains fully inside every tested viewport.
