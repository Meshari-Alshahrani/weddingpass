-- ==============================================================================
-- Migration: 005_atomic_rsvp_and_group_rpc.sql
-- Description: ACID Atomic Transactions for RSVP Confirmation and Group Quota Registration
-- ==============================================================================

-- 1. Atomic RSVP Confirmation Procedure
CREATE OR REPLACE FUNCTION public.submit_party_rsvp_atomic(
    p_party_id UUID,
    p_status TEXT,
    p_attending_count INT,
    p_notes TEXT DEFAULT NULL,
    p_needs_wheelchair BOOLEAN DEFAULT NULL,
    p_raw_pass_token TEXT DEFAULT NULL,
    p_pass_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_party RECORD;
    v_pass RECORD;
    v_prev_status TEXT;
    v_prev_count INT;
    v_final_count INT;
BEGIN
    -- 1. Lock party row
    SELECT * INTO v_party
    FROM public.parties
    WHERE id = p_party_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'PARTY_NOT_FOUND', 'message', 'لم يتم العثور على سجل الدعوة');
    END IF;

    v_prev_status := v_party.rsvp_status;
    v_prev_count := COALESCE(v_party.confirmed_count, 0);

    -- 2. Update Party details
    IF p_status = 'confirmed' THEN
        v_final_count := LEAST(GREATEST(1, p_attending_count), v_party.allowed_count);
    ELSE
        v_final_count := 0;
    END IF;

    UPDATE public.parties
    SET 
        rsvp_status = p_status,
        confirmed_count = v_final_count,
        rsvp_at = now(),
        notes = COALESCE(p_notes, notes),
        needs_wheelchair = COALESCE(p_needs_wheelchair, needs_wheelchair),
        updated_at = now()
    WHERE id = p_party_id;

    -- 3. Manage Entry Pass
    IF p_status = 'confirmed' THEN
        SELECT * INTO v_pass FROM public.entry_passes WHERE party_id = p_party_id;
        IF NOT FOUND AND p_pass_hash IS NOT NULL THEN
            INSERT INTO public.entry_passes (
                party_id, pass_token_hash, status, is_checked_in, created_at
            ) VALUES (
                p_party_id, p_pass_hash, 'active', false, now()
            ) RETURNING * INTO v_pass;
        END IF;
    END IF;

    -- 4. Safe quota adjustment if party belongs to group link
    IF v_party.group_link_id IS NOT NULL THEN
        IF p_status = 'declined' AND v_prev_status = 'confirmed' AND v_prev_count > 0 THEN
            UPDATE public.group_links
            SET confirmed_count = GREATEST(0, confirmed_count - v_prev_count)
            WHERE id = v_party.group_link_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'RSVP_UPDATED',
        'status', p_status,
        'confirmed_count', v_final_count,
        'message', CASE WHEN p_status = 'confirmed' THEN 'تم تأكيد حضورك بنجاح 🌹' ELSE 'تم تسجيل اعتذارك الكريمة، ونقدر ظرفك 🌹' END
    );
END;
$$;

-- 2. Atomic Group Guest Registration & Quota Locking Procedure
CREATE OR REPLACE FUNCTION public.register_group_guest_atomic(
    p_event_id UUID,
    p_slug TEXT,
    p_party_id UUID,
    p_party_name TEXT,
    p_primary_phone TEXT,
    p_seats INT,
    p_invitation_hash TEXT,
    p_pass_hash TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_group RECORD;
    v_party RECORD;
    v_pass RECORD;
BEGIN
    -- 1. Lock group link row
    SELECT * INTO v_group
    FROM public.group_links
    WHERE event_id = p_event_id AND slug = p_slug AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'GROUP_NOT_FOUND', 'message', 'رابط المجموعة غير موجود أو تم إيقافه');
    END IF;

    -- 2. Strict Quota Boundary Check
    IF v_group.limit_mode = 'strict' AND v_group.max_capacity IS NOT NULL THEN
        IF (v_group.confirmed_count + p_seats) > v_group.max_capacity THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'QUOTA_EXCEEDED',
                'remaining', GREATEST(0, v_group.max_capacity - v_group.confirmed_count),
                'message', 'عذراً، اكتملت جميع المقاعد المخصصة لهذه المجموعة 🌹'
            );
        END IF;
    END IF;

    -- 3. Atomic Allocation of seats
    UPDATE public.group_links
    SET confirmed_count = confirmed_count + p_seats
    WHERE id = v_group.id;

    -- 4. Insert Party
    INSERT INTO public.parties (
        id, event_id, host_name, group_link_id, group_name, party_name,
        primary_phone, allowed_count, confirmed_count, actual_checked_in_count,
        needs_wheelchair, is_vip, invitation_token_hash, dispatch_status,
        rsvp_status, rsvp_at, section, notes, created_at, updated_at
    ) VALUES (
        p_party_id, p_event_id, v_group.host_name, v_group.id, v_group.group_name, p_party_name,
        p_primary_phone, p_seats, p_seats, 0,
        false, false, p_invitation_hash, 'sent',
        'confirmed', now(), v_group.section, p_notes, now(), now()
    ) RETURNING * INTO v_party;

    -- 5. Insert Entry Pass
    INSERT INTO public.entry_passes (
        party_id, pass_token_hash, status, is_checked_in, created_at
    ) VALUES (
        p_party_id, p_pass_hash, 'active', false, now()
    ) RETURNING * INTO v_pass;

    -- 6. Insert Wish if notes present
    IF p_notes IS NOT NULL AND length(trim(p_notes)) > 3 THEN
        INSERT INTO public.wishes (
            event_id, party_id, party_name, message, is_approved, created_at
        ) VALUES (
            p_event_id, p_party_id, p_party_name, p_notes, true, now()
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'code', 'SUCCESS',
        'party_id', p_party_id,
        'message', 'تم تأكيد حضورك بنجاح! بطاقة الدخول الخاصة بك جاهزة 🌹'
    );
END;
$$;

-- Security Grants: Strictly Locked Down to service_role ONLY
REVOKE EXECUTE ON FUNCTION public.submit_party_rsvp_atomic(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_party_rsvp_atomic(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_group_guest_atomic(UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_group_guest_atomic(UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT) TO service_role;
