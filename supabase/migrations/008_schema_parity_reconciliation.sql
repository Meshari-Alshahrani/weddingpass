-- ==============================================================================
-- Migration: 008_schema_parity_reconciliation.sql
-- Description: Idempotent self-healing schema patch for pre-existing databases.
-- Ensures all columns, foreign keys, and indexes across all canonical tables
-- match WeddingPass v6.0.0 without affecting existing production data.
-- ==============================================================================

-- 1. Events table column guards
ALTER TABLE public.events
    ADD COLUMN IF NOT EXISTS welcome_verse TEXT,
    ADD COLUMN IF NOT EXISTS venue_map_url TEXT,
    ADD COLUMN IF NOT EXISTS gate_pin TEXT DEFAULT '2026',
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS iban TEXT,
    ADD COLUMN IF NOT EXISTS allow_wishes BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS allow_moments BOOLEAN NOT NULL DEFAULT true;

-- 2. Group Links table (ensure created with full schema)
CREATE TABLE IF NOT EXISTS public.group_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    host_name TEXT NOT NULL DEFAULT 'العريس',
    group_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    limit_mode TEXT NOT NULL DEFAULT 'warning' CHECK (limit_mode IN ('unlimited', 'warning', 'strict')),
    max_capacity INT DEFAULT 30,
    confirmed_count INT NOT NULL DEFAULT 0,
    max_seats_per_guest INT NOT NULL DEFAULT 2,
    section TEXT NOT NULL DEFAULT 'men',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, slug)
);

-- 3. Parties table column guards
ALTER TABLE public.parties
    ADD COLUMN IF NOT EXISTS host_name TEXT NOT NULL DEFAULT 'العريس',
    ADD COLUMN IF NOT EXISTS group_link_id UUID REFERENCES public.group_links(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS group_name TEXT,
    ADD COLUMN IF NOT EXISTS allowed_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS confirmed_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_checked_in_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS table_number TEXT,
    ADD COLUMN IF NOT EXISTS needs_wheelchair BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS dispatch_status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS rsvp_status TEXT NOT NULL DEFAULT 'unopened',
    ADD COLUMN IF NOT EXISTS rsvp_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'men',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Entry Passes table column guards
ALTER TABLE public.entry_passes
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS is_checked_in BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS men_checked_in INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS women_checked_in INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS first_check_in_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- 5. Check-In Logs table column guards
ALTER TABLE public.check_in_logs
    ADD COLUMN IF NOT EXISTS admitted_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 6. Moments table column guards
ALTER TABLE public.moments
    ADD COLUMN IF NOT EXISTS uploader_phone TEXT,
    ADD COLUMN IF NOT EXISTS caption TEXT,
    ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'general',
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- 7. Wishes table column guards
ALTER TABLE public.wishes
    ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- 8. Refresh PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
