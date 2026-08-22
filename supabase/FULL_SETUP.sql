-- ==============================================================================
-- WEDDINGPASS v5.9 - FULL CONSOLIDATED PRODUCTION SETUP SCRIPT
-- ==============================================================================
-- قم بنسخ هذا الملف كاملاً ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. تفعيل ملحق التشفير
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. إنشاء الجداول الأساسية
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

CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_name TEXT NOT NULL,
    primary_phone TEXT,
    allowed_count INT NOT NULL DEFAULT 1,
    confirmed_count INT NOT NULL DEFAULT 0,
    rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'confirmed', 'declined')),
    invitation_token_hash TEXT NOT NULL,
    raw_invitation_token TEXT,
    section TEXT NOT NULL DEFAULT 'men' CHECK (section IN ('men', 'women', 'vip', 'general')),
    host_name TEXT DEFAULT 'العريس',
    table_number TEXT,
    notes TEXT,
    is_vip BOOLEAN NOT NULL DEFAULT false,
    needs_wheelchair BOOLEAN NOT NULL DEFAULT false,
    group_link_id UUID REFERENCES public.group_links(id) ON DELETE SET NULL,
    dispatch_status TEXT NOT NULL DEFAULT 'not_sent' CHECK (dispatch_status IN ('not_sent', 'queued', 'whatsapp_opened', 'delivered', 'failed')),
    last_dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entry_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    pass_token_hash TEXT UNIQUE NOT NULL,
    raw_pass_token TEXT,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.check_in_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    pass_id UUID REFERENCES public.entry_passes(id) ON DELETE SET NULL,
    admitted_count INT NOT NULL DEFAULT 1,
    station_name TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    checkin_type TEXT NOT NULL DEFAULT 'QR_SCAN' CHECK (checkin_type IN ('QR_SCAN', 'MANUAL_SEARCH', 'OFFLINE_SYNC', 'SUPERVISOR_OVERRIDE')),
    is_cross_section BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    guest_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_moments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    uploader_name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    caption TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. الفهارس للسرعة العالية
CREATE INDEX IF NOT EXISTS idx_parties_event_id ON public.parties(event_id);
CREATE INDEX IF NOT EXISTS idx_parties_token_hash ON public.parties(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_parties_phone ON public.parties(primary_phone);
CREATE INDEX IF NOT EXISTS idx_entry_passes_party_id ON public.entry_passes(party_id);
CREATE INDEX IF NOT EXISTS idx_entry_passes_token_hash ON public.entry_passes(pass_token_hash);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event_id ON public.check_in_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_group_links_event_slug ON public.group_links(event_id, slug);

-- 4. إدراج الفعالية الافتراضية
INSERT INTO public.events (
    id,
    slug,
    groom_name,
    bride_name,
    event_date,
    event_time,
    venue_name,
    venue_address,
    venue_maps_url,
    welcome_verse,
    gate_pin
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'royal-wedding-2026',
    'سلمان بن فهد العتيبي',
    'نورية بنت عبدالله آل سعود',
    '2026-10-24',
    '20:00:00',
    'قاعة فندق الريتز كارلتون - الرياض',
    'طريق مكة المكرمة، الهدا، الرياض',
    'https://maps.google.com/?q=Ritz+Carlton+Riyadh',
    'وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً',
    '2026'
)
ON CONFLICT (slug) DO NOTHING;

-- 5. إدراج قروب افتراضي
INSERT INTO public.group_links (
    event_id,
    host_name,
    group_name,
    slug,
    limit_mode,
    max_capacity,
    max_seats_per_guest,
    section
)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'العريس',
    'الأهل والأقارب',
    'family',
    'strict',
    50,
    2,
    'men'
)
ON CONFLICT (event_id, slug) DO NOTHING;

-- 6. إنشاء دالة التحضير الذرية السحابية (Atomic Check-in RPC)
CREATE OR REPLACE FUNCTION public.process_secure_checkin(
    p_pass_token_hash TEXT,
    p_station_name TEXT,
    p_operator_name TEXT,
    p_checkin_type TEXT DEFAULT 'QR_SCAN',
    p_gate_section TEXT DEFAULT 'general',
    p_force_cross_section BOOLEAN DEFAULT false,
    p_override_count INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_pass public.entry_passes%ROWTYPE;
    v_party public.parties%ROWTYPE;
    v_event public.events%ROWTYPE;
    v_already_checked_in BOOLEAN;
    v_is_cross_section BOOLEAN := false;
    v_admit_count INT;
BEGIN
    SELECT * INTO v_pass
    FROM public.entry_passes
    WHERE pass_token_hash = p_pass_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'رمز البطاقة غير مسجل أو غير صالح');
    END IF;

    IF v_pass.is_revoked THEN
        RETURN jsonb_build_object('success', false, 'code', 'PASS_REVOKED', 'message', 'تم إلغاء صلاحية بطاقة الدخول هذه مسبقاً من الإدارة');
    END IF;

    SELECT * INTO v_party
    FROM public.parties
    WHERE id = v_pass.party_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'PARTY_NOT_FOUND', 'message', 'بيانات الضيف غير موجودة');
    END IF;

    SELECT * INTO v_event
    FROM public.events
    WHERE id = v_party.event_id;

    SELECT EXISTS(
        SELECT 1 FROM public.check_in_logs
        WHERE pass_id = v_pass.id OR party_id = v_party.id
    ) INTO v_already_checked_in;

    IF v_already_checked_in THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_CHECKED_IN',
            'party_name', v_party.party_name,
            'section', v_party.section,
            'table_number', v_party.table_number,
            'is_vip', v_party.is_vip,
            'needs_wheelchair', v_party.needs_wheelchair,
            'message', '⚠️ تم تسجيل الدخول مسبقاً لهذه البطاقة!'
        );
    END IF;

    IF p_gate_section <> 'general' AND NOT p_force_cross_section THEN
        IF p_gate_section = 'men' AND v_party.section = 'women' THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CROSS_SECTION_WARNING',
                'is_cross_section_warning', true,
                'party_name', v_party.party_name,
                'section', v_party.section,
                'table_number', v_party.table_number,
                'message', '⚠️ تنبيه: هذه البطاقة مخصصة لقسم النساء 🧕 - يرجى توجيه الضيفة للبوابة النسائية.'
            );
        ELSIF p_gate_section = 'women' AND (v_party.section = 'men' OR v_party.section = 'vip') THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'CROSS_SECTION_WARNING',
                'is_cross_section_warning', true,
                'party_name', v_party.party_name,
                'section', v_party.section,
                'table_number', v_party.table_number,
                'message', '⚠️ تنبيه: هذه البطاقة مخصصة لقسم الرجال 🤵 - يرجى توجيه الضيف لبوابة الرجال.'
            );
        END IF;
    END IF;

    IF p_gate_section <> 'general' AND p_force_cross_section THEN
        v_is_cross_section := true;
    END IF;

    v_admit_count := COALESCE(p_override_count, v_party.confirmed_count, v_party.allowed_count, 1);

    INSERT INTO public.check_in_logs (
        event_id,
        party_id,
        pass_id,
        admitted_count,
        station_name,
        operator_name,
        checkin_type,
        is_cross_section
    )
    VALUES (
        v_party.event_id,
        v_party.id,
        v_pass.id,
        v_admit_count,
        p_station_name,
        p_operator_name,
        p_checkin_type,
        v_is_cross_section
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'SUCCESS',
        'party_name', v_party.party_name,
        'admitted_count', v_admit_count,
        'section', v_party.section,
        'table_number', v_party.table_number,
        'is_vip', v_party.is_vip,
        'needs_wheelchair', v_party.needs_wheelchair,
        'host_name', v_party.host_name,
        'is_cross_section', v_is_cross_section,
        'message', 'أهلاً وسهلاً، تم تأكيد الدخول بنجاح ✨'
    );
END;
$$;

-- 7. حصر صلاحية دالة التحضير على السيرفر (service_role)
REVOKE ALL ON FUNCTION public.process_secure_checkin(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_secure_checkin(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) FROM anon;
REVOKE ALL ON FUNCTION public.process_secure_checkin(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT) TO service_role;

-- 8. تفعيل سياسات الأمان RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read approved wishes" ON public.wishes FOR SELECT USING (is_approved = true);
CREATE POLICY "Allow public insert wish" ON public.wishes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read approved moments" ON public.event_moments FOR SELECT USING (is_approved = true);
CREATE POLICY "Allow public insert moment" ON public.event_moments FOR INSERT WITH CHECK (true);
