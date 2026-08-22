-- ==============================================================================
-- Migration: 002_rls_and_security.sql
-- Description: Zero-Trust Row Level Security (RLS) & Sanitized Public View
-- ==============================================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy overly-permissive public policies
DROP POLICY IF EXISTS "Public read events by slug" ON public.events;
DROP POLICY IF EXISTS "Public read parties by token hash" ON public.parties;

-- 3. Events Table Lockdown: ONLY Owner and Service Role
CREATE POLICY "Owners manage their events" ON public.events
    FOR ALL
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Service role full access events" ON public.events
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 4. Sanitized Public Event View (Excludes gate_pin, iban, bank_name, owner_id)
CREATE OR REPLACE VIEW public.public_events_view 
WITH (security_invoker = false) AS
SELECT 
    id,
    slug,
    groom_name,
    bride_name,
    event_date,
    event_time,
    venue_name,
    venue_address,
    venue_maps_url,
    theme_id,
    rsvp_mode,
    welcome_verse,
    invitation_image_url,
    timeline_reception,
    timeline_ardah,
    timeline_dinner,
    created_at
FROM public.events;

GRANT SELECT ON public.public_events_view TO anon, authenticated;

-- 5. Parties, Passes, Group Links, and Audit Logs: Service Role ONLY
CREATE POLICY "Service role full access parties" ON public.parties
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access entry_passes" ON public.entry_passes
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access check_in_logs" ON public.check_in_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role full access group_links" ON public.group_links
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 6. Moments Gallery Policies
CREATE POLICY "Public read approved moments" ON public.moments 
    FOR SELECT 
    USING (is_approved = true);

CREATE POLICY "Public insert moments" ON public.moments 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Service role full access moments" ON public.moments 
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- 7. Wishes Guestbook Policies
CREATE POLICY "Public read approved wishes" ON public.wishes 
    FOR SELECT 
    USING (is_approved = true);

CREATE POLICY "Public insert wishes" ON public.wishes 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Service role full access wishes" ON public.wishes 
    FOR ALL 
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
