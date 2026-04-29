-- ==========================================
-- ONLINE2DAY CRM DATABASE SCHEMA
-- Consolidated Backup Script
-- Last updated: 2026-04-29
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
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Function to handle new user signup (Auto-create profile)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
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
    role TEXT NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- LEADS (Core CRM lead tracking)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,                          -- nullable (not all leads have email at creation)
    phone TEXT,
    company TEXT,
    website TEXT,
    status TEXT NOT NULL DEFAULT 'New',  -- New | Contacted | Video Sent | Follow-up Due | Proposal Sent | Won | Lost
    source TEXT,                         -- Website | Cold Outreach | Referral | HubSpot | LinkedIn | Phone | Event | Other
    notes TEXT,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    follow_up_date TIMESTAMP WITH TIME ZONE,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD EVENTS (Activity timeline for each lead)
CREATE TABLE IF NOT EXISTS public.lead_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,  -- Lead Created | Status Updated | Note Added | Video Uploaded | Email Sent | Video Page Viewed | Lead Updated
    note TEXT,
    metadata JSONB,      -- Extra structured data (e.g. email subject, video slug)
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD ASSETS (Videos, documents, proposals per lead)
CREATE TABLE IF NOT EXISTS public.lead_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',       -- Friendly title for the asset
    type TEXT NOT NULL,                  -- 'video' | 'document' | 'proposal' | 'attachment'
    url TEXT NOT NULL DEFAULT '',        -- Signed URL or public URL for the asset
    storage_path TEXT,                   -- Internal Supabase Storage path (for signed URL regeneration)
    public_url TEXT,                     -- Public URL if bucket is public
    slug TEXT UNIQUE,                    -- Unique slug for client-facing page: /v/[slug]
    metadata JSONB,                      -- Extra data (e.g. duration, file size)
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

-- MESSAGES (Real-time chat between users and admin)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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
-- 4. STORAGE BUCKETS
-- ==========================================

-- Private bucket for lead videos (admin-only access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-videos', 'lead-videos', false)
ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- USER_PROFILES policies
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEADS policies (Admin only)
CREATE POLICY "Admins have full access to leads" ON public.leads
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEAD_EVENTS policies (Admin only)
CREATE POLICY "Admins have full access to lead_events" ON public.lead_events
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEAD_ASSETS policies (Admin only)
CREATE POLICY "Admins have full access to lead_assets" ON public.lead_assets
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEAD_AGREEMENTS policies (Admin only)
CREATE POLICY "Admins have full access to lead_agreements" ON public.lead_agreements
    FOR ALL TO authenticated
    USING (public.is_admin());

-- MESSAGES policies
CREATE POLICY "Users can read own conversation" ON public.messages
    FOR SELECT TO authenticated
    USING (conversation_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users can insert own messages" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        (conversation_user_id = auth.uid() AND sender_id = auth.uid())
        OR public.is_admin()
    );

CREATE POLICY "Admins can update messages" ON public.messages
    FOR UPDATE TO authenticated
    USING (public.is_admin());


-- ==========================================
-- 6. STORAGE POLICIES (lead-videos bucket)
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can upload lead videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can upload lead videos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''lead-videos'' AND public.is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can read lead videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can read lead videos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''lead-videos'' AND public.is_admin())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Admins can delete lead videos'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins can delete lead videos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''lead-videos'' AND public.is_admin())';
  END IF;
END $$;


-- ==========================================
-- 7. MIGRATION HISTORY (for reference)
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
