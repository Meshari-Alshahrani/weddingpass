-- ==============================================================================
-- Migration 006: Explicitly Remove Legacy Public INSERT Policies from Existing DB
-- Enforces Zero-Trust: All inserts to wishes and moments must go through Next.js service_role
-- ==============================================================================

-- 1. Drop Legacy Public INSERT policies on moments
DROP POLICY IF EXISTS "Public insert moments" ON public.moments;
DROP POLICY IF EXISTS "Public insert moments" ON public.event_moments;

-- 2. Drop Legacy Public INSERT policies on wishes
DROP POLICY IF EXISTS "Public insert wishes" ON public.wishes;
DROP POLICY IF EXISTS "Public insert wishes" ON public.event_wishes;

-- 3. Ensure Row Level Security is strictly enabled
ALTER TABLE IF EXISTS public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wishes ENABLE ROW LEVEL SECURITY;

-- 4. Re-verify Service Role Policies exist and have full access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'moments' AND policyname = 'Service role full access moments'
    ) THEN
        CREATE POLICY "Service role full access moments" ON public.moments 
            FOR ALL 
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'wishes' AND policyname = 'Service role full access wishes'
    ) THEN
        CREATE POLICY "Service role full access wishes" ON public.wishes 
            FOR ALL 
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;
