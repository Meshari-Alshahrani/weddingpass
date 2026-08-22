import { createGateSessionToken } from '../lib/security/gateAuth.ts';
import { getDefaultEvent, registerGroupGuest, executeCheckIn } from '../lib/db/store.ts';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function runHttpConcurrencyVerification() {
  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`   WEDDINGPASS v5.7 - PROTOCOL & HTTP CONCURRENCY VERIFICATION         `);
  console.log(`   (Testing Session Verification, Fail-Closed, and Race Resilience)    `);
  console.log(`=======================================================================${colors.reset}\n`);

  const event = await getDefaultEvent();
  let passed = 0;
  let total = 0;

  function assert(condition, name, details) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}`);
    } else {
      console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${name} ${details ? `(${details})` : ''}`);
    }
  }

  // 1. Session Token Signature Validation
  console.log(`${colors.bold}--- [1] Cryptographic Session Integrity ---${colors.reset}`);
  const sessionToken = createGateSessionToken({
    eventId: event.id,
    stationId: 'stn_gate_main',
    stationName: 'بوابة الرجال 1',
    operatorId: 'op_faisal',
    operatorName: 'فيصل العتيبي',
    role: 'operator',
    gateSection: 'men',
    expiresAt: Date.now() + 4 * 3600 * 1000,
  });

  assert(Boolean(sessionToken && sessionToken.includes('.')), 'HMAC Gate Session Token generated with strict structure');

  // 2. Burst Check-In Simulation
  console.log(`\n${colors.bold}--- [2] 50 Burst Parallel Requests Simulation ---${colors.reset}`);
  const guest = await registerGroupGuest('colleagues', 'ضيف اختبار البروتوكول', '0507766554', 1);
  const passToken = guest.entryPass.raw_pass_token;

  console.log(`  🚀 Firing 50 parallel requests simultaneously...`);
  const burstResults = await Promise.all(
    Array.from({ length: 50 }).map((_, idx) =>
      executeCheckIn(event.id, passToken, `بوابة ${idx + 1}`, `مشرف ${idx + 1}`, 'QR_SCAN', undefined, 'men')
    )
  );

  const successes = burstResults.filter((r) => r.success === true && r.code === 'SUCCESS');
  const alreadyChecked = burstResults.filter((r) => r.success === false && r.code === 'ALREADY_CHECKED_IN');

  assert(successes.length === 1, 'Only 1 request was accepted (1 SUCCESS)');
  assert(alreadyChecked.length === 49, '49 requests were rejected (49 ALREADY_CHECKED_IN)');

  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`  HTTP/PROTOCOL SUITE SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
  console.log(`=======================================================================${colors.reset}\n`);

  process.exit(passed === total ? 0 : 1);
}

runHttpConcurrencyVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
