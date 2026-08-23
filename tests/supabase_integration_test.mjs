import assert from 'node:assert/strict';

if (process.env.RUN_SUPABASE_INTEGRATION !== 'true') {
  console.error('Set RUN_SUPABASE_INTEGRATION=true to run against a real Supabase project.');
  process.exit(2);
}

const { supabaseAdmin, isSupabaseConfigured } = await import('../lib/db/supabase.ts');

assert(isSupabaseConfigured && supabaseAdmin, 'SUPABASE_URL and a service-role key are required');

const { error: eventsError } = await supabaseAdmin.from('events').select('id').limit(1);
assert.equal(eventsError, null, `events table is unavailable: ${eventsError?.message}`);

// This is a non-mutating RPC availability check. The random token cannot match
// an issued pass, so the function should safely return NOT_FOUND.
const { data, error: rpcError } = await supabaseAdmin.rpc('process_secure_checkin', {
  p_event_id: '00000000-0000-0000-0000-000000000000',
  p_pass_token_hash: '0'.repeat(64),
  p_station_name: 'integration-health-check',
  p_operator_name: 'integration-health-check',
  p_checkin_type: 'QR_SCAN',
  p_override_count: null,
  p_gate_section: 'general',
  p_force_cross_section: false,
});

assert.equal(rpcError, null, `process_secure_checkin RPC is unavailable: ${rpcError?.message}`);
assert.equal(data?.code, 'NOT_FOUND', 'RPC must execute without mutating guest data');

console.log('✔ Real Supabase connectivity and service-role RPC verified');
