-- ==========================================
-- ONLINE2DAY CRM DATABASE SCHEMA
-- Consolidated Backup Script
-- Last updated: 2026-05-07
-- Project: mmxwpnbztddaxagxbung (online2day)
-- ==========================================

-- ==========================================
-- 1. FUNCTIONS
-- ==========================================

-- Function to check if current user is an admin (Security Definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN ('oliverjosephking@gmail.com', 'info@online2day.com')
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM licensed_users
      WHERE email = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      AND role = 'admin'
      AND status = 'active'
    );
$$;

-- Function to handle new user signup (Auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  next_role TEXT := 'user';
BEGIN
  IF LOWER(NEW.email) IN ('oliverjosephking@gmail.com', 'info@online2day.com')
    OR EXISTS (
      SELECT 1 FROM public.licensed_users
      WHERE email = LOWER(NEW.email)
      AND role = 'admin'
      AND status = 'active'
    )
  THEN
    next_role := 'admin';
  END IF;

  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (NEW.id, LOWER(NEW.email), next_role)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        role = CASE
          WHEN public.user_profiles.role = 'admin' THEN 'admin'
          ELSE EXCLUDED.role
        END;
  RETURN NEW;
END;
$$;


-- ==========================================
-- 2. TABLES
-- ==========================================

-- USER PROFILES (Stores roles and user metadata)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- LICENSED USERS (Seats that are allowed to use the system)
CREATE TABLE IF NOT EXISTS public.licensed_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE CHECK (email = LOWER(email)),
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'suspended', 'revoked')),
    seat_type TEXT NOT NULL DEFAULT 'standard' CHECK (seat_type IN ('admin', 'standard', 'viewer')),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

INSERT INTO public.licensed_users (email, full_name, role, status, seat_type)
VALUES
  ('oliverjosephking@gmail.com', 'Oliver Joseph King', 'admin', 'active', 'admin'),
  ('info@online2day.com', 'Online2Day Admin', 'admin', 'active', 'admin')
ON CONFLICT (email) DO UPDATE
  SET role = 'admin',
      status = 'active',
      seat_type = 'admin',
      full_name = EXCLUDED.full_name,
      updated_at = now();

-- LEADS (Core CRM lead tracking)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    website TEXT,
    status TEXT NOT NULL DEFAULT 'New',  -- New | Contacted | Video Sent | Follow-up Due | Proposal Sent | Won | Lost
    source TEXT,                          -- Website | Cold Outreach | Referral | HubSpot | LinkedIn | Phone | Event | Other
    notes TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    engagement INTEGER DEFAULT 0 CHECK (engagement >= 0 AND engagement <= 100),
    value NUMERIC DEFAULT 0,
    role TEXT,
    linkedin_url TEXT,
    next_action TEXT,
    lost_reason TEXT,
    email_address TEXT,
    phone_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD EVENTS (Activity timeline for each lead)
CREATE TABLE IF NOT EXISTS public.lead_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- Lead Created | Status Updated | Note Added | Video Uploaded | Email Sent | Video Page Viewed | Lead Updated
    title TEXT,
    note TEXT,
    metadata JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD ASSETS (Videos, documents, proposals per lead — lead_id nullable for standalone shared videos)
CREATE TABLE IF NOT EXISTS public.lead_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,              -- 'video' | 'document' | 'proposal' | 'attachment'
    url TEXT NOT NULL DEFAULT '',
    storage_path TEXT,
    public_url TEXT,
    slug TEXT UNIQUE,                -- Unique slug for client-facing page: /v/[slug]
    metadata JSONB,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD AGREEMENTS (Downloadable agreement records)
CREATE TABLE IF NOT EXISTS public.lead_agreements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    storage_path TEXT,
    public_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD TASKS (Task checklist items per lead)
CREATE TABLE IF NOT EXISTS public.lead_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE,
    is_done BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD AUDIT LOG (Per-lead change trail)
CREATE TABLE IF NOT EXISTS public.lead_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    field_changed TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CONVERSATIONS (Inbound chat conversations linked to leads or users)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    contact_name TEXT NOT NULL,
    company TEXT,
    channel TEXT DEFAULT 'Web',       -- Web | Email | Phone | LinkedIn
    status TEXT DEFAULT 'Open',       -- Open | Resolved | Pending
    priority TEXT DEFAULT 'Medium',   -- Low | Medium | High
    score INTEGER DEFAULT 0,
    unread_count INTEGER DEFAULT 0,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_message_preview TEXT,
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- MESSAGES (Real-time chat between users and admin)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- 'text' | 'video' | 'file'
    attachment_label TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- VIDEOS (Video library records)
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    funnel_stage TEXT DEFAULT 'Prospecting',
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    channel TEXT DEFAULT 'Email',
    cta_label TEXT DEFAULT 'Book meeting',
    cta_url TEXT,
    status TEXT DEFAULT 'Draft',      -- Draft | Published | Archived
    watch_rate INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMP WITH TIME ZONE,
    reply_count INTEGER DEFAULT 0,
    next_action TEXT DEFAULT 'Follow up',
    storage_path TEXT,
    thumbnail_url TEXT,
    public_url TEXT,
    meetings_booked INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- VIDEO TEMPLATES (Reusable video templates)
CREATE TABLE IF NOT EXISTS public.video_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    storage_path TEXT,
    public_url TEXT,
    duration_seconds INTEGER,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- EMAIL TEMPLATES (Email template records)
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category TEXT,
    audience TEXT DEFAULT 'All leads',
    stage TEXT DEFAULT 'Outreach',
    cta_label TEXT DEFAULT 'Reply now',
    sent_count INTEGER DEFAULT 0,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    meetings_booked INTEGER DEFAULT 0,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- EMAILS (Sent email records)
CREATE TABLE IF NOT EXISTS public.emails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    subject TEXT,
    body TEXT,
    status TEXT DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- SITE REQUESTS (Inbound website build requests from marketing site)
CREATE TABLE IF NOT EXISTS public.site_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    type TEXT DEFAULT 'Website',
    priority TEXT DEFAULT 'Medium',
    stage TEXT DEFAULT 'New',
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    contact_name TEXT,
    contact_email TEXT,
    description TEXT,
    budget_min NUMERIC DEFAULT 0,
    budget_max NUMERIC DEFAULT 0,
    timeline_weeks INTEGER DEFAULT 6,
    brief_url TEXT,
    next_action TEXT DEFAULT 'Review request',
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- SITE BUILD REQUESTS (User-dashboard website build request pipeline)
CREATE TABLE IF NOT EXISTS public.site_build_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    style_description TEXT,
    status TEXT NOT NULL DEFAULT 'Requirements Submitted',
    staging_url TEXT,
    live_url TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INTEGRATIONS (Integration status cards)
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected',  -- connected | disconnected | error
    config JSONB,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ACTIVITY FEED (Global activity stream shown on Overview)
CREATE TABLE IF NOT EXISTS public.activity_feed (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_name TEXT NOT NULL DEFAULT 'System',
    type TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    entity_name TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- GOALS (Pipeline goals and targets)
CREATE TABLE IF NOT EXISTS public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    label TEXT NOT NULL,
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'count',
    period_start DATE DEFAULT CURRENT_DATE,
    period_end DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- METRIC SNAPSHOTS (Time-series metric data for charts)
CREATE TABLE IF NOT EXISTS public.metric_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    section TEXT NOT NULL,
    metric_label TEXT NOT NULL,
    value_numeric NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ANALYTICS SNAPSHOTS (Analytics rollup snapshots)
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshotted_at DATE NOT NULL DEFAULT CURRENT_DATE UNIQUE,
    total_leads INTEGER NOT NULL DEFAULT 0,
    new_leads INTEGER NOT NULL DEFAULT 0,
    qualified_leads INTEGER NOT NULL DEFAULT 0,
    won_leads INTEGER NOT NULL DEFAULT 0,
    lost_leads INTEGER NOT NULL DEFAULT 0,
    pipeline_value NUMERIC NOT NULL DEFAULT 0,
    meetings_booked INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ADMIN PREFERENCES (Per-admin key-value settings)
CREATE TABLE IF NOT EXISTS public.admin_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ADMIN AUDIT LOG (GDPR audit trail)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    changes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ENTERPRISE STATE (Key-value store for feature flags and legacy fallback data)
CREATE TABLE IF NOT EXISTS public.enterprise_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ENTERPRISE EVENTS (Calendar entries)
CREATE TABLE IF NOT EXISTS public.enterprise_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    event_time TEXT,
    event_type TEXT DEFAULT 'meeting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ENTERPRISE TASKS (Task checklist items on Enterprise page)
CREATE TABLE IF NOT EXISTS public.enterprise_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    is_done BOOLEAN DEFAULT false,
    priority TEXT DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- CONTACT IMPORTS (Bulk contact import records)
CREATE TABLE IF NOT EXISTS public.contact_imports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    filename TEXT,
    row_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- NOTIFICATIONS (Per-user notification feed)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'system',
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- REPORT SNAPSHOTS (Saved KPI snapshots for the Reports page)
CREATE TABLE IF NOT EXISTS public.report_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_label TEXT NOT NULL DEFAULT 'Snapshot',
    kpis JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ASYNC ACTION FAILURES (Dead-letter queue for recoverable server-action errors)
CREATE TABLE IF NOT EXISTS public.async_action_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    payload_hash TEXT,
    error_code TEXT NOT NULL DEFAULT 'ACTION_ERROR',
    error_message TEXT NOT NULL DEFAULT '',
    recoverable BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SECURITY EVENTS (Tracks invalid UUID requests, failed auth, rate-limit hits)
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    route TEXT NOT NULL DEFAULT '',
    ip TEXT NOT NULL DEFAULT '',
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRIAL ACCOUNTS (14-day free trial signups)
CREATE TABLE IF NOT EXISTS public.trial_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT,
    phone TEXT,
    plan TEXT NOT NULL DEFAULT 'Pro',
    trial_start TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    trial_end TIMESTAMP WITH TIME ZONE DEFAULT (timezone('utc', now()) + INTERVAL '14 days') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);


-- ==========================================
-- 3. TRIGGERS
-- ==========================================

-- Auto-create user_profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ==========================================
-- 4. INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread  ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_report_snapshots_user_created ON public.report_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_async_failures_created ON public.async_action_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);


-- ==========================================
-- 5. STORAGE BUCKETS
-- ==========================================

-- Private bucket for lead videos (admin-only access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-videos', 'lead-videos', false)
ON CONFLICT (id) DO NOTHING;

-- Public bucket for lead assets (documents, attachments)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-assets', 'lead-assets', true)
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licensed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_build_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.async_action_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_accounts ENABLE ROW LEVEL SECURITY;

-- USER_PROFILES
CREATE POLICY "Users can read own profiles" ON public.user_profiles
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
    FOR ALL TO authenticated USING (public.is_admin());

-- LICENSED_USERS
CREATE POLICY "Users can read own license record" ON public.licensed_users
    FOR SELECT USING (lower(email) = lower(auth.jwt() ->> 'email'));
CREATE POLICY "Admins can manage licensed_users" ON public.licensed_users
    FOR ALL USING (public.is_admin());

-- LEADS
CREATE POLICY "Admins have full access to leads" ON public.leads
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members access own leads" ON public.leads
    FOR ALL TO authenticated
    USING (assigned_to = auth.uid()) WITH CHECK (assigned_to = auth.uid());

-- LEAD_EVENTS
CREATE POLICY "Admins have full access to lead_events" ON public.lead_events
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users can read their created events" ON public.lead_events
    FOR SELECT TO authenticated USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "Members access own lead events" ON public.lead_events
    FOR ALL TO authenticated
    USING (lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()));

-- LEAD_ASSETS
CREATE POLICY "Admins have full access to lead_assets" ON public.lead_assets
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members access own lead assets" ON public.lead_assets
    FOR ALL TO authenticated
    USING (lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()));

-- LEAD_AGREEMENTS
CREATE POLICY "Admins have full access to lead_agreements" ON public.lead_agreements
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members access own lead agreements" ON public.lead_agreements
    FOR ALL TO authenticated
    USING (lead_id IN (SELECT id FROM public.leads WHERE assigned_to = auth.uid()));

-- LEAD_TASKS
CREATE POLICY "Admins have full access to lead_tasks" ON public.lead_tasks
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users can read tasks assigned to them" ON public.lead_tasks
    FOR SELECT TO authenticated USING (assigned_to = auth.uid() OR public.is_admin());
CREATE POLICY "Users can view own tasks" ON public.lead_tasks
    FOR SELECT TO authenticated USING (assigned_to = auth.uid());
CREATE POLICY "Users can update own tasks" ON public.lead_tasks
    FOR UPDATE TO authenticated USING (assigned_to = auth.uid());

-- LEAD_AUDIT_LOG
CREATE POLICY "System insert audit log" ON public.lead_audit_log
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins read audit log" ON public.lead_audit_log
    FOR SELECT USING (true);

-- CONVERSATIONS
CREATE POLICY "Public read conversations" ON public.conversations
    FOR SELECT USING (true);
CREATE POLICY "Auth insert conversations" ON public.conversations
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update conversations" ON public.conversations
    FOR UPDATE USING (auth.role() = 'authenticated');

-- MESSAGES
CREATE POLICY "Users can read own conversation" ON public.messages
    FOR SELECT TO authenticated USING (conversation_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT TO authenticated WITH CHECK (
        (conversation_user_id = auth.uid() AND sender_id = auth.uid()) OR public.is_admin()
    );
CREATE POLICY "Admins can update messages" ON public.messages
    FOR UPDATE TO authenticated USING (public.is_admin());

-- VIDEOS
CREATE POLICY "Public read videos" ON public.videos FOR SELECT USING (true);
CREATE POLICY "Auth insert videos" ON public.videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update videos" ON public.videos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- VIDEO_TEMPLATES
CREATE POLICY "Allow public read on video_templates" ON public.video_templates FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write on video_templates" ON public.video_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on video_templates" ON public.video_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

-- EMAIL_TEMPLATES
CREATE POLICY "Allow public read on email_templates" ON public.email_templates FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write on email_templates" ON public.email_templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on email_templates" ON public.email_templates
    FOR UPDATE USING (auth.role() = 'authenticated');

-- EMAILS
CREATE POLICY "Users can view all emails" ON public.emails FOR SELECT USING (true);
CREATE POLICY "Users can insert emails" ON public.emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update emails" ON public.emails
    FOR UPDATE USING (sender_id = auth.uid() OR public.is_admin());
CREATE POLICY "Users can delete emails" ON public.emails
    FOR DELETE USING (sender_id = auth.uid() OR public.is_admin());

-- SITE_REQUESTS
CREATE POLICY "Public read site_requests" ON public.site_requests FOR SELECT USING (true);
CREATE POLICY "Auth insert site_requests" ON public.site_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update site_requests" ON public.site_requests
    FOR UPDATE USING (auth.role() = 'authenticated');

-- SITE_BUILD_REQUESTS
CREATE POLICY "Admins can manage all requests" ON public.site_build_requests
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Users can view their own requests" ON public.site_build_requests
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Users can insert their own requests" ON public.site_build_requests
    FOR INSERT TO authenticated WITH CHECK (true);

-- INTEGRATIONS
CREATE POLICY "Allow public read on integrations" ON public.integrations FOR SELECT USING (true);
CREATE POLICY "Allow authenticated write on integrations" ON public.integrations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update on integrations" ON public.integrations
    FOR UPDATE USING (auth.role() = 'authenticated');

-- ACTIVITY_FEED
CREATE POLICY "Public read activity_feed" ON public.activity_feed FOR SELECT USING (true);
CREATE POLICY "Auth insert activity_feed" ON public.activity_feed FOR INSERT WITH CHECK (true);

-- GOALS
CREATE POLICY "Public read goals" ON public.goals FOR SELECT USING (true);
CREATE POLICY "Auth write goals" ON public.goals FOR ALL USING (auth.role() = 'authenticated');

-- METRIC_SNAPSHOTS
CREATE POLICY "Public read metric_snapshots" ON public.metric_snapshots FOR SELECT USING (true);

-- ANALYTICS_SNAPSHOTS
CREATE POLICY "Admins have full access to analytics_snapshots" ON public.analytics_snapshots
    FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can manage analytics_snapshots" ON public.analytics_snapshots
    FOR ALL TO authenticated USING (public.is_admin());

-- ADMIN_PREFERENCES
CREATE POLICY "admin_prefs_own" ON public.admin_preferences
    FOR ALL USING (public.is_admin() AND auth.uid() = user_id);

-- ADMIN_AUDIT_LOG
CREATE POLICY "audit_log_insert" ON public.admin_audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_log_select" ON public.admin_audit_log FOR SELECT USING (public.is_admin());

-- ENTERPRISE_STATE
CREATE POLICY "enterprise_state_all" ON public.enterprise_state FOR ALL USING (public.is_admin());

-- ENTERPRISE_EVENTS
CREATE POLICY "enterprise_events_all" ON public.enterprise_events FOR ALL USING (public.is_admin());

-- ENTERPRISE_TASKS
CREATE POLICY "enterprise_tasks_all" ON public.enterprise_tasks FOR ALL USING (public.is_admin());

-- CONTACT_IMPORTS
CREATE POLICY "contact_imports_all" ON public.contact_imports FOR ALL USING (public.is_admin());

-- NOTIFICATIONS
CREATE POLICY "Users can read own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- REPORT_SNAPSHOTS
CREATE POLICY "Users can manage own report_snapshots" ON public.report_snapshots
    FOR ALL USING (auth.uid() = user_id);

-- ASYNC_ACTION_FAILURES
CREATE POLICY "System can insert async_action_failures" ON public.async_action_failures
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage async_action_failures" ON public.async_action_failures
    FOR ALL USING (public.is_admin());

-- SECURITY_EVENTS
CREATE POLICY "System can insert security_events" ON public.security_events
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read security_events" ON public.security_events
    FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can delete security_events" ON public.security_events
    FOR DELETE USING (public.is_admin());

-- TRIAL_ACCOUNTS
CREATE POLICY "Anyone can create a trial account" ON public.trial_accounts
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can read own trial account" ON public.trial_accounts
    FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage trial accounts" ON public.trial_accounts
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==========================================
-- 7. STORAGE POLICIES (lead-videos bucket)
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload to lead-videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can upload to lead-videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''lead-videos'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can read lead-videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read lead-videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''lead-videos'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Admins can delete lead-videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete lead-videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''lead-videos'' AND public.is_admin())';
  END IF;
END $$;


-- ==========================================
-- 8. MIGRATION HISTORY (for reference)
-- ==========================================
-- 20260428163148 — init_crm_tables
-- 20260428173323 — add_admin_roles_and_restrict_crm
-- 20260428174042 — add_user_profiles_trigger
-- 20260429051048 — add_messages_table_and_realtime
-- 20260429164526 — add_assigned_to_and_created_by
--                   (adds: leads.assigned_to, leads.follow_up_date, leads.website,
--                          lead_events.created_by, lead_agreements table,
--                          lead-videos storage bucket)
-- 20260429165607 — fix_lead_assets_columns_for_crm
--                   (adds: lead_assets.name, lead_assets.url, lead_assets.slug,
--                          lead_assets.metadata, lead_events.metadata)
-- 20260505000000 — add_trial_accounts_and_member_rls
--                   (adds: trial_accounts table, member data-isolation RLS policies)
-- 20260507000000 — create_missing_backend_tables
--                   (adds: notifications, report_snapshots, async_action_failures,
--                          security_events, licensed_users tables;
--                          broadens lead-videos storage policies to all authenticated users)
-- 20260507000001 — add_trial_accounts_table
--                   (adds: trial_accounts table with RLS; applied via MCP after table was
--                          found missing from live DB despite being in schema.sql)
