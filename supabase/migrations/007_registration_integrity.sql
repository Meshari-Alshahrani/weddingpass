-- ==============================================================================
-- Migration: 007_registration_integrity.sql
--
-- Registration & check-in integrity hardening (v6.0.0):
--   1. process_secure_checkin gains offline-reconciliation idempotency
--      (p_queue_id / p_device_metadata stored in check_in_logs.metadata).
--      A repeated queueId replays the ORIGINAL terminal verdict.
--   2. register_group_guest_atomic rejects duplicate (event, group, phone)
--      registrations WITHOUT rotating or revoking the existing pass
--      (prevents QR-invalidation DoS against legitimate guests), clamps seats
--      to max_seats_per_guest, and quarantines registration notes as wishes.
--   3. submit_party_rsvp_atomic validates p_status against an allow-list.
--   4. Database-level invariants: normalized-phone CHECK, counter CHECKs,
--      and a partial UNIQUE index against duplicate group registrations.
--      Every constraint validates existing data FIRST and ABORTS with a
--      diagnostic report instead of silently choosing a winning record —
--      data repair is a business decision, not a schema migration.
--   5. wishes quarantine becomes the schema default (is_approved = false).
--
-- Idempotent: safe to re-run. SECURITY DEFINER remains limited to the three
-- pre-existing atomic RPCs (locked to service_role); search helpers stay INVOKER.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. process_secure_checkin — add offline reconciliation idempotency
--
-- CRITICAL IDENTITY NOTE: this function gains two parameters relative to
-- migration 003. In PostgreSQL, CREATE OR REPLACE with a different argument
-- list creates a NEW overloaded function instead of replacing, which would
-- leave the legacy 8-arg version live with its own grants. The legacy
-- signature is therefore dropped immediately BEFORE the new definition.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.process_secure_checkin(
    p_event_id UUID,
    p_pass_token_hash TEXT,
    p_station_name TEXT,
    p_operator_name TEXT,
    p_checkin_type TEXT DEFAULT 'QR_SCAN',
    p_override_count INT DEFAULT NULL,
    p_gate_section TEXT DEFAULT 'men',
    p_force_cross_section BOOLEAN DEFAULT false,
    p_queue_id TEXT DEFAULT NULL,
    p_device_metadata JSONB DEFAULT NULL
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
    v_response JSONB;
    v_log_party_id UUID;
    v_log_pass_id UUID;
    v_log_scan_result public.check_in_logs.scan_result%TYPE;
    v_log_admitted INT;
BEGIN
    -- -------------------------------------------------------------------
    -- 0. Offline idempotency replay: a retried queue item returns the
    --    original terminal verdict verbatim (never double-charges a guest).
    --    The partial unique index below is only a race backstop; THIS
    --    pre-check is the actual idempotency mechanism (ADR-030).
    -- -------------------------------------------------------------------
    IF p_queue_id IS NOT NULL THEN
        SELECT metadata->'final_result' AS cached_result
        FROM public.check_in_logs
        WHERE metadata->>'queue_id' = p_queue_id
        ORDER BY created_at DESC
        LIMIT 1
        INTO v_response;

        IF v_response IS NOT NULL THEN
            RETURN v_response;
        END IF;
    END IF;

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
        v_response := jsonb_build_object(
            'success', false,
            'code', 'NOT_FOUND',
            'message', 'رمز الدخول غير مسجل في هذه المناسبة'
        );
        v_log_party_id := NULL;
        v_log_pass_id := NULL;
        v_log_scan_result := 'NOT_FOUND';
        v_log_admitted := 0;
        GOTO write_log;
    END IF;

    v_log_party_id := v_pass.p_id;
    v_log_pass_id := v_pass.id;

    -- Case: Revoked Pass
    IF v_pass.status = 'revoked' THEN
        v_response := jsonb_build_object(
            'success', false,
            'code', 'REVOKED',
            'message', 'تم إلغاء صلاحية بطاقة الدخول هذه مسبقاً من قِبل المنظم',
            'party_name', v_pass.party_name
        );
        v_log_scan_result := 'REVOKED';
        v_log_admitted := 0;
        GOTO write_log;
    END IF;

    -- Case: Cross-Section Warning
    IF NOT p_force_cross_section AND p_gate_section <> 'general' AND v_pass.section <> 'general' AND v_pass.section <> p_gate_section THEN
        v_response := jsonb_build_object(
            'success', false,
            'code', 'CROSS_SECTION_WARNING',
            'message', CASE WHEN v_pass.section = 'women' THEN 'هذه البطاقة مخصصة لقسم النساء 🌹' ELSE 'هذه البطاقة مخصصة لقسم الرجال ⚔️' END,
            'party_name', v_pass.party_name,
            'section', v_pass.section,
            'target_gate', CASE WHEN v_pass.section = 'women' THEN 'بوابة النساء' ELSE 'بوابة الرجال' END
        );
        v_log_scan_result := 'CROSS_SECTION_WARNING';
        v_log_admitted := 0;
        GOTO write_log;
    END IF;

    -- Case: Already Checked-In (Anti-Replay)
    IF v_pass.is_checked_in THEN
        v_response := jsonb_build_object(
            'success', false,
            'code', 'ALREADY_CHECKED_IN',
            'message', 'تم استخدام بطاقة الدخول هذه مسبقاً!',
            'party_name', v_pass.party_name,
            'first_check_in_at', to_char(v_pass.first_check_in_at, 'HH12:MI AM')
        );
        v_log_scan_result := 'ALREADY_CHECKED_IN';
        v_log_admitted := 0;
        GOTO write_log;
    END IF;

    -- Compute Admitted Count
    IF p_override_count IS NOT NULL AND p_override_count > 0 THEN
        v_final_count := p_override_count;
    ELSE
        v_final_count := COALESCE(v_pass.confirmed_count, 1);
    END IF;

    v_is_vip := COALESCE(v_pass.p_is_vip, false) OR (v_pass.section = 'vip');

    -- Atomic Update
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

    v_response := jsonb_build_object(
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
    v_log_scan_result := 'SUCCESS';
    v_log_admitted := v_final_count;

    <<write_log>>
    INSERT INTO public.check_in_logs (
        event_id, party_id, entry_pass_id, scanned_token_hash, station_name, operator_name,
        checkin_type, scan_result, admitted_count, metadata
    ) VALUES (
        p_event_id, v_log_party_id, v_log_pass_id, p_pass_token_hash, p_station_name, p_operator_name,
        p_checkin_type, v_log_scan_result, v_log_admitted,
        CASE
            WHEN p_queue_id IS NOT NULL THEN
                jsonb_build_object(
                    'queue_id', p_queue_id,
                    'mode', CASE WHEN p_device_metadata IS NOT NULL THEN 'OFFLINE_RECONCILED' ELSE 'ONLINE_CHECKIN' END,
                    'device', p_device_metadata,
                    'final_result', v_response,
                    'reconciled_at', now()
                )
            ELSE NULL
        END
    );

    RETURN v_response;
END;
$$;

-- Race backstop ONLY: two concurrent retries of the same queueId cannot both
-- insert; the loser's transaction rolls back cleanly and its client retry hits
-- the pre-check above.
CREATE UNIQUE INDEX IF NOT EXISTS uq_check_in_logs_queue_id
    ON public.check_in_logs ((metadata->>'queue_id'))
    WHERE metadata IS NOT NULL AND metadata->>'queue_id' IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. register_group_guest_atomic — duplicate guard (no rotation), seat clamp
-- -----------------------------------------------------------------------------
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
    v_seats INT;
    v_existing RECORD;
BEGIN
    -- 1. Lock group link row (serializes all registrations within this group)
    SELECT * INTO v_group
    FROM public.group_links
    WHERE event_id = p_event_id AND slug = p_slug AND is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 'GROUP_NOT_FOUND', 'message', 'رابط المجموعة غير موجود أو تم إيقافه');
    END IF;

    -- Clamp requested seats server-side: never trust the client value.
    v_seats := GREATEST(1, LEAST(COALESCE(p_seats, 1), COALESCE(v_group.max_seats_per_guest, COALESCE(p_seats, 1))));

    -- 2. Duplicate-phone guard scoped to (event, group).
    --    Deliberately NO rotation / NO revocation here: knowing a phone number
    --    must never invalidate a legitimate guest's QR (DoS protection).
    --    Recovery happens through the original invitation link or manual admin
    --    reissue. Safe from races because the group row lock above already
    --    serializes concurrent registrations for this group.
    SELECT id, party_name INTO v_existing
    FROM public.parties
    WHERE event_id = p_event_id
      AND group_link_id = v_group.id
      AND primary_phone = p_primary_phone
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'code', 'ALREADY_REGISTERED',
            'existing_party_id', v_existing.id,
            'party_name', v_existing.party_name,
            'remaining', GREATEST(0, COALESCE(v_group.max_capacity, 0) - v_group.confirmed_count),
            'message', format('أهلاً بك مجدداً يا %s! تم تسجيل هذا الرقم مسبقاً في هذه المجموعة — استخدم رابط الدعوة الأصلي لاستعراض بطاقة دخولك 🌹', v_existing.party_name)
        );
    END IF;

    -- 3. Strict quota boundary check (using clamped seats)
    IF v_group.limit_mode = 'strict' AND v_group.max_capacity IS NOT NULL THEN
        IF (v_group.confirmed_count + v_seats) > v_group.max_capacity THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 'QUOTA_EXCEEDED',
                'remaining', GREATEST(0, v_group.max_capacity - v_group.confirmed_count),
                'message', 'عذراً، اكتملت جميع المقاعد المخصصة لهذه المجموعة 🌹'
            );
        END IF;
    END IF;

    -- 4. Atomic allocation of seats
    UPDATE public.group_links
    SET confirmed_count = confirmed_count + v_seats
    WHERE id = v_group.id;

    -- 5. Insert Party
    INSERT INTO public.parties (
        id, event_id, host_name, group_link_id, group_name, party_name,
        primary_phone, allowed_count, confirmed_count, actual_checked_in_count,
        needs_wheelchair, is_vip, invitation_token_hash, dispatch_status,
        rsvp_status, rsvp_at, section, notes, created_at, updated_at
    ) VALUES (
        p_party_id, p_event_id, v_group.host_name, v_group.id, v_group.group_name, p_party_name,
        p_primary_phone, v_seats, v_seats, 0,
        false, false, p_invitation_hash, 'sent',
        'confirmed', now(), v_group.section, p_notes, now(), now()
    );

    -- 6. Insert Entry Pass
    INSERT INTO public.entry_passes (
        party_id, pass_token_hash, status, is_checked_in, created_at
    ) VALUES (
        p_party_id, p_pass_hash, 'active', false, now()
    );

    -- 7. Registration notes become a wish — QUARANTINED until approved
    --    (consistent with ADR-005 moderation flow; was previously auto-approved).
    IF p_notes IS NOT NULL AND length(trim(p_notes)) > 3 THEN
        INSERT INTO public.wishes (
            event_id, party_id, party_name, message, is_approved, created_at
        ) VALUES (
            p_event_id, p_party_id, p_party_name, p_notes, false, now()
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

-- -----------------------------------------------------------------------------
-- 3. submit_party_rsvp_atomic — strict status allow-list
-- -----------------------------------------------------------------------------
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
    IF p_status NOT IN ('confirmed', 'declined') THEN
        RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS', 'message', 'حالة تأكيد الحضور غير صالحة');
    END IF;

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
        v_final_count := LEAST(GREATEST(1, COALESCE(p_attending_count, 1)), v_party.allowed_count);
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
            );
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

-- -----------------------------------------------------------------------------
-- 4. Re-assert EXECUTE lockdown on all three atomic RPCs (service_role only).
-- -----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN, TEXT, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.register_group_guest_atomic(UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_group_guest_atomic(UUID, TEXT, UUID, TEXT, TEXT, INT, TEXT, TEXT, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.submit_party_rsvp_atomic(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_party_rsvp_atomic(UUID, TEXT, INT, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;

-- NOTE: register_group_guest_atomic / submit_party_rsvp_atomic keep their
-- original signatures, so CREATE OR REPLACE above replaced them in place
-- (grants preserved); the REVOKE/GRANT pair re-asserts lockdown defensively.

-- -----------------------------------------------------------------------------
-- 5. Database-level business invariants.
--    Pattern: VALIDATE FIRST -> ABORT WITH REPORT -> only then create.
-- -----------------------------------------------------------------------------

-- 5a. Duplicate group registrations must be resolved by humans first.
DO $$
DECLARE
    v_dupes INT;
BEGIN
    SELECT COUNT(*) INTO v_dupes FROM (
        SELECT 1 FROM public.parties
        WHERE group_link_id IS NOT NULL AND primary_phone IS NOT NULL
        GROUP BY event_id, group_link_id, primary_phone
        HAVING COUNT(*) > 1
    ) d;

    IF v_dupes > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'integrity_constraint_violation',
            MESSAGE = 'Migration 007 aborted: duplicate (event_id, group_link_id, primary_phone) rows exist.',
            DETAIL = 'Run the diagnostic below, decide which record survives (business decision), fix the data, then re-run this migration. ' ||
                     'SELECT event_id, group_link_id, primary_phone, COUNT(*) FROM public.parties WHERE group_link_id IS NOT NULL AND primary_phone IS NOT NULL GROUP BY 1,2,3 HAVING COUNT(*) > 1;';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_parties_event_group_phone
    ON public.parties (event_id, group_link_id, primary_phone)
    WHERE group_link_id IS NOT NULL AND primary_phone IS NOT NULL;

-- Helper for CHECK validations: abort when violating rows exist.

-- 5b. Normalized Saudi phone format (application normalizes on every write).
DO $$
DECLARE
    v_bad INT;
    v_sample TEXT;
BEGIN
    SELECT COUNT(*), MIN(primary_phone) INTO v_bad, v_sample
    FROM public.parties
    WHERE primary_phone IS NOT NULL AND primary_phone !~ '^9665[0-9]{8}$';

    IF v_bad > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'integrity_constraint_violation',
            MESSAGE = format('Migration 007 aborted: %s parties have non-normalized primary_phone values (sample: %s).', v_bad, v_sample),
            DETAIL = 'Expected E.164-normalized Saudi mobiles like 966501234567. Normalize the rows below, then re-run. ' ||
                     'SELECT id, primary_phone FROM public.parties WHERE primary_phone IS NOT NULL AND primary_phone !~ ''^9665[0-9]{8}$'';';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parties_phone_normalized') THEN
        ALTER TABLE public.parties
            ADD CONSTRAINT chk_parties_phone_normalized
            CHECK (primary_phone IS NULL OR primary_phone ~ '^9665[0-9]{8}$');
    END IF;
END $$;

-- 5c. Counter sanity CHECKs. NOTE: actual_checked_in_count may legitimately
-- EXCEED confirmed_count via supervisor override (meal counting, ADR-031),
-- so no upper bound is enforced on it.
DO $$
DECLARE
    v_bad INT;
BEGIN
    SELECT COUNT(*) INTO v_bad FROM public.parties WHERE allowed_count < 1;
    IF v_bad > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'integrity_constraint_violation',
            MESSAGE = format('Migration 007 aborted: %s parties violate allowed_count >= 1.', v_bad),
            DETAIL = 'Fix the rows first: SELECT id, allowed_count FROM public.parties WHERE allowed_count < 1;';
    END IF;

    SELECT COUNT(*) INTO v_bad FROM public.parties WHERE COALESCE(confirmed_count, 0) < 0 OR COALESCE(actual_checked_in_count, 0) < 0;
    IF v_bad > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'integrity_constraint_violation',
            MESSAGE = format('Migration 007 aborted: %s parties violate non-negative counters.', v_bad),
            DETAIL = 'Fix the rows first: SELECT id, confirmed_count, actual_checked_in_count FROM public.parties WHERE COALESCE(confirmed_count,0) < 0 OR COALESCE(actual_checked_in_count,0) < 0;';
    END IF;

    SELECT COUNT(*) INTO v_bad FROM public.parties WHERE COALESCE(confirmed_count, 0) > allowed_count;
    IF v_bad > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'integrity_constraint_violation',
            MESSAGE = format('Migration 007 aborted: %s parties have confirmed_count exceeding allowed_count.', v_bad),
            DETAIL = 'Decide which value is authoritative per row (business decision), fix, then re-run. ' ||
                     'SELECT id, allowed_count, confirmed_count FROM public.parties WHERE COALESCE(confirmed_count,0) > allowed_count;';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parties_allowed_positive') THEN
        ALTER TABLE public.parties
            ADD CONSTRAINT chk_parties_allowed_positive CHECK (allowed_count >= 1);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parties_counters_nonnegative') THEN
        ALTER TABLE public.parties
            ADD CONSTRAINT chk_parties_counters_nonnegative
            CHECK ((confirmed_count IS NULL OR confirmed_count >= 0) AND (actual_checked_in_count IS NULL OR actual_checked_in_count >= 0));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parties_confirmed_within_allowed') THEN
        ALTER TABLE public.parties
            ADD CONSTRAINT chk_parties_confirmed_within_allowed
            CHECK (COALESCE(confirmed_count, 0) <= allowed_count);
    END IF;
END $$;

-- 5d. Wishes quarantine becomes the schema default (ADR-005 alignment).
ALTER TABLE public.wishes ALTER COLUMN is_approved SET DEFAULT false;

-- -----------------------------------------------------------------------------
-- 5. Parameterized guest search (replaces raw PostgREST `.or()` filter strings).
--
--    SECURITY INVOKER by design: the only caller is the Next.js server via the
--    service-role key, so no DEFINER elevation is needed (DEFINER stays the
--    exception, reserved for the three atomic transactional RPCs above).
--    LIKE wildcards typed by the user are escaped; input is length-capped.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_parties(
    p_event_id UUID,
    p_query TEXT
)
RETURNS TABLE (
    id UUID,
    party_name TEXT,
    primary_phone TEXT,
    allowed_count INT,
    confirmed_count INT,
    actual_checked_in_count INT,
    table_number TEXT,
    needs_wheelchair BOOLEAN,
    is_vip BOOLEAN,
    section TEXT,
    host_name TEXT,
    rsvp_status public.parties.rsvp_status%TYPE,
    group_name TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_needle TEXT;
    v_digits TEXT;
    v_phone_alt TEXT;
BEGIN
    v_needle := NULLIF(left(trim(COALESCE(p_query, '')), 60), '');
    IF v_needle IS NULL THEN
        RETURN;
    END IF;

    -- Escape LIKE metacharacters typed by the user, then wrap as contains().
    v_needle := '%' || replace(replace(replace(v_needle, '\', '\\'), '%', '\%'), '_', '\_') || '%';

    -- Phone UX: guests may be typed in local format (05XXXXXXXX). The stored
    -- column is E.164-normalized (9665XXXXXXXX), so derive an alternate needle.
    v_digits := regexp_replace(v_needle, '[^0-9]', '', 'g');
    IF left(v_digits, 2) = '05' AND length(v_digits) >= 4 THEN
        v_phone_alt := '%9665' || replace(substr(v_digits, 3), '%', '\%') || '%';
    ELSE
        v_phone_alt := NULL;
    END IF;

    RETURN QUERY
    SELECT p.id,
           p.party_name,
           p.primary_phone,
           p.allowed_count,
           p.confirmed_count,
           p.actual_checked_in_count,
           p.table_number,
           p.needs_wheelchair,
           p.is_vip,
           p.section,
           p.host_name,
           p.rsvp_status,
           p.group_name
    FROM public.parties p
    WHERE p.event_id = p_event_id
      AND (
            p.party_name ILIKE v_needle ESCAPE '\'
         OR p.primary_phone ILIKE v_needle ESCAPE '\'
         OR (v_phone_alt IS NOT NULL AND p.primary_phone ILIKE v_phone_alt ESCAPE '\')
          )
    ORDER BY p.party_name
    LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.search_parties(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_parties(UUID, TEXT) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. RLS/search supporting indexes (documented in the CI integrity guard).
--    idx_parties_search(event_id, ...) already serves event-scoped lookups.
-- -----------------------------------------------------------------------------
