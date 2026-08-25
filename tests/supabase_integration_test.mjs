import assert from 'node:assert/strict';
import crypto from 'node:crypto';

/**
 * REAL Supabase integration suite (staging project — NEVER production).
 *
 * Run once per deployment after migrations are applied:
 *   RUN_SUPABASE_INTEGRATION=true NODE_ENV=production npm run test:supabase
 * with .env.local holding SUPABASE_URL + SUPABASE_SECRET_KEY of the STAGING
 * project.
 *
 * Everything created here uses a `wpit_` id/phone prefix and is removed in
 * finally{} so the staging database stays clean. The suite exercises the exact
 * v6.0.0 contract end-to-end through PostgREST + atomic RPCs:
 *   join → credential issued → check-in SUCCESS → duplicate scan rejected →
 *   queue_id replay returns ORIGINAL verdict → duplicate registration stable.
 */

if (process.env.RUN_SUPABASE_INTEGRATION !== 'true') {
  console.error('Set RUN_SUPABASE_INTEGRATION=true to run against a real Supabase project.');
  process.exit(2);
}

const { supabaseAdmin, isSupabaseConfigured } = await import('../lib/db/supabase.ts');
const { hashToken, generateEntryPassToken } = await import('../lib/crypto/tokens.ts');

assert(isSupabaseConfigured && supabaseAdmin, 'SUPABASE_URL and a service-role key are required');

const RUN = `wpit_${Date.now()}`;
const EVENT_ID = '00000000-0000-4000-8000-100000000001'; // fixed wpit event (upserted, deleted at cleanup)
const GROUP_SLUG = `${RUN}_group`;
let created = { parties: [], group: null };

async function cleanup() {
  try {
    if (created.parties.length) {
      await supabaseAdmin.from('entry_passes').delete().in('party_id', created.parties);
      await supabaseAdmin.from('parties').delete().in('id', created.parties);
    }
    await supabaseAdmin.from('wishes').delete().eq('event_id', EVENT_ID).eq('party_name', RUN);
    if (created.group) await supabaseAdmin.from('group_links').delete().eq('id', created.group);
    await supabaseAdmin.from('events').delete().eq('id', EVENT_ID);
  } catch (e) {
    console.warn('cleanup warning:', e.message);
  }
}

try {
  // ---------------------------------------------------------- connectivity --
  const { error: eventsError } = await supabaseAdmin.from('events').select('id').limit(1);
  assert.equal(eventsError, null, `events table unavailable: ${eventsError?.message}`);

  // ------------------------------------------------------------- fixtures --
  await supabaseAdmin.from('events').upsert({
    id: EVENT_ID, slug: RUN, groom_name: 'تكامل', bride_name: 'حقيقي',
    event_date: new Date().toISOString().slice(0, 10), event_time: '20:00', venue_name: 'staging',
  });

  const group = await supabaseAdmin.from('group_links').insert({
    event_id: EVENT_ID, group_name: RUN, slug: GROUP_SLUG,
    host_name: 'العريس', limit_mode: 'strict', max_capacity: 5,
    confirmed_count: 0, max_seats_per_guest: 2, section: 'men', is_active: true,
  }).select().single();
  assert.equal(group.error, null, `group insert failed: ${group.error?.message}`);
  created.group = group.data.id;

  // ---------------------------------------------- T1: registration via RPC --
  const invToken = generateEntryPassToken().replace('wp_pass_', 'wp_inv_');
  const passRaw1 = generateEntryPassToken();
  const [invHash, passHash1] = await Promise.all([hashToken(invToken), hashToken(passRaw1)]);
  const partyId = crypto.randomUUID();
  created.parties.push(partyId);

  const reg = await supabaseAdmin.rpc('register_group_guest_atomic', {
    p_event_id: EVENT_ID, p_slug: GROUP_SLUG, p_party_id: partyId,
    p_party_name: `${RUN} ضيف`, p_primary_phone: `9665${RUN.slice(-8)}`,
    p_seats: 5, p_invitation_hash: invHash, p_pass_hash: passHash1,
    p_notes: 'تهنية اختبار تكامل',
  });
  assert.equal(reg.error, null, `registration rpc failed: ${reg.error?.message}`);
  assert.equal(reg.data.code, 'SUCCESS', 'T1: fresh registration succeeds');
  assert.equal(reg.data.success, true, 'T1b: success flag set');

  const seatsRow = await supabaseAdmin.from('parties').select('allowed_count').eq('id', partyId).single();
  assert.equal(seatsRow.data.allowed_count, 2, 'T1c: requested 5 seats clamped to max_seats_per_guest=2');

  // --------------------------------- T2: duplicate phone WITHOUT rotation ---
  const dup = await supabaseAdmin.rpc('register_group_guest_atomic', {
    p_event_id: EVENT_ID, p_slug: GROUP_SLUG, p_party_id: crypto.randomUUID(),
    p_party_name: 'مكرر', p_primary_phone: `9665${RUN.slice(-8)}`,
    p_seats: 1, p_invitation_hash: repeatHash('2'), p_pass_hash: repeatHash('3'),
  });
  assert.equal(dup.data?.code, 'ALREADY_REGISTERED', 'T2: duplicate phone flagged ALREADY_REGISTERED');
  const passAfterDup = await supabaseAdmin.from('entry_passes').select('pass_token_hash').eq('party_id', partyId).single();
  assert.equal(passAfterDup.data.pass_token_hash, passHash1, 'T2b: original pass hash UNCHANGED (no DoS rotation)');
  const wishQ = await supabaseAdmin.from('wishes').select('is_approved').eq('party_id', partyId).maybeSingle();
  assert.ok(wishQ.data === null || wishQ.data.is_approved === false, 'T2c: notes quarantined');

  // ------------------------------------------- T3: check-in SUCCESS flow ----
  const scan1 = await supabaseAdmin.rpc('process_secure_checkin', {
    p_event_id: EVENT_ID, p_pass_token_hash: passHash1,
    p_station_name: 'stg-gate', p_operator_name: 'tester',
    p_queue_id: `${RUN}_q1`, p_device_metadata: { deviceId: 'stg-dev' },
  });
  assert.equal(scan1.error, null, `T3 scan1 RPC failed: ${scan1.error?.message}`);
  assert.equal(scan1.data?.code, 'SUCCESS', 'T3: first queued scan admits');

  // ------------------------------- T4: anti-replay on second live scan -----
  const scan2 = await supabaseAdmin.rpc('process_secure_checkin', {
    p_event_id: EVENT_ID, p_pass_token_hash: passHash1,
    p_station_name: 'stg-gate', p_operator_name: 'tester', p_queue_id: null, p_device_metadata: null,
  });
  assert.equal(scan2.error, null, `T4 scan2 RPC failed: ${scan2.error?.message}`);
  assert.equal(scan2.data?.code, 'ALREADY_CHECKED_IN', 'T4: second scan rejected');

  // ------------------------- T5: queue replay returns ORIGINAL verbatim ----
  const replay = await supabaseAdmin.rpc('process_secure_checkin', {
    p_event_id: EVENT_ID, p_pass_token_hash: passHash1,
    p_station_name: 'other-gate', p_operator_name: 'other-op',
    p_queue_id: `${RUN}_q1`, p_device_metadata: null,
  });
  assert.equal(replay.error, null, `T5 replay RPC failed: ${replay.error?.message}`);
  assert.deepEqual(replay.data, scan1.data, 'T5: same queueId replays ORIGINAL terminal result verbatim');

  // ------------------------------- T6: RSVP status allow-list --------------
  const badRsvp = await supabaseAdmin.rpc('submit_party_rsvp_atomic', {
    p_party_id: partyId, p_status: 'hacked', p_attending_count: 1,
  });
  assert.equal(badRsvp.error, null, `T6 badRsvp RPC failed: ${badRsvp.error?.message}`);
  assert.equal(badRsvp.data?.code, 'INVALID_STATUS', 'T6: invalid RSVP status rejected by RPC');

  console.log('✔ Real Supabase staging integration: 12 assertions passed (fixtures cleaned)');
} catch (e) {
  console.error('✘ Integration failure:', e.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}

function repeatHash(ch) {
  return ch.repeat(64);
}
