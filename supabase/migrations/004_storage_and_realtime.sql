-- ==============================================================================
-- Migration: 004_storage_and_realtime.sql
-- Description: Supabase Realtime isolation and Storage Bucket lockdown
-- ==============================================================================

-- 1. Realtime Publication Isolation: Restrict broadcast to wishes only
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.parties;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.entry_passes;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.check_in_logs;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wishes;
    END IF;
END $$;
