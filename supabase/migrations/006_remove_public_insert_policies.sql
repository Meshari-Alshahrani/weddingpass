-- ==============================================================================
-- Migration 006: Remove legacy public INSERT policies safely
--
-- The guards matter: `DROP POLICY IF EXISTS` still fails when its table does
-- not exist. This lets the canonical schema safely clean up legacy policies
-- without blocking the migration on an absent legacy table.
-- ==============================================================================

DO $$
DECLARE
    target_table TEXT;
    policy_name TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['moments', 'event_moments', 'wishes', 'event_wishes']
    LOOP
        IF to_regclass(format('public.%I', target_table)) IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);

        FOREACH policy_name IN ARRAY ARRAY[
            'Public insert moments',
            'Public insert wishes',
            'Allow public insert moment',
            'Allow public insert wish'
        ]
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, target_table);
        END LOOP;
    END LOOP;
END $$;

-- Reassert the service-only policies on the canonical tables. The guards make
-- this safe for a database that was only partially initialized.
DO $$
BEGIN
    IF to_regclass('public.moments') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'moments'
             AND policyname = 'Service role full access moments'
       ) THEN
        CREATE POLICY "Service role full access moments" ON public.moments
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;

    IF to_regclass('public.wishes') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = 'wishes'
             AND policyname = 'Service role full access wishes'
       ) THEN
        CREATE POLICY "Service role full access wishes" ON public.wishes
            FOR ALL
            USING (auth.role() = 'service_role')
            WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;
