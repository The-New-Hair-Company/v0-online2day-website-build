-- ==========================================
-- ONLINE2DAY CRM DATABASE SCHEMA
-- Consolidated Backup Script
-- ==========================================

-- 1. FUNCTIONS
-- ------------------------------------------

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


-- 2. TABLES
-- ------------------------------------------

-- USER PROFILES (Stores roles and user metadata)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- LEADS (Core CRM Lead tracking)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    company TEXT,
    status TEXT NOT NULL DEFAULT 'New', -- e.g. New, Contacted, In Progress, Closed Won, Closed Lost
    source TEXT, -- e.g. Website Contact Form, HubSpot, Manual
    notes TEXT,
    last_contacted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD EVENTS (Activity timeline for leads)
CREATE TABLE IF NOT EXISTS public.lead_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- e.g. Email Sent, Video Viewed, Call, Meeting, Note
    note TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- LEAD ASSETS (Personalized videos/files shared with leads)
CREATE TABLE IF NOT EXISTS public.lead_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- e.g. video, document
    url TEXT NOT NULL,
    slug TEXT UNIQUE, -- for custom public links like /v/personalized-video
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


-- 3. TRIGGERS
-- ------------------------------------------

-- Trigger to automatically create a profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 4. SECURITY (RLS POLICIES)
-- ------------------------------------------

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_assets ENABLE ROW LEVEL SECURITY;

-- USER_PROFILES Policies
CREATE POLICY "Users can read own profiles" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEADS Policies (Admin Only)
CREATE POLICY "Admins have full access to leads" ON public.leads
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEAD_EVENTS Policies (Admin Only)
CREATE POLICY "Admins have full access to lead_events" ON public.lead_events
    FOR ALL TO authenticated
    USING (public.is_admin());

-- LEAD_ASSETS Policies (Admin Only)
CREATE POLICY "Admins have full access to lead_assets" ON public.lead_assets
    FOR ALL TO authenticated
    USING (public.is_admin());

-- MESSAGES Policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

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
