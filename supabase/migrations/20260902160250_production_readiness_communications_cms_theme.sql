-- Production readiness: durable theme tokens, complete provider tracking,
-- private multi-channel conversations, and CMS publishing states.

create extension if not exists pgcrypto;

create table if not exists public.api_rate_limit_buckets (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);
alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_rate_limit(p_key_hash text, p_window_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket public.api_rate_limit_buckets%rowtype;
  current_time timestamptz := clock_timestamp();
  window_interval interval;
  ttl_ms integer;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$' or p_window_ms not between 1000 and 86400000 then
    raise exception 'Invalid rate limit parameters';
  end if;
  window_interval := make_interval(secs => p_window_ms::double precision / 1000.0);
  insert into public.api_rate_limit_buckets (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, current_time, 1, current_time)
  on conflict (key_hash) do update set
    window_started_at = case when api_rate_limit_buckets.window_started_at + window_interval <= current_time then current_time else api_rate_limit_buckets.window_started_at end,
    request_count = case when api_rate_limit_buckets.window_started_at + window_interval <= current_time then 1 else api_rate_limit_buckets.request_count + 1 end,
    updated_at = current_time
  returning * into bucket;
  ttl_ms := greatest(1, least(p_window_ms, ceil(extract(epoch from ((bucket.window_started_at + window_interval) - current_time)) * 1000)::integer));
  return jsonb_build_object('current', bucket.request_count, 'ttl', ttl_ms);
end;
$$;
revoke all on function public.consume_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text,integer) to service_role;

-- One public, server-managed branding record. Values are validated again in
-- the Azure API before writes; the JSON check prevents invalid root shapes.
create table if not exists public.site_branding (
  id boolean primary key default true check (id),
  light_tokens jsonb not null default '{"background":"#f4f7fb","surface":"#ffffff","surfaceAlt":"#eef3fb","text":"#111827","muted":"#526070","primary":"#2563eb","primaryText":"#ffffff","primaryHover":"#1d4ed8","border":"#cbd5e1"}'::jsonb check (jsonb_typeof(light_tokens) = 'object'),
  dark_tokens jsonb not null default '{"background":"#05070b","surface":"#0d121c","surfaceAlt":"#0a101b","text":"#f7f9ff","muted":"#8f98aa","primary":"#2f6bff","primaryText":"#ffffff","primaryHover":"#4d86ff","border":"#273247"}'::jsonb check (jsonb_typeof(dark_tokens) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_branding (id) values (true) on conflict (id) do nothing;

alter table public.site_branding enable row level security;
drop policy if exists "Public read site branding" on public.site_branding;
drop policy if exists "Admins insert site branding" on public.site_branding;
drop policy if exists "Admins update site branding" on public.site_branding;
create policy "Public read site branding" on public.site_branding
  for select to anon, authenticated using (id = true);
create policy "Admins insert site branding" on public.site_branding
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update site branding" on public.site_branding
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.site_branding to anon, authenticated;
grant insert, update on public.site_branding to authenticated;

-- Provider engagement is retained per event, with useful denormalised fields
-- for fast dashboard metrics.
alter table public.emails
  add column if not exists delivered_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists open_count integer not null default 0 check (open_count >= 0),
  add column if not exists click_count integer not null default 0 check (click_count >= 0),
  add column if not exists bounced_at timestamptz,
  add column if not exists failed_at timestamptz;

create or replace function public.record_email_provider_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_email_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.emails%rowtype;
  inserted_id uuid;
  first_open boolean;
  first_click boolean;
  next_state text := replace(p_event_type, 'email.', '');
  current_state text;
  current_rank integer;
  next_rank integer;
begin
  if p_provider !~ '^[a-z0-9_-]{1,40}$'
     or length(p_provider_event_id) not between 1 and 200
     or length(p_provider_email_id) not between 1 and 160 then
    raise exception 'Invalid provider event identifiers';
  end if;

  select * into target
  from public.emails
  where provider_id = p_provider_email_id
     or status like ('%:' || p_provider_email_id)
  order by (provider_id = p_provider_email_id) desc, created_at desc
  limit 1
  for update;

  if target.id is null then
    return jsonb_build_object('matched', false, 'processed', false);
  end if;

  insert into public.email_provider_events (
    provider, provider_event_id, email_id, event_type, occurred_at, metadata
  ) values (
    p_provider, p_provider_event_id, target.id, p_event_type,
    coalesce(p_occurred_at, now()), coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, provider_event_id) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    return jsonb_build_object('matched', true, 'processed', false, 'emailId', target.id);
  end if;

  first_open := p_event_type = 'email.opened' and target.opened_at is null;
  first_click := p_event_type = 'email.clicked' and target.clicked_at is null;
  current_state := split_part(coalesce(target.status, 'sent'), ':', 1);
  current_rank := case current_state
    when 'sent' then 0 when 'delivered' then 1 when 'delivery_delayed' then 1
    when 'opened' then 2 when 'clicked' then 3 else 4 end;
  next_rank := case next_state
    when 'sent' then 0 when 'delivered' then 1 when 'delivery_delayed' then 1
    when 'opened' then 2 when 'clicked' then 3 else 4 end;

  update public.emails set
    provider_id = coalesce(provider_id, p_provider_email_id),
    status = case when next_rank >= current_rank then next_state || ':' || p_provider_email_id else status end,
    delivered_at = case when p_event_type = 'email.delivered' then coalesce(delivered_at, p_occurred_at, now()) else delivered_at end,
    opened_at = case when p_event_type = 'email.opened' then coalesce(opened_at, p_occurred_at, now()) else opened_at end,
    last_opened_at = case when p_event_type = 'email.opened' then greatest(coalesce(last_opened_at, '-infinity'::timestamptz), coalesce(p_occurred_at, now())) else last_opened_at end,
    open_count = open_count + case when p_event_type = 'email.opened' then 1 else 0 end,
    clicked_at = case when p_event_type = 'email.clicked' then coalesce(clicked_at, p_occurred_at, now()) else clicked_at end,
    click_count = click_count + case when p_event_type = 'email.clicked' then 1 else 0 end,
    bounced_at = case when p_event_type = 'email.bounced' then coalesce(bounced_at, p_occurred_at, now()) else bounced_at end,
    failed_at = case when p_event_type in ('email.failed','email.suppressed') then coalesce(failed_at, p_occurred_at, now()) else failed_at end,
    updated_at = now()
  where id = target.id;

  if target.template_id is not null and (first_open or first_click) then
    update public.email_templates set
      open_count = greatest(0, coalesce(open_count, 0)) + case when first_open then 1 else 0 end,
      click_count = greatest(0, coalesce(click_count, 0)) + case when first_click then 1 else 0 end,
      updated_at = now()
    where id = target.template_id;
  end if;

  return jsonb_build_object('matched', true, 'processed', true, 'emailId', target.id);
end;
$$;
revoke all on function public.record_email_provider_event(text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.record_email_provider_event(text,text,text,text,timestamptz,jsonb) to service_role;

create or replace function public.record_conversation_activity(
  p_conversation_id uuid,
  p_preview text,
  p_increment_unread boolean default false,
  p_activity_at timestamptz default now()
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversations
  set unread_count = case when p_increment_unread then greatest(0, coalesce(unread_count, 0)) + 1 else unread_count end,
      last_message_preview = left(p_preview, 120),
      last_message_at = p_activity_at,
      updated_at = now()
  where id = p_conversation_id;
$$;
revoke all on function public.record_conversation_activity(uuid,text,boolean,timestamptz) from public, anon, authenticated;
grant execute on function public.record_conversation_activity(uuid,text,boolean,timestamptz) to service_role;

-- Conversation records now support website visitors, licensed-account peers,
-- and external messaging providers without exposing provider secrets.
alter table public.messages
  alter column conversation_user_id drop not null,
  alter column sender_id drop not null,
  add column if not exists recipient_id uuid references auth.users(id) on delete set null,
  add column if not exists sender_type text not null default 'user',
  add column if not exists channel text not null default 'web',
  add column if not exists delivery_status text not null default 'sent',
  add column if not exists external_provider_id text,
  add column if not exists external_status text,
  add column if not exists attachment_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.messages add constraint messages_sender_type_check
    check (sender_type in ('visitor','user','agent','system','provider'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.messages add constraint messages_channel_check
    check (channel in ('web','internal','email','whatsapp','support'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.messages add constraint messages_delivery_status_check
    check (delivery_status in ('queued','sent','delivered','read','failed'));
exception when duplicate_object then null; end $$;

alter table public.conversations
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists external_provider_id text,
  add column if not exists participant_key text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_conversations_participant_key
  on public.conversations(participant_key) where participant_key is not null;

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null default 'member' check (participant_role in ('member','support','owner')),
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.visitor_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  visitor_name text not null,
  visitor_email text,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.communication_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists idx_conversation_participants_user
  on public.conversation_participants(user_id, conversation_id);
create index if not exists idx_messages_conversation_created
  on public.messages(conversation_id, created_at);
create index if not exists idx_messages_recipient_unread
  on public.messages(recipient_id, is_read, created_at desc) where recipient_id is not null and is_read = false;
create unique index if not exists idx_messages_external_provider
  on public.messages(channel, external_provider_id) where external_provider_id is not null;
create index if not exists idx_visitor_sessions_expiry
  on public.visitor_chat_sessions(expires_at);

alter table public.conversation_participants enable row level security;
alter table public.visitor_chat_sessions enable row level security;
alter table public.communication_provider_events enable row level security;

drop policy if exists "Participants read memberships" on public.conversation_participants;
create policy "Participants read memberships" on public.conversation_participants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Visitor session tokens are verified only by the server/service role.
revoke all on public.visitor_chat_sessions from anon, authenticated;
revoke all on public.communication_provider_events from anon, authenticated;
grant select on public.conversation_participants to authenticated;

drop policy if exists "Users can read own conversation" on public.messages;
drop policy if exists "Users can insert own messages" on public.messages;
drop policy if exists "Admins can update messages" on public.messages;
create policy "Workspace participants read messages" on public.messages
  for select to authenticated using (
    conversation_user_id = (select auth.uid())
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
        and cp.user_id = (select auth.uid())
    )
    or (select public.is_admin())
  );
create policy "Workspace participants send messages" on public.messages
  for insert to authenticated with check (
    (
      sender_id = (select auth.uid())
      and (
        conversation_user_id = (select auth.uid())
        or exists (
          select 1 from public.conversation_participants cp
          where cp.conversation_id = messages.conversation_id
            and cp.user_id = (select auth.uid())
        )
      )
    )
    or (select public.is_admin())
  );
create policy "Recipients update message read state" on public.messages
  for update to authenticated
  using (
    conversation_user_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (select public.is_admin())
  )
  with check (
    conversation_user_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or (select public.is_admin())
  );

drop policy if exists o2d_authenticated_select on public.conversations;
drop policy if exists o2d_authenticated_insert on public.conversations;
drop policy if exists o2d_authenticated_update on public.conversations;
drop policy if exists o2d_authenticated_delete on public.conversations;
create policy o2d_authenticated_select on public.conversations
  for select to authenticated using (
    (select public.is_admin())
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = (select auth.uid())
    )
  );
create policy o2d_authenticated_insert on public.conversations
  for insert to authenticated with check (
    (select public.is_admin())
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
  );
create policy o2d_authenticated_update on public.conversations
  for update to authenticated using (
    (select public.is_admin())
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = (select auth.uid())
    )
  ) with check (
    (select public.is_admin())
    or assigned_to = (select auth.uid())
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = (select auth.uid())
    )
  );
create policy o2d_authenticated_delete on public.conversations
  for delete to authenticated using ((select public.is_admin()));

-- CMS publishing lifecycle and managed media.
alter table public.blog_posts
  add column if not exists publish_status text not null default 'draft',
  add column if not exists scheduled_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists canonical_url text,
  add column if not exists focus_keyword text,
  add column if not exists og_image_url text,
  add column if not exists cover_alt_text text,
  add column if not exists og_title text,
  add column if not exists og_description text,
  add column if not exists noindex boolean not null default false,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.blog_posts
set publish_status = case when published then 'published' else 'draft' end
where publish_status = 'draft';

do $$ begin
  alter table public.blog_posts add constraint blog_posts_publish_status_check
    check (publish_status in ('draft','scheduled','published','archived'));
exception when duplicate_object then null; end $$;

create table if not exists public.blog_slug_redirects (
  old_slug text primary key,
  post_id uuid not null references public.blog_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint blog_slug_redirects_old_slug_format check (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

alter table public.blog_slug_redirects enable row level security;
drop policy if exists o2d_public_select on public.blog_slug_redirects;
drop policy if exists o2d_admin_insert on public.blog_slug_redirects;
drop policy if exists o2d_admin_update on public.blog_slug_redirects;
drop policy if exists o2d_admin_delete on public.blog_slug_redirects;
create policy o2d_public_select on public.blog_slug_redirects
  for select to anon, authenticated using (
    exists (
      select 1 from public.blog_posts post
      where post.id = blog_slug_redirects.post_id
        and post.published = true
        and post.published_at <= now()
    )
  );
create policy o2d_admin_insert on public.blog_slug_redirects
  for insert to authenticated with check ((select public.is_admin()));
create policy o2d_admin_update on public.blog_slug_redirects
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy o2d_admin_delete on public.blog_slug_redirects
  for delete to authenticated using ((select public.is_admin()));

grant select on public.blog_slug_redirects to anon, authenticated;
grant insert, update, delete on public.blog_slug_redirects to authenticated;

create or replace function public.capture_blog_slug_redirect()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.slug is distinct from new.slug then
    insert into public.blog_slug_redirects (old_slug, post_id)
    values (old.slug, new.id)
    on conflict (old_slug) do update set post_id = excluded.post_id, created_at = now();
    delete from public.blog_slug_redirects where old_slug = new.slug and post_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_blog_slug_redirect on public.blog_posts;
create trigger capture_blog_slug_redirect
  after update of slug on public.blog_posts
  for each row execute function public.capture_blog_slug_redirect();
revoke all on function public.capture_blog_slug_redirect() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-media', 'blog-media', true, 10485760, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
