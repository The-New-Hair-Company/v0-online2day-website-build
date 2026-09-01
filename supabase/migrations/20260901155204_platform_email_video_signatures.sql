-- Online2Day platform mail, documents, signatures, video branding and media jobs.
-- Existing sent-email and video records remain valid; new columns have safe defaults.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated, service_role;

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(),
  mailbox_owner_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  subject text not null default '',
  normalized_subject text not null default '',
  participant_addresses jsonb not null default '[]'::jsonb,
  last_message_at timestamptz not null default now(),
  unread_count integer not null default 0 check (unread_count >= 0),
  message_count integer not null default 0 check (message_count >= 0),
  folder text not null default 'inbox' check (folder in ('inbox','sent','drafts','trash','archive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emails
  add column if not exists mailbox_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists thread_id uuid references public.email_threads(id) on delete set null,
  add column if not exists direction text not null default 'outbound',
  add column if not exists provider_id text,
  add column if not exists message_id text,
  add column if not exists in_reply_to text,
  add column if not exists reference_ids text[] not null default '{}',
  add column if not exists from_address text,
  add column if not exists from_name text,
  add column if not exists to_addresses jsonb not null default '[]'::jsonb,
  add column if not exists cc_addresses jsonb not null default '[]'::jsonb,
  add column if not exists bcc_addresses jsonb not null default '[]'::jsonb,
  add column if not exists reply_to_addresses jsonb not null default '[]'::jsonb,
  add column if not exists plain_body text,
  add column if not exists html_body text,
  add column if not exists sanitised_html_body text,
  add column if not exists headers jsonb not null default '{}'::jsonb,
  add column if not exists is_read boolean not null default true,
  add column if not exists read_at timestamptz,
  add column if not exists folder text not null default 'sent',
  add column if not exists priority text not null default 'normal',
  add column if not exists scheduled_at timestamptz,
  add column if not exists received_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.emails add constraint emails_direction_check check (direction in ('inbound','outbound'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.emails add constraint emails_folder_check check (folder in ('inbox','sent','drafts','trash','archive'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.emails add constraint emails_priority_check check (priority in ('low','normal','high'));
exception when duplicate_object then null; end $$;

update public.emails
set mailbox_owner_id = sender_id,
    plain_body = coalesce(plain_body, body),
    from_address = coalesce(from_address, 'hello@online2day.com'),
    folder = case when status = 'draft' then 'drafts' else 'sent' end,
    is_read = true,
    read_at = coalesce(read_at, created_at)
where mailbox_owner_id is null and sender_id is not null;

create table if not exists public.platform_documents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  original_document_id uuid references public.platform_documents(id) on delete restrict,
  filename text not null,
  safe_filename text not null,
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  document_kind text not null default 'attachment' check (document_kind in ('attachment','signature_original','signature_completed')),
  page_count integer check (page_count is null or page_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_attachments (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.emails(id) on delete cascade,
  document_id uuid not null references public.platform_documents(id) on delete restrict,
  disposition text not null default 'attachment' check (disposition in ('attachment','inline')),
  content_id text,
  created_at timestamptz not null default now(),
  unique (email_id, document_id)
);

create table if not exists public.email_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  email_id uuid references public.emails(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.signature_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  document_id uuid not null references public.platform_documents(id) on delete restrict,
  completed_document_id uuid references public.platform_documents(id) on delete restrict,
  title text not null,
  message text not null default '',
  status text not null default 'draft' check (status in ('draft','sent','viewed','partially_signed','completed','declined','expired','cancelled')),
  document_version integer not null default 1 check (document_version > 0),
  expires_at timestamptz,
  sent_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signature_recipients (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  signing_order integer not null default 1 check (signing_order > 0),
  name text not null,
  email text not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','sent','viewed','signed','declined','expired','cancelled')),
  viewed_at timestamptz,
  signed_at timestamptz,
  declined_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signature_fields (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  recipient_id uuid not null references public.signature_recipients(id) on delete cascade,
  field_type text not null check (field_type in ('signature','date','name','text')),
  page_number integer not null check (page_number > 0),
  x numeric(8,6) not null check (x >= 0 and x <= 1),
  y numeric(8,6) not null check (y >= 0 and y <= 1),
  width numeric(8,6) not null check (width > 0 and width <= 1),
  height numeric(8,6) not null check (height > 0 and height <= 1),
  required boolean not null default true,
  label text not null default '',
  value text,
  signature_method text check (signature_method is null or signature_method in ('typed','drawn','uploaded')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.signature_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.signature_requests(id) on delete cascade,
  recipient_id uuid references public.signature_recipients(id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('sender','recipient','system')),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email text,
  ip_hash text,
  user_agent_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.video_branding_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Default video branding',
  intro_enabled boolean not null default false,
  intro_storage_path text,
  intro_filename text,
  intro_mime_type text,
  intro_size_bytes bigint,
  intro_duration_seconds numeric(10,3),
  intro_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.media_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  video_asset_id uuid not null references public.lead_assets(id) on delete cascade,
  operation text not null default 'render' check (operation in ('render','trim','compose')),
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  instructions jsonb not null default '{}'::jsonb,
  output_storage_path text,
  output_mime_type text,
  output_size_bytes bigint,
  progress integer not null default 0 check (progress between 0 and 100),
  error_code text,
  error_message text,
  attempts integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_threads_owner_last on public.email_threads(mailbox_owner_id, last_message_at desc);
create index if not exists idx_email_threads_owner_unread on public.email_threads(mailbox_owner_id, unread_count) where unread_count > 0;
create index if not exists idx_emails_owner_folder_time on public.emails(mailbox_owner_id, folder, coalesce(received_at, sent_at, created_at) desc);
create index if not exists idx_emails_thread_time on public.emails(thread_id, coalesce(received_at, sent_at, created_at));
create unique index if not exists idx_emails_provider_id on public.emails(provider_id) where provider_id is not null;
create unique index if not exists idx_emails_message_id on public.emails(message_id) where message_id is not null;
create index if not exists idx_emails_owner_unread on public.emails(mailbox_owner_id, is_read) where is_read = false and deleted_at is null;
create index if not exists idx_documents_owner_created on public.platform_documents(owner_user_id, created_at desc);
create index if not exists idx_signature_requests_owner_status on public.signature_requests(owner_user_id, status, created_at desc);
create index if not exists idx_signature_fields_request_page on public.signature_fields(request_id, page_number);
create index if not exists idx_signature_events_request_time on public.signature_events(request_id, created_at);
create index if not exists idx_media_jobs_status_created on public.media_processing_jobs(status, created_at) where status in ('queued','processing');
create index if not exists idx_media_jobs_asset_created on public.media_processing_jobs(video_asset_id, created_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('platform-documents', 'platform-documents', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('video-branding', 'video-branding', false, 262144000, array['video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

alter table public.email_threads enable row level security;
alter table public.platform_documents enable row level security;
alter table public.email_attachments enable row level security;
alter table public.email_provider_events enable row level security;
alter table public.signature_requests enable row level security;
alter table public.signature_recipients enable row level security;
alter table public.signature_fields enable row level security;
alter table public.signature_events enable row level security;
alter table public.video_branding_profiles enable row level security;
alter table public.media_processing_jobs enable row level security;

drop policy if exists "Users can view all emails" on public.emails;
drop policy if exists "Users can insert emails" on public.emails;
drop policy if exists "Users can update emails" on public.emails;
drop policy if exists "Users can delete emails" on public.emails;
create policy "Mailbox users read emails" on public.emails for select to authenticated using (mailbox_owner_id = (select auth.uid()) or sender_id = (select auth.uid()) or public.is_admin());
create policy "Mailbox users insert emails" on public.emails for insert to authenticated with check (mailbox_owner_id = (select auth.uid()) or sender_id = (select auth.uid()) or public.is_admin());
create policy "Mailbox users update emails" on public.emails for update to authenticated using (mailbox_owner_id = (select auth.uid()) or sender_id = (select auth.uid()) or public.is_admin()) with check (mailbox_owner_id = (select auth.uid()) or sender_id = (select auth.uid()) or public.is_admin());
create policy "Mailbox users delete emails" on public.emails for delete to authenticated using (mailbox_owner_id = (select auth.uid()) or sender_id = (select auth.uid()) or public.is_admin());

create policy "Mailbox users manage threads" on public.email_threads for all to authenticated using (mailbox_owner_id = (select auth.uid()) or public.is_admin()) with check (mailbox_owner_id = (select auth.uid()) or public.is_admin());
create policy "Owners manage documents" on public.platform_documents for all to authenticated using (owner_user_id = (select auth.uid()) or public.is_admin()) with check (owner_user_id = (select auth.uid()) or public.is_admin());
create policy "Owners manage email attachments" on public.email_attachments for all to authenticated using (exists (select 1 from public.emails e where e.id = email_id and (e.mailbox_owner_id = (select auth.uid()) or e.sender_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.emails e where e.id = email_id and (e.mailbox_owner_id = (select auth.uid()) or e.sender_id = (select auth.uid()) or public.is_admin())));
create policy "Owners read email events" on public.email_provider_events for select to authenticated using (exists (select 1 from public.emails e where e.id = email_id and (e.mailbox_owner_id = (select auth.uid()) or e.sender_id = (select auth.uid()) or public.is_admin())));
create policy "Owners manage signature requests" on public.signature_requests for all to authenticated using (owner_user_id = (select auth.uid()) or public.is_admin()) with check (owner_user_id = (select auth.uid()) or public.is_admin());
create policy "Owners manage signature recipients" on public.signature_recipients for all to authenticated using (exists (select 1 from public.signature_requests r where r.id = request_id and (r.owner_user_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.signature_requests r where r.id = request_id and (r.owner_user_id = (select auth.uid()) or public.is_admin())));
create policy "Owners manage signature fields" on public.signature_fields for all to authenticated using (exists (select 1 from public.signature_requests r where r.id = request_id and (r.owner_user_id = (select auth.uid()) or public.is_admin()))) with check (exists (select 1 from public.signature_requests r where r.id = request_id and (r.owner_user_id = (select auth.uid()) or public.is_admin())));
create policy "Owners read signature events" on public.signature_events for select to authenticated using (exists (select 1 from public.signature_requests r where r.id = request_id and (r.owner_user_id = (select auth.uid()) or public.is_admin())));
create policy "Owners manage video branding" on public.video_branding_profiles for all to authenticated using (owner_user_id = (select auth.uid()) or public.is_admin()) with check (owner_user_id = (select auth.uid()) or public.is_admin());
create policy "Owners read media jobs" on public.media_processing_jobs for select to authenticated using (owner_user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "Authenticated users can upload platform documents" on storage.objects;
create policy "Authenticated users can upload platform documents" on storage.objects for insert to authenticated with check (bucket_id = 'platform-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Authenticated users can read platform documents" on storage.objects;
create policy "Authenticated users can read platform documents" on storage.objects for select to authenticated using (bucket_id = 'platform-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "Authenticated users can update platform documents" on storage.objects;
create policy "Authenticated users can update platform documents" on storage.objects for update to authenticated using (bucket_id = 'platform-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())) with check (bucket_id = 'platform-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));
drop policy if exists "Authenticated users can delete platform documents" on storage.objects;
create policy "Authenticated users can delete platform documents" on storage.objects for delete to authenticated using (bucket_id = 'platform-documents' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()));

drop policy if exists "Admins manage video branding" on storage.objects;
create policy "Admins manage video branding" on storage.objects for all to authenticated using (bucket_id = 'video-branding' and public.is_admin()) with check (bucket_id = 'video-branding' and public.is_admin());

drop trigger if exists set_email_threads_updated_at on public.email_threads;
create trigger set_email_threads_updated_at before update on public.email_threads for each row execute function public.set_updated_at();
drop trigger if exists set_emails_updated_at on public.emails;
create trigger set_emails_updated_at before update on public.emails for each row execute function public.set_updated_at();
drop trigger if exists set_platform_documents_updated_at on public.platform_documents;
create trigger set_platform_documents_updated_at before update on public.platform_documents for each row execute function public.set_updated_at();
drop trigger if exists set_signature_requests_updated_at on public.signature_requests;
create trigger set_signature_requests_updated_at before update on public.signature_requests for each row execute function public.set_updated_at();
drop trigger if exists set_signature_recipients_updated_at on public.signature_recipients;
create trigger set_signature_recipients_updated_at before update on public.signature_recipients for each row execute function public.set_updated_at();
drop trigger if exists set_signature_fields_updated_at on public.signature_fields;
create trigger set_signature_fields_updated_at before update on public.signature_fields for each row execute function public.set_updated_at();
drop trigger if exists set_video_branding_updated_at on public.video_branding_profiles;
create trigger set_video_branding_updated_at before update on public.video_branding_profiles for each row execute function public.set_updated_at();
drop trigger if exists set_media_jobs_updated_at on public.media_processing_jobs;
create trigger set_media_jobs_updated_at before update on public.media_processing_jobs for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.email_threads, public.platform_documents, public.email_attachments, public.signature_requests, public.signature_recipients, public.signature_fields, public.video_branding_profiles to authenticated;
grant select on public.email_provider_events, public.signature_events, public.media_processing_jobs to authenticated;
