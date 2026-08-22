-- ==============================================================================
-- Migration: 002_rls_and_security.sql
-- Description: Row Level Security (RLS) policies and Role Access Control
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;

-- 1. Events Policies
CREATE POLICY "Public read events by slug" ON public.events FOR SELECT USING (true);
CREATE POLICY "Owners update their events" ON public.events FOR UPDATE USING (auth.uid() = owner_id);

-- 2. Parties & Passes Policies
CREATE POLICY "Public read parties by token hash" ON public.parties FOR SELECT USING (true);
CREATE POLICY "Service role full access parties" ON public.parties FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access entry_passes" ON public.entry_passes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access check_in_logs" ON public.check_in_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access group_links" ON public.group_links FOR ALL USING (auth.role() = 'service_role');

-- 3. Moments Gallery Policies
CREATE POLICY "Public read approved moments" ON public.moments FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert moments" ON public.moments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role moderate moments" ON public.moments FOR ALL USING (auth.role() = 'service_role');

-- 4. Wishes Policies
CREATE POLICY "Public read approved wishes" ON public.wishes FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert wishes" ON public.wishes FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role moderate wishes" ON public.wishes FOR ALL USING (auth.role() = 'service_role');
