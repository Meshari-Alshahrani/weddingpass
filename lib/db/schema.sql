-- ==============================================================================
-- WeddingPass Database Schema (PostgreSQL / Supabase DDL)
-- Version: 2.1 (Production Hardened)
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
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. جدول المجموعات والعائلات المدعوة (Parties)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    party_name TEXT NOT NULL,                         -- اسم الداعي أو العائلة
    primary_phone TEXT,                               -- رقم الجوال بصيغة دولية
    allowed_count INT NOT NULL DEFAULT 1,             -- الحد الأقصى المسموح به للدعوة
    confirmed_count INT DEFAULT 0,                    -- العدد الذي أكد الضيف حضوره
    actual_checked_in_count INT DEFAULT 0,            -- العدد الفعلي الذي دخل عند البوابة
    invitation_token_hash TEXT UNIQUE NOT NULL,       -- SHA-256 Hash لرمز الدعوة الشخصي
    
    -- تتبع دورة حياة الدعوة
    dispatch_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (dispatch_status IN ('draft', 'whatsapp_opened', 'sent')),
    rsvp_status TEXT NOT NULL DEFAULT 'unopened' 
        CHECK (rsvp_status IN ('unopened', 'viewed', 'confirmed', 'declined')),
    rsvp_at TIMESTAMPTZ,
    section TEXT DEFAULT 'general',                   -- 'men', 'women', 'vip', 'groom_family', 'bride_family'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. جدول أعضاء المجموعة التفصيليين (Party Members - اختياري)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.party_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 4. جدول بطاقات الدخول المستقلة (Entry Passes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entry_passes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id UUID UNIQUE NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
    pass_token_hash TEXT UNIQUE NOT NULL,             -- SHA-256 Hash لرمز بطاقة الدخول Opaque
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    is_checked_in BOOLEAN NOT NULL DEFAULT false,
    first_check_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 5. جدول محطات وحسابات مشغلي البوابات (Gate Stations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gate_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    station_name TEXT NOT NULL,                       -- مثال: بوابة الرجال 1
    operator_username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_id, operator_username)
);

-- ------------------------------------------------------------------------------
-- 6. جدول سجل التدقيق لعمليات الدخول (Check-in Logs)
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
    scan_result TEXT NOT NULL 
        CHECK (scan_result IN ('SUCCESS', 'ALREADY_CHECKED_IN', 'REVOKED', 'NOT_FOUND', 'DECLINED', 'MANUAL_OVERRIDE')),
    admitted_count INT DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- فهارس الأداء الفائق والبحث السريع
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parties_invitation_hash ON public.parties(invitation_token_hash);
CREATE INDEX IF NOT EXISTS idx_entry_passes_hash ON public.entry_passes(pass_token_hash);
CREATE INDEX IF NOT EXISTS idx_check_in_logs_event ON public.check_in_logs(event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_parties_search ON public.parties(event_id, party_name, primary_phone);

-- ------------------------------------------------------------------------------
-- 7. إجراء التحقق الذري المشدد للدخول (Atomic Check-in RPC with Row Lock)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_secure_checkin(
    p_event_id UUID,
    p_pass_token_hash TEXT,
    p_station_name TEXT,
    p_operator_name TEXT,
    p_checkin_type TEXT DEFAULT 'QR_SCAN',
    p_override_count INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_pass RECORD;
    v_final_count INT;
BEGIN
    -- 1. البحث وقفل سجل بطاقة الدخول فوراً لمنع أي تزامن
    SELECT ep.*, p.id AS p_id, p.event_id AS p_event_id, p.party_name, p.confirmed_count, p.allowed_count, p.section, p.rsvp_status
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

    -- حالة: تم استخدام البطاقة مسبقاً (Double Check-in Attempt)
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
        'message', 'تم التحقق بنجاح، مرحباً بكم!',
        'party_name', v_pass.party_name,
        'admitted_count', v_final_count,
        'section', v_pass.section,
        'check_in_time', to_char(now(), 'HH12:MI AM')
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. تحصين مسار البحث (PostgreSQL search_path Hijacking Defense)
-- ------------------------------------------------------------------------------
ALTER FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT) SET search_path = public, pg_temp;

-- تشديد أمان الصلاحيات
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT) FROM public;
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 8. حظر تسريب بيانات الضيوف عبر Supabase Realtime
-- ------------------------------------------------------------------------------
-- حصر البث الحي حصراً على جدول تبريكات القاعة وتعطيله عن الجداول الحساسة
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.parties;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.entry_passes;
        ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.check_in_logs;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.wishes;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 9. سياسات أمان سلة التخزين (Supabase Storage RLS Lockdown)
-- ------------------------------------------------------------------------------
-- سياسات سلة moments لمنع الحذف والتعديل من غير المنظم
-- INSERT INTO storage.buckets (id, name, public) VALUES ('moments', 'moments', true) ON CONFLICT DO NOTHING;
-- CREATE POLICY "Public read approved moments" ON storage.objects FOR SELECT USING (bucket_id = 'moments');
-- CREATE POLICY "Guests insert moments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'moments');
-- CREATE POLICY "Service role only delete moments" ON storage.objects FOR DELETE USING (auth.role() = 'service_role');

