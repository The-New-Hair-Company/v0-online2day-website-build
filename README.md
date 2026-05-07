# online2day CRM — Production Build

A production-grade CRM, marketing site, and client dashboard for online2day.com. Built with Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

---

## What's Live

### Marketing site (`/`)
- Homepage, Services, Work, Blog, About, Contact pages
- Guided chatbot on `/contact` (multi-step, no form required)
- `about` page with expandable team profiles (Oliver King, Mr Alok)

### Admin CRM (`/dashboard/*`)
- **Overview** — pipeline metrics, lead table, activity feed, task panel
- **Leads** — full CRUD, inline search/filter, stage pipeline
- **Lead detail** (`/dashboard/leads/[id]`) — inline edit, notes (with author), email composer + history, video upload, schedule callback/follow-up → writes to Enterprise Calendar, Do Not Contact with confirmation + persistent banner, full activity timeline
- **Videos** — library view, upload, video editor (`/dashboard/videos/editor`) with scene builder, timeline, recording
- **Emails** — template table, enterprise email composer modal (send via Resend, attach video asset)
- **Messages** — conversation list + threaded reply panel (Supabase-backed)
- **Enterprise Command Center** (`/dashboard/enterprise`) — calendar, tasks, audit log, 50+ operational tools, ROI calculator, data quality scan
- **Reports** — live KPI metrics, data quality scan, audit trail, snapshot capture (backed by `report_snapshots` table)
- **Site Requests** — inbound project request pipeline
- **Integrations** — Supabase, Resend, HubSpot status cards
- **Settings** — appearance, CRM setup, license management (backed by `licensed_users` table)

### User dashboard (`/user-dashboard/*`)
- **Overview** — project status and quick actions
- **My Website** — site builder view
- **Support Chat** — real-time messaging with admin
- **Profile** — manage account details

### Auth
- Sign-up, login, password reset, magic link
- Sign-out — POST `/auth/signout` (wired in both sidebars)
- New users auto-get a `user_profiles` row via `on_auth_user_created` trigger

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + CSS Modules |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Email | Resend |
| Deployment | Vercel |
| Icons | Lucide React |
| UI | shadcn/ui |

---

## Environment Variables

Required in Vercel (or `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only
RESEND_API_KEY=                  # email sends
HUBSPOT_PRIVATE_APP_TOKEN=       # contact sync
NEXT_PUBLIC_SITE_URL=https://www.online2day.com
```

---

## Getting Started

```bash
pnpm install
pnpm dev         # http://localhost:3000
```

---

## Database Schema

Run the full schema at `supabase/schema.sql` against your Supabase project SQL Editor.

### Core tables

| Table | Purpose |
|---|---|
| `leads` | CRM leads — name, company, email, phone, status, source, value, follow_up_date |
| `lead_events` | Timeline events per lead — type, note, metadata, created_by |
| `lead_assets` | Videos, documents, proposals per lead |
| `lead_agreements` | Downloadable agreement records |
| `lead_tasks` | Task checklist items per lead |
| `lead_audit_log` | Per-lead change trail |
| `activity_feed` | Global activity stream shown on Overview |
| `enterprise_events` | Calendar entries (from scheduling on lead detail + Enterprise page) |
| `enterprise_tasks` | Task checklist items on Enterprise page |
| `enterprise_state` | Key-value store for feature flags, enabled features, and legacy fallback data |
| `conversations` | Inbound chat conversations |
| `messages` | Per-conversation messages |
| `videos` | Video library records |
| `video_templates` | Reusable video templates |
| `email_templates` | Email template records shown in the Emails section |
| `emails` | Sent email records |
| `site_requests` | Inbound website build requests (public form) |
| `site_build_requests` | User-dashboard website build request pipeline |
| `integrations` | Integration status cards (Supabase, Resend, HubSpot) |
| `goals` | Pipeline goals and targets |
| `metric_snapshots` | Time-series metric data for charts |
| `analytics_snapshots` | Analytics rollup snapshots |
| `admin_preferences` | Per-admin key-value settings (theme, CRM config) |
| `admin_audit_log` | GDPR audit trail — action, resource, resource_id, changes, user_id |
| `user_profiles` | Extended user info — full_name, email, role, avatar_url |
| `licensed_users` | Seat-based access control — email, role, status, seat_type |
| `trial_accounts` | 14-day free trial signups |
| `contact_imports` | Bulk contact import records |
| `notifications` | Per-user notification feed — title, detail, source, severity, read_at |
| `report_snapshots` | Saved KPI snapshots — period_label, kpis (jsonb) |
| `async_action_failures` | Dead-letter queue for recoverable server-action errors |
| `security_events` | Security event log — invalid UUIDs, failed auth, rate-limit hits |

---

## Backend Status

### Completed

- **`user_profiles` table** — exists with RLS; `on_auth_user_created` trigger auto-creates rows on signup and assigns `admin` role for founding admin emails
- **`licensed_users` table** — exists with RLS; `is_admin()` function checks it; founding admins seeded
- **`enterprise_events` table** — exists with RLS; lead detail scheduling writes to it; Enterprise Calendar reads from it
- **`enterprise_tasks` table** — exists; Enterprise page manages tasks
- **`conversations` + `messages` tables** — exist with RLS; Messages section and Support Chat are fully wired
- **`notifications` table** — exists with per-user RLS; sidebar notification panel reads/writes it; graceful fallback to `enterprise_state` if needed
- **`report_snapshots` table** — exists; Reports page snapshot capture reads/writes it; graceful fallback to `enterprise_state`
- **`async_action_failures` table** — exists; `reliability-actions.ts` dead-letter queue writes to it; graceful fallback to `enterprise_state`
- **`security_events` table** — exists; `security-events.ts` writes invalid UUID, failed auth, and rate-limit events; graceful fallback to `enterprise_state`
- **`lead-videos` storage bucket** — exists (private); RLS policies allow authenticated upload/read, admin-only delete
- **`lead-assets` storage bucket** — exists (public); RLS policies allow authenticated upload/delete
- **Row Level Security** — enabled on all tables; admin-only access for CRM tables; member data-isolation policies for multi-tenant trial accounts
- **Resend email sending** — `sendEnterpriseEmail` in `lib/actions/email-actions.ts` is wired; requires `RESEND_API_KEY` in Vercel and a verified sending domain

### Remaining / Not Yet Wired

#### 1. HubSpot contact sync
`lib/actions/hubspot-actions.ts` posts contacts to HubSpot on form submit. Requires:
- `HUBSPOT_PRIVATE_APP_TOKEN` env var set in Vercel
- A HubSpot Private App created with `crm.objects.contacts.write` scope

#### 2. Features gated with "Contact sales to add this"
The following are UI-visible but not yet built. Any click shows a "Contact sales" toast:
- **Calendar booking integration** (Calendly / Google Calendar OAuth)
- **Automation rules** (trigger-based follow-up sequences)
- **Email campaign manager** (bulk send, sequences, A/B tests)
- **Import contacts** (CSV upload, bulk lead creation)
- **Assign owner** (multi-user role assignment)
- **New conversation** (creating outbound inbox conversations)
- **Create canned reply** (saved reply template management)
- **Create proposal / send proposal** (proposal builder)

These are labelled on-screen and redirect users to `sales@online2day.com`.

#### 3. Role-aware access: move from heuristics to pure DB-backed RBAC
`is_admin()` currently checks founding admin emails by hardcoded list in addition to DB roles. For a fully tenant-agnostic setup:
- Remove the hardcoded email list from `is_admin()` and rely solely on `user_profiles.role = 'admin'` or `licensed_users.role = 'admin'`
- Add a `team_memberships` table with workspace/tenant scoping
- Enforce route-level authorization from DB roles on every `/dashboard/*` server component

#### 4. Scheduled report snapshots
Reports compute live. For trend integrity and executive reporting:
- Add scheduled Supabase Edge Function to materialize daily/weekly KPI snapshots into `report_snapshots`
- Add export audit rows to `admin_audit_log` for every CSV/JSON download

#### 5. Integration health check history
Integrations page shows current status only. For SLA visibility:
- Add `integration_health_checks` table (`provider`, `status`, `latency_ms`, `checked_at`, `detail`)
- Add scheduled Edge Function to ping Supabase, Resend, HubSpot
- Surface degraded status into notifications feed

#### 6. Rate limiting at the edge
API routes (`/api/track/view`, `/api/download-agreements`) have no server-side rate limit:
- Add Edge Middleware using Vercel KV token buckets
- Log rate-limit hits to `security_events` table (already exists)

#### 7. Content Security Policy
Layout still uses an inline bootstrap script for theme injection (FOUC prevention). To add a strict CSP:
- Move theme bootstrap to a separate file loaded with a nonce/hash
- Add `Content-Security-Policy` header in `next.config` or Edge Middleware

#### 8. Background job queue for large exports
Agreement export generation runs synchronously. For large datasets:
- Move to a queued background job (Supabase Edge Function or Vercel background function)
- Write job status to `async_action_failures` / a new `export_jobs` table

---

## Project Structure (key paths)

```
app/
  auth/signout/route.ts          ← POST sign-out handler
  dashboard/leads/[id]/
    page.tsx                     ← server: fetches lead + events
    lead-detail-client.tsx       ← full lead detail UI
  dashboard/enterprise/page.tsx  ← Enterprise Command Center
  dashboard/reports/
    page.tsx                     ← server: fetches metrics + snapshots
    reports-client.tsx           ← Reports UI
  dashboard/settings/
    settings-client.tsx          ← Appearance / CRM Setup / License tabs
  dashboard/emails/page.tsx
  dashboard/videos/editor/
  user-dashboard/                ← client portal (overview, site builder, chat, profile)

components/
  crm-dashboard/crm-dashboard.tsx ← main dashboard shell + all sections
  leads/
    DashboardSidebar.tsx          ← role-gated nav + notification panel
    LeadsDashboard.tsx
    LeadsDashboard.module.css
  dashboard/
    UserNavLink.tsx               ← active-state nav link for user dashboard
  enterprise-suite/
    enterprise-command-center.tsx
    local-video-room.tsx

lib/
  actions/
    lead-actions.ts              ← createLead, updateLeadFields, scheduleLeadAction, setDoNotContact
    email-actions.ts             ← sendEnterpriseEmail (Resend)
    video-actions.ts             ← uploadLeadVideo, saveVideoEditorProject
    enterprise-actions.ts        ← calendar events, tasks, notifications, report snapshots
    audit-actions.ts             ← logAuditEntry, getAuditLog (admin_audit_log)
    message-actions.ts           ← sendConversationReply
    settings-actions.ts          ← license management, admin prefs, CRM config
    reliability-actions.ts       ← withRetry, logAsyncActionFailure, async_action_failures
  security/
    security-events.ts           ← recordSecurityEvent, getSecurityEvents, security_events table

supabase/schema.sql              ← full schema — run this first
```

---

## License

Proprietary — all rights reserved by online2day Ltd.

## Support

- Technical: info@online2day.com
- Sales enquiries: sales@online2day.com
- Phone: +44 333 050 6098
