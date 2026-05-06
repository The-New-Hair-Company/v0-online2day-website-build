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
- **Site Requests** — inbound project request pipeline
- **Integrations** — Supabase, Resend, HubSpot status cards
- **Settings** — user profile, password change, notification preferences

### Auth
- Sign-up, login, password reset, magic link
- Sign-out — POST `/auth/signout` (wired in both sidebars)

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
| `activity_feed` | Global activity stream shown on Overview |
| `enterprise_events` | Calendar entries (from scheduling on lead detail + direct Enterprise page) |
| `enterprise_tasks` | Task checklist items on Enterprise page |
| `enterprise_features` | Enabled feature flags for the Enterprise Command Center |
| `conversations` | Inbound chat conversations |
| `messages` | Per-conversation messages |
| `video_assets` | Uploaded video records linked to leads |
| `site_requests` | Inbound website build requests |
| `audit_log` | GDPR audit trail — action, resource, resource_id, changes, user_id |
| `user_profiles` | Extended user info — full_name, email (used for note author display) |
| `email_templates` | Email template records shown in the Emails section |

---

## Remaining Backend Tasks

The following features have UI built but need backend plumbing before they are fully live in production.

### 1. `user_profiles` table
The lead notes panel shows who wrote each note via `creator_name`. This requires a `user_profiles` table:

```sql
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz default now()
);
alter table public.user_profiles enable row level security;
create policy "Users can read all profiles" on public.user_profiles for select using (true);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = user_id);
```

Populate it via a Supabase Auth trigger:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (user_id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

### 2. `enterprise_events` table
Scheduled callbacks and follow-ups from the lead detail page write to `enterprise_events`. Ensure this table exists and the Enterprise Calendar reads from it:

```sql
create table public.enterprise_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_time text,
  event_type text,
  owner text,
  created_at timestamptz default now()
);
alter table public.enterprise_events enable row level security;
create policy "Authenticated users can manage events"
  on public.enterprise_events for all using (auth.role() = 'authenticated');
```

### 3. Resend email sending
`sendEnterpriseEmail` in `lib/actions/email-actions.ts` sends via Resend. Requires:
- `RESEND_API_KEY` env var set in Vercel
- A verified sending domain in the Resend dashboard (currently defaults to `noreply@online2day.com`)
- The `lead_events` table must accept `type = 'Email Sent'` inserts (no enum constraint)

### 4. Video upload storage bucket
`uploadLeadVideo` in `lib/actions/video-actions.ts` uploads to Supabase Storage. Requires:
- A public bucket named `lead-videos` created in Supabase Storage
- RLS policy allowing authenticated uploads:

```sql
create policy "Authenticated users can upload videos"
  on storage.objects for insert
  with check (bucket_id = 'lead-videos' and auth.role() = 'authenticated');
create policy "Public read on lead-videos"
  on storage.objects for select
  using (bucket_id = 'lead-videos');
```

### 5. HubSpot contact sync
`lib/actions/hubspot-actions.ts` posts contacts to HubSpot on form submit. Requires:
- `HUBSPOT_PRIVATE_APP_TOKEN` env var set in Vercel
- A HubSpot Private App created with `crm.objects.contacts.write` scope

### 6. Features gated with "Contact sales to add this"
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

### 7. Row Level Security
All production tables should have RLS enabled. Key policies needed:

```sql
-- leads
create policy "Auth users can read own leads"
  on public.leads for select using (auth.role() = 'authenticated');
create policy "Auth users can insert leads"
  on public.leads for insert with check (auth.role() = 'authenticated');
create policy "Auth users can update own leads"
  on public.leads for update using (auth.role() = 'authenticated');

-- lead_events (same pattern)
-- audit_log (insert-only for authenticated)
-- activity_feed (insert + select for authenticated)
```

### 8. Messages / conversations
The Messages section reads from `conversations` + `messages` tables. Ensure:
- Both tables exist per schema
- `sendConversationReply` in `lib/actions/message-actions.ts` is configured
- The public chat widget (`/contact` GuidedChat) posts to the same `conversations` table if real-time escalation is needed

### 9. Role-aware access should move from heuristics to DB-backed RBAC
Current sidebar gating now reads `permission_matrix` and user context, but production-grade access should be explicit per user/team:
- Add a table such as `team_memberships` or `user_roles` with role enum and tenant/workspace id
- Enforce route-level authorization from DB roles (not email-name heuristics)
- Add policy tests to confirm every `/dashboard/*` route has server-side permission checks

### 10. Notifications should be promoted to first-class relational tables
Notifications currently persist through `enterprise_state` for speed. For scale and auditability:
- Add `notifications` table (`id`, `user_id`, `title`, `detail`, `created_at`, `read_at`, `source`, `severity`)
- Add indexes on `(user_id, created_at desc)` and `(user_id, read_at)`
- Add server action endpoints for pagination, mark-read batch, and retention cleanup

### 11. Reporting pipeline should support scheduled snapshots
Reports now compute live. For executive reporting and trend integrity:
- Add `report_snapshots` table with daily/weekly aggregates
- Add scheduled jobs (Supabase cron/Edge Function) to materialize key KPI snapshots
- Add export audit rows for every CSV/JSON report download (who exported what, when)

### 12. Add reliability instrumentation around async actions
For enterprise supportability:
- Add structured error logging (action name, user id, payload hash, error code)
- Add retry/backoff wrappers for storage, email, and third-party requests
- Add dead-letter / failed-job queue table for recoverable async failures

### 13. Add integration health checks with stored history
Integrations page should include historical uptime and last-check evidence:
- Add `integration_health_checks` table (`provider`, `status`, `latency_ms`, `checked_at`, `detail`)
- Run scheduled checks for Supabase, Resend, HubSpot
- Surface degradation alerts into notifications feed

### 14. Security + performance hardening follow-ups (new)
The following should be completed on the backend/infra side to complement the latest app-level hardening:

- Add a real rate-limit layer for API endpoints (`/api/track/view`, `/api/download-agreements`) using Edge middleware, Redis, or Vercel KV-based token buckets.
- Introduce CSP with nonces/hashes and remove inline script dependencies over time (current layout still relies on inline bootstrap script).
- Add server-side request logging + alerting for repeated invalid UUID requests and failed auth attempts.
- Move agreement export generation to a queued background job for large exports (avoid synchronous request-time rendering under heavy load).
- Add E2E security tests for XSS regression in export templates and for safe external link opening behavior.

---

## Project Structure (key paths)

```
app/
  auth/signout/route.ts          ← POST sign-out handler
  dashboard/leads/[id]/
    page.tsx                     ← server: fetches lead + events
    lead-detail-client.tsx       ← full lead detail UI
  dashboard/enterprise/page.tsx  ← Enterprise Command Center
  dashboard/emails/page.tsx
  dashboard/videos/editor/

components/
  crm-dashboard/crm-dashboard.tsx ← main dashboard shell + all sections
  leads/
    DashboardSidebar.tsx
    LeadsDashboard.tsx
    LeadsDashboard.module.css    ← all lead detail CSS
  enterprise-suite/
    enterprise-command-center.tsx
    local-video-room.tsx

lib/
  actions/
    lead-actions.ts              ← createLead, updateLeadFields, scheduleLeadAction, setDoNotContact
    email-actions.ts             ← sendEnterpriseEmail (Resend)
    video-actions.ts             ← uploadLeadVideo, saveVideoEditorProject
    enterprise-actions.ts        ← calendar events, tasks, feature flags, data quality scan
    audit-actions.ts             ← logAuditEntry, getAuditLog
    message-actions.ts           ← sendConversationReply

supabase/schema.sql              ← full schema — run this first
```

---

## License

Proprietary — all rights reserved by online2day Ltd.

## Support

- Technical: info@online2day.com
- Sales enquiries: sales@online2day.com
- Phone: +44 333 050 6098
