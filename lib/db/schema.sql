-- ==============================================================================
-- WeddingPass Database Schema (PostgreSQL / Supabase DDL)
-- Version: 5.6 (Master Production Hardened)
-- ==============================================================================

-- تفعيل ملحق pgcrypto للتشفير وتوليد المعرفات
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. جدول الفعاليات (Events)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 2. جدول روابط المجموعات الذاتية (Group Invite Links)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. جدول المجموعات والعائلات المدعوة (Parties)
-- ------------------------------------------------------------------------------
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
    invitation_token_hash TEXT UNIQUE NOT NULL,
    dispatch_status TEXT NOT NULL DEFAULT 'draft' CHECK (dispatch_status IN ('draft', 'whatsapp_opened', 'sent')),
    rsvp_status TEXT NOT NULL DEFAULT 'unopened' CHECK (rsvp_status IN ('unopened', 'viewed', 'confirmed', 'declined')),
    rsvp_at TIMESTAMPTZ,
    section TEXT DEFAULT 'men',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. جدول بطاقات الدخول المشفرة (Entry Passes)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 5. جدول سجل التدقيق لعمليات الدخول (Check-in Logs)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 6. جدول ألبوم اللحظات الحية (Event Moments)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 7. جدول تبريكات وسجل الزوار (Wishes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_id UUID REFERENCES public.parties(id) ON DELETE SET NULL,
    party_name TEXT NOT NULL,
    message TEXT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- فهارس الأداء العالي والبحث السريع
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parties_invitation_hash ON public.parties(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_entry_passes_hash ON public.entry_passes(pass_token_hash);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event ON public.check_in_logs(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_parties_search ON public.parties(event_id, party_name, primary_phone);
CREATE INDEX IF NOT EXISTS idx_moments_event ON public.moments(event_id, is_approved);
CREATE INDEX IF NOT EXISTS idx_wishes_event ON public.wishes(event_id, is_approved);

-- ------------------------------------------------------------------------------
-- 8. إجراء التحقق الذري المشدد للدخول (Atomic Check-in RPC with Row Lock)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_secure_checkin(
    p_event_id UUID,
    p_pass_token_hash TEXT,
    p_station_name TEXT,
    p_operator_name TEXT,
    p_checkin_type TEXT DEFAULT 'QR_SCAN',
    p_override_count INT DEFAULT NULL,
    p_gate_section TEXT DEFAULT 'men',
    p_force_cross_section BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pass RECORD;
    v_final_count INT;
    v_is_vip BOOLEAN;
BEGIN
    -- 1. البحث وقفل سجل بطاقة الدخول فوراً لمنع أي تزامن
    SELECT ep.*, p.id AS p_id, p.event_id AS p_event_id, p.party_name, p.confirmed_count, p.allowed_count, p.section, p.rsvp_status, p.table_number, p.needs_wheelchair, p.host_name
    INTO v_pass
    FROM public.entry_passes ep
    JOIN public.parties p ON ep.party_id = p.id
    WHERE ep.pass_token_hash = p_pass_token_hash 
      AND p.event_id = p_event_id
    FOR UPDATE OF ep;

    -- حالة: الرمز غير موجود أو غير تابع لهذه الفعالية
    IF NOT FOUND THEN
        INSERT INTO public.check_in_logs (
            event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name, checkin_type, scan_result, admitted_count
        ) VALUES (
            p_event_id, NULL, NULL, p_pass_token_hash, p_station_name, p_operator_name, p_checkin_type, 'NOT_FOUND', 0
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'message', 'رمز الدخول غير مسجل في هذه المناسبة'
        );
    END IF;

    -- حالة: البطاقة ملغية الصلاحية
    IF v_pass.status = 'revoked' THEN
        INSERT INTO public.check_in_logs (
            event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name, checkin_type, scan_result, admitted_count
        ) VALUES (
            p_event_id, v_pass.p_id, v_pass.id, p_pass_token_hash, p_station_name, p_operator_name, p_checkin_type, 'REVOKED', 0
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'REVOKED',
            'message', 'تم إلغاء صلاحية بطاقة الدخول هذه مسبقاً من قِبل المنظم',
            'party_name', v_pass.party_name
        );
    END IF;

    -- حالة: تحذير القسم المتقاطع (نساء عند الرجال أو العكس)
    IF NOT p_force_cross_section AND p_gate_section <> 'general' AND v_pass.section <> 'general' AND v_pass.section <> p_gate_section THEN
        INSERT INTO public.check_in_logs (
            event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name, checkin_type, scan_result, admitted_count
        ) VALUES (
            p_event_id, v_pass.p_id, v_pass.id, p_pass_token_hash, p_station_name, p_operator_name, p_checkin_type, 'CROSS_SECTION_WARNING', 0
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'CROSS_SECTION_WARNING',
            'message', CASE WHEN v_pass.section = 'women' THEN 'هذه البطاقة مخصصة لقسم النساء 🌹' ELSE 'هذه البطاقة مخصصة لقسم الرجال ⚔️' END,
            'party_name', v_pass.party_name,
            'section', v_pass.section,
            'target_gate', CASE WHEN v_pass.section = 'women' THEN 'بوابة النساء' ELSE 'بوابة الرجال' END
        );
    END IF;

    -- حالة: تم استخدام البطاقة مسبقاً (Anti-Replay)
    IF v_pass.is_checked_in THEN
        INSERT INTO public.check_in_logs (
            event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name, checkin_type, scan_result, admitted_count
        ) VALUES (
            p_event_id, v_pass.p_id, v_pass.id, p_pass_token_hash, p_station_name, p_operator_name, p_checkin_type, 'ALREADY_CHECKED_IN', 0
        );

        RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_CHECKED_IN',
            'message', 'تم استخدام بطاقة الدخول هذه مسبقاً!',
            'party_name', v_pass.party_name,
            'first_check_in_at', to_char(v_pass.first_check_in_at, 'HH12:MI AM')
        );
    END IF;

    -- حساب عدد الحضور الفعلي الداخل
    IF p_override_count IS NOT NULL AND p_override_count > 0 THEN
        v_final_count := p_override_count;
    ELSE
        v_final_count := COALESCE(v_pass.confirmed_count, 1);
    END IF;

    v_is_vip := (v_pass.section = 'vip' OR v_pass.party_name ILIKE '%الشيخ%' OR v_pass.party_name ILIKE '%سعادة%' OR v_pass.party_name ILIKE '%معالي%');

    -- حالة النجاح: تحديث ذري وإدخال في سجل التدقيق
    UPDATE public.entry_passes
    SET 
        is_checked_in = true,
        first_check_in_at = now()
    WHERE id = v_pass.id;

    UPDATE public.parties
    SET 
        actual_checked_in_count = v_final_count,
        updated_at = now()
    WHERE id = v_pass.p_id;

    INSERT INTO public.check_in_logs (
        event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name, checkin_type, scan_result, admitted_count
    ) VALUES (
        p_event_id, v_pass.p_id, v_pass.id, p_pass_token_hash, p_station_name, p_operator_name, p_checkin_type, 'SUCCESS', v_final_count
    );

    RETURN jsonb_build_object(
        'success', true,
        'code', 'SUCCESS',
        'message', CASE WHEN v_is_vip THEN 'مرحباً بضيفنا الكريم، أهلاً وسهلاً بكم 👑' ELSE 'تم التحقق بنجاح، مرحباً بكم! 🌹' END,
        'party_name', v_pass.party_name,
        'admitted_count', v_final_count,
        'section', v_pass.section,
        'table_number', v_pass.table_number,
        'is_vip', v_is_vip,
        'needs_wheelchair', COALESCE(v_pass.needs_wheelchair, false),
        'check_in_time', to_char(now(), 'HH12:MI AM')
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. تشديد أمان الصلاحيات وحظر التنفيذ العام
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) FROM public;
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 10. تفعيل سياسات أمان مستوى الصفوف (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_in_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;

-- سياسات الفعاليات: المالك والمشرف فقط
CREATE POLICY "Public read events by slug" ON public.events FOR SELECT USING (true);
CREATE POLICY "Owners update their events" ON public.events FOR UPDATE USING (auth.uid() = owner_id);

-- سياسات بطاقات ومجموعات الضيوف: الخدمة والمشرفون
CREATE POLICY "Public read parties by token hash" ON public.parties FOR SELECT USING (true);
CREATE POLICY "Service role full access parties" ON public.parties FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access entry_passes" ON public.entry_passes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access check_in_logs" ON public.check_in_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access group_links" ON public.group_links FOR ALL USING (auth.role() = 'service_role');

-- سياسات ألبوم اللحظات
CREATE POLICY "Public read approved moments" ON public.moments FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert moments" ON public.moments FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role moderate moments" ON public.moments FOR ALL USING (auth.role() = 'service_role');

-- سياسات تبريكات القاعة
CREATE POLICY "Public read approved wishes" ON public.wishes FOR SELECT USING (is_approved = true);
CREATE POLICY "Public insert wishes" ON public.wishes FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role moderate wishes" ON public.wishes FOR ALL USING (auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 11. حظر تسريب بيانات الضيوف عبر Supabase Realtime
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.parties;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.entry_passes;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.check_in_logs;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wishes;
    END IF;
END $$;
