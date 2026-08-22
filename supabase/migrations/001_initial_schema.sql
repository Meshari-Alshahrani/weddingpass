-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Base database tables, indexes, and pgcrypto extension
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    groom_name TEXT NOT NULL,
    bride_name TEXT NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    venue_name TEXT NOT NULL,
    venue_address TEXT,
    venue_maps_url TEXT,
    theme_id TEXT DEFAULT 'classic_gold',
    rsvp_mode TEXT DEFAULT 'count' CHECK (rsvp_mode IN ('simple', 'count')),
    welcome_verse TEXT,
    invitation_image_url TEXT,
    timeline_reception TEXT DEFAULT '08:00 م',
    timeline_ardah TEXT DEFAULT '09:30 م',
    timeline_dinner TEXT DEFAULT '10:30 م',
    iban TEXT,
    bank_name TEXT,
    gate_pin TEXT DEFAULT '2026',
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Group Links Table
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

-- 3. Parties Table
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    host_name TEXT NOT NULL DEFAULT 'العريس',
    group_link_id UUID REFERENCES public.group_links(id) ON DELETE SET NULL,
    group_name TEXT,
    party_name TEXT NOT NULL,
    primary_phone TEXT,
    allowed_count INT NOT NULL DEFAULT 1,
    confirmed_count INT DEFAULT 0,
    actual_checked_in_count INT DEFAULT 0,
    table_number TEXT,
    needs_wheelchair BOOLEAN DEFAULT false,
    is_vip BOOLEAN DEFAULT false,
    invitation_token_hash TEXT UNIQUE NOT NULL,
    dispatch_status TEXT NOT NULL DEFAULT 'draft' CHECK (dispatch_status IN ('draft', 'whatsapp_opened', 'sent')),
    rsvp_status TEXT NOT NULL DEFAULT 'unopened' CHECK (rsvp_status IN ('unopened', 'viewed', 'confirmed', 'declined')),
    rsvp_at TIMESTAMPTZ,
    section TEXT DEFAULT 'men',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Entry Passes Table
CREATE TABLE IF NOT EXISTS public.entry_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID UNIQUE NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    pass_token_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    is_checked_in BOOLEAN NOT NULL DEFAULT false,
    men_checked_in INT DEFAULT 0,
    women_checked_in INT DEFAULT 0,
    first_check_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

-- 5. Check-In Audit Logs Table
CREATE TABLE IF NOT EXISTS public.check_in_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    entry_pass_id UUID REFERENCES public.entry_passes(id) ON DELETE SET NULL,
    scanned_token_hash TEXT NOT NULL,
    station_name TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    checkin_type TEXT NOT NULL DEFAULT 'QR_SCAN' CHECK (checkin_type IN ('QR_SCAN', 'MANUAL_SEARCH')),
    scan_result TEXT NOT NULL CHECK (scan_result IN ('SUCCESS', 'ALREADY_CHECKED_IN', 'REVOKED', 'NOT_FOUND', 'DECLINED', 'MANUAL_OVERRIDE', 'CROSS_SECTION_WARNING')),
    admitted_count INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Moments Gallery Table
CREATE TABLE IF NOT EXISTS public.moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    uploader_name TEXT NOT NULL,
    uploader_phone TEXT,
    media_url TEXT NOT NULL,
    caption TEXT,
    section TEXT NOT NULL DEFAULT 'men',
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Wishes Guestbook Table
CREATE TABLE IF NOT EXISTS public.wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    party_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parties_invitation_hash ON public.parties(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_entry_passes_hash ON public.entry_passes(pass_token_hash);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event ON public.check_in_logs(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_parties_search ON public.parties(event_id, party_name, primary_phone);
CREATE INDEX IF NOT EXISTS idx_moments_event ON public.moments(event_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_wishes_event ON public.wishes(event_id, is_approved);
