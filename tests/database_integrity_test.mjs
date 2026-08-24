import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// ============================================================================
// Database schema drift guards (run in npm test, no live DB required).
// These pin the security-relevant SQL invariants so future edits cannot
// silently remove them. Live verification additionally runs once via
// `npm run test:supabase` after migrations are applied.
// ============================================================================

const m007 = await read('supabase/migrations/007_registration_integrity.sql');

// --- 1. Offline reconciliation idempotency lives INSIDE the RPC -----------
assert(m007.includes('p_queue_id TEXT DEFAULT NULL'), 'process_secure_checkin must accept p_queue_id');
assert(m007.includes("metadata->>'queue_id' = p_queue_id"), 'RPC must pre-check queue_id and replay the original verdict');
assert(m007.includes("'final_result', v_response"), 'RPC must persist the full terminal result for idempotent replay');
assert(
  m007.includes('uq_check_in_logs_queue_id'),
  'Partial unique index must exist as a race backstop for duplicate queue ids'
);

// --- 2. Legacy function identity is dropped before redefinition ------------
const dropIdx = m007.indexOf('DROP FUNCTION IF EXISTS public.process_secure_checkin(UUID, TEXT, TEXT, TEXT, TEXT, INT, TEXT, BOOLEAN);');
const create10ArgIdx = m007.indexOf('CREATE OR REPLACE FUNCTION public.process_secure_checkin(\n    p_event_id UUID,\n    p_pass_token_hash TEXT,\n    p_station_name TEXT,\n    p_operator_name TEXT,\n    p_checkin_type TEXT DEFAULT \'QR_SCAN\',\n    p_override_count INT DEFAULT NULL,\n    p_gate_section TEXT DEFAULT \'men\',\n    p_force_cross_section BOOLEAN DEFAULT false,\n    p_queue_id TEXT DEFAULT NULL');
assert(dropIdx !== -1, 'Legacy 8-arg process_secure_checkin signature must be dropped explicitly');
assert(create10ArgIdx !== -1, 'New 10-arg process_secure_checkin definition expected');
assert(dropIdx < create10ArgIdx, 'DROP of legacy signature must precede CREATE OR REPLACE to avoid a live overloaded orphan');

// --- 3. Duplicate registration guard WITHOUT pass rotation ------------------
assert(m007.includes("code', 'ALREADY_REGISTERED'"), 'Duplicate registration must return ALREADY_REGISTERED');
assert(!m007.includes('regenerate'), 'Migration must never rotate passes automatically (DoS protection)');
assert(
  m007.includes('uq_parties_event_group_phone'),
  'Partial unique index on (event_id, group_link_id, primary_phone) required'
);

// --- 4. RSVP status allow-list ----------------------------------------------
assert(m007.includes("p_status NOT IN ('confirmed', 'declined')"), 'submit_party_rsvp_atomic must validate status against an allow-list');

// --- 5. Wishes quarantine default -------------------------------------------
assert(m007.includes('ALTER TABLE public.wishes ALTER COLUMN is_approved SET DEFAULT false'), 'wishes.is_approved must default to false (ADR-005)');
assert(m007.includes("'code', 'INVALID_STATUS'"), 'Invalid RSVP status code defined');

// --- 6. ABORT-first constraint validation pattern ----------------------------
const abortCount = (m007.match(/RAISE EXCEPTION USING/g) || []).length;
assert(abortCount >= 3, 'Constraint validations must ABORT with diagnostics instead of silently repairing data');
assert(m007.includes('chk_parties_phone_normalized'), 'Normalized Saudi phone CHECK constraint required');
assert(m007.includes('chk_parties_allowed_positive'), 'allowed_count >= 1 CHECK required');
assert(m007.includes('chk_parties_confirmed_within_allowed'), 'confirmed_count <= allowed_count CHECK required');
assert(!m007.includes('actual_checked_in_count <= '), 'No upper bound on actual_checked_in_count (supervisor override is intentional, ADR-031)');

// --- 7. search_parties: parameterized, INVOKER, service_role only -----------
assert(m007.includes('SECURITY INVOKER') && m007.includes('search_parties'), 'search_parties must be SECURITY INVOKER (DEFINER stays the exception)');
assert(m007.includes("REVOKE ALL ON FUNCTION public.search_parties(UUID, TEXT) FROM PUBLIC, anon, authenticated;"), 'search_parties EXECUTE must be revoked from PUBLIC/anon/authenticated');
assert(m007.includes("GRANT EXECUTE ON FUNCTION public.search_parties(UUID, TEXT) TO service_role;"), 'search_parties EXECUTE granted to service_role only');
assert(m007.includes("replace(replace(replace(v_needle, '\\', '\\\\'), '%', '\\%'), '_', '\\_')"), 'User LIKE wildcards must be escaped inside the RPC');

// --- 8. Event-scoped indexes exist for RLS/policy columns -------------------
const m001 = await read('supabase/migrations/001_initial_schema.sql');
for (const idx of [
  'idx_check_in_logs_event ON public.check_in_logs(event_id',
  'idx_moments_event ON public.moments(event_id',
  'idx_wishes_event ON public.wishes(event_id',
  'idx_parties_search ON public.parties(event_id',
]) {
  assert(m001.includes(idx), `001 must keep event-scoped index: ${idx.split(' ON ')[0]}`);
}
// entry_passes.party_id UNIQUE enforces one-pass-per-party at DB level.
assert(m001.includes('party_id UUID UNIQUE NOT NULL'), 'entry_passes.party_id UNIQUE (one pass per party) must remain');

// --- 9. Repository layer actually uses the parameterized search -------------
const supabaseRepo = await read('lib/repositories/supabase/SupabaseRepository.ts');
assert(supabaseRepo.includes("rpc('search_parties'"), 'SupabaseRepository.searchParties must delegate to the search_parties RPC');
assert(!supabaseRepo.includes('.or(`party_name.ilike.'), 'Raw .or() filter assembly with user input must not return');

console.log('✔ Database integrity drift guards verified (migrations 001/007 + repository wiring)');
