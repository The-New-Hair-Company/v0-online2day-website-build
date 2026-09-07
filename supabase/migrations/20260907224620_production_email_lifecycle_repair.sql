-- Complete the Resend lifecycle: atomically ingest inbound messages, retain the
-- provider Message-ID used for RFC reply threading, and make attachment retries
-- observable/idempotent. These additions preserve all existing RLS policies.

alter table public.emails
  add column if not exists inbound_attachments_processed_at timestamptz,
  add column if not exists inbound_attachment_error_count integer not null default 0;

do $$ begin
  alter table public.emails
    add constraint emails_inbound_attachment_error_count_check
    check (inbound_attachment_error_count >= 0);
exception when duplicate_object then null; end $$;

alter table public.email_attachments
  add column if not exists provider_attachment_id text;

create unique index if not exists email_attachments_provider_attachment_uidx
  on public.email_attachments (email_id, provider_attachment_id)
  where provider_attachment_id is not null;

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
  provider_message_id text := nullif(trim(coalesce(p_metadata ->> 'messageId', '')), '');
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
    message_id = coalesce(message_id, provider_message_id),
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

create or replace function public.register_inbound_email(
  p_provider text,
  p_provider_event_id text,
  p_provider_email_id text,
  p_provider_message_id text,
  p_mailbox_owner_id uuid,
  p_occurred_at timestamptz,
  p_message jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.emails%rowtype;
  parent_email_id uuid;
  target_thread_id uuid;
  created_email_id uuid;
  reply_ids text[] := array(
    select value
    from jsonb_array_elements_text(coalesce(p_message -> 'replyCandidates', '[]'::jsonb)) value
    where length(value) between 1 and 998
    limit 100
  );
  inbound_received_at timestamptz := coalesce(p_occurred_at, now());
begin
  if p_provider !~ '^[a-z0-9_-]{1,40}$'
     or length(p_provider_event_id) not between 1 and 200
     or length(p_provider_email_id) not between 1 and 200
     or p_mailbox_owner_id is null then
    raise exception 'Invalid inbound email identifiers';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider || ':' || p_provider_email_id, 0));

  select * into existing
  from public.emails
  where provider_id = p_provider_email_id
  limit 1
  for update;

  if existing.id is not null then
    insert into public.email_provider_events (provider, provider_event_id, email_id, event_type, occurred_at, metadata)
    values (p_provider, p_provider_event_id, existing.id, 'email.received', inbound_received_at,
      jsonb_build_object('providerEmailId', p_provider_email_id, 'messageId', p_provider_message_id))
    on conflict (provider, provider_event_id) do nothing;
    return jsonb_build_object(
      'id', existing.id,
      'threadId', existing.thread_id,
      'duplicate', true,
      'attachmentsProcessed', existing.inbound_attachments_processed_at is not null
    );
  end if;

  if cardinality(reply_ids) > 0 then
    select e.id, e.thread_id into parent_email_id, target_thread_id
    from public.emails e
    where e.mailbox_owner_id = p_mailbox_owner_id
      and e.message_id = any(reply_ids)
      and e.thread_id is not null
    order by e.created_at desc
    limit 1
    for update;
  end if;

  if target_thread_id is null then
    insert into public.email_threads (
      mailbox_owner_id, subject, normalized_subject, participant_addresses,
      last_message_at, unread_count, message_count, folder
    ) values (
      p_mailbox_owner_id,
      left(coalesce(p_message ->> 'subject', '(No subject)'), 300),
      left(coalesce(p_message ->> 'normalizedSubject', ''), 300),
      coalesce(p_message -> 'participants', '[]'::jsonb),
      inbound_received_at, 1, 0, 'inbox'
    ) returning id into target_thread_id;
  end if;

  insert into public.emails (
    mailbox_owner_id, thread_id, direction, provider_id, message_id,
    in_reply_to, reference_ids, from_address, from_name, to_addresses,
    cc_addresses, bcc_addresses, reply_to_addresses, subject, body,
    plain_body, html_body, sanitised_html_body, headers, status, folder,
    is_read, read_at, sent_at, received_at
  ) values (
    p_mailbox_owner_id, target_thread_id, 'inbound', p_provider_email_id,
    nullif(trim(p_provider_message_id), ''), nullif(trim(p_message ->> 'inReplyTo'), ''),
    reply_ids, lower(left(coalesce(p_message ->> 'fromAddress', ''), 254)),
    left(coalesce(p_message ->> 'fromName', ''), 300),
    coalesce(p_message -> 'to', '[]'::jsonb),
    coalesce(p_message -> 'cc', '[]'::jsonb),
    coalesce(p_message -> 'bcc', '[]'::jsonb),
    coalesce(p_message -> 'replyTo', '[]'::jsonb),
    left(coalesce(p_message ->> 'subject', '(No subject)'), 300),
    coalesce(p_message ->> 'plainBody', ''),
    coalesce(p_message ->> 'plainBody', ''),
    coalesce(p_message ->> 'htmlBody', ''),
    coalesce(p_message ->> 'sanitisedHtmlBody', ''),
    coalesce(p_message -> 'headers', '{}'::jsonb),
    'received', 'inbox', false, null, null, inbound_received_at
  ) returning id into created_email_id;

  if parent_email_id is not null then
    update public.emails
    set replied_at = coalesce(replied_at, inbound_received_at), updated_at = now()
    where id = parent_email_id;
  end if;

  update public.email_threads t
  set last_message_at = inbound_received_at,
      message_count = (select count(*) from public.emails e where e.thread_id = t.id),
      unread_count = (select count(*) from public.emails e where e.thread_id = t.id and e.folder = 'inbox' and not e.is_read),
      folder = 'inbox',
      updated_at = now()
  where t.id = target_thread_id;

  insert into public.email_provider_events (provider, provider_event_id, email_id, event_type, occurred_at, metadata)
  values (p_provider, p_provider_event_id, created_email_id, 'email.received', inbound_received_at,
    jsonb_build_object('providerEmailId', p_provider_email_id, 'messageId', p_provider_message_id))
  on conflict (provider, provider_event_id) do nothing;

  return jsonb_build_object(
    'id', created_email_id,
    'threadId', target_thread_id,
    'duplicate', false,
    'attachmentsProcessed', false
  );
end;
$$;

revoke all on function public.register_inbound_email(text,text,text,text,uuid,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.register_inbound_email(text,text,text,text,uuid,timestamptz,jsonb) to service_role;
