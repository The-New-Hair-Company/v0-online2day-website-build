-- New tables are owned by the migration role. The Azure gateway authenticates
-- with service_role and therefore needs explicit table privileges in addition
-- to its RLS bypass. No browser role receives broader access here.
grant select, insert, update on table public.site_branding to service_role;
grant select, insert, update, delete on table public.conversation_participants to service_role;
grant select, insert, update, delete on table public.visitor_chat_sessions to service_role;
grant select, insert, update, delete on table public.communication_provider_events to service_role;
grant select, insert, update, delete on table public.blog_slug_redirects to service_role;
