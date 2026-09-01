-- The gateway authenticates to PostgREST as service_role. Explicit grants are
-- still required for tables created by migrations, even though service_role
-- bypasses row-level policies.
grant select, insert, update, delete on table
  public.email_threads,
  public.emails,
  public.platform_documents,
  public.email_attachments,
  public.email_provider_events,
  public.signature_requests,
  public.signature_recipients,
  public.signature_fields,
  public.signature_events,
  public.video_branding_profiles,
  public.media_processing_jobs
to service_role;

