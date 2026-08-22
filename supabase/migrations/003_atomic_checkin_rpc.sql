-- ==============================================================================
-- Migration: 003_atomic_checkin_rpc.sql
-- Description: Hardened Atomic Check-in RPC function locked to service_role with empty search_path
-- ==============================================================================

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
SET search_path = ''
AS $$
DECLARE
    v_pass RECORD;
    v_final_count INT;
    v_is_vip BOOLEAN;
BEGIN
    -- 1. Atomic search and row-level locking
    SELECT ep.*, p.id AS p_id, p.event_id AS p_event_id, p.party_name, p.confirmed_count, p.allowed_count, p.section, p.rsvp_status, p.table_number, p.needs_wheelchair, p.is_vip AS p_is_vip, p.host_name
    INTO v_pass
    FROM public.entry_passes ep
    JOIN public.parties p ON ep.party_id = p.id
    WHERE ep.pass_token_hash = p_pass_token_hash 
      AND p.event_id = p_event_id
    FOR UPDATE OF ep;

    -- Case: Pass not found or belongs to another event
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

    -- Case: Revoked Pass
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

    -- Case: Cross-Section Warning
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

    -- Case: Already Checked-In (Anti-Replay)
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

    -- Compute Admitted Count
    IF p_override_count IS NOT NULL AND p_override_count > 0 THEN
        v_final_count := p_override_count;
    ELSE
        v_final_count := COALESCE(v_pass.confirmed_count, 1);
    END IF;

    v_is_vip := COALESCE(v_pass.p_is_vip, false) OR (v_pass.section = 'vip');

    -- Atomic Update and Audit Log
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

-- Security Grants: Strictly Locked Down to service_role ONLY (No public/anon/authenticated access)
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) FROM public;
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN) TO service_role;
