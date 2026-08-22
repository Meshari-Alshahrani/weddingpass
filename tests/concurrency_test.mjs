import { getDefaultEvent, executeCheckIn, registerGroupGuest, createGroupLink } from '../lib/db/store.ts';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

async function runConcurrencyChaosSuite() {
  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`   WEDDINGPASS v5.6 - HIGH-CONCURRENCY ATOMIC RACE CONDITION SUITE     `);
  console.log(`   (Simulating 100 Parallel Burst Requests against Single Entry Pass)  `);
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

  // TEST 1: 50 Concurrent Gate Scans on the Exact Same Pass Token
  console.log(`${colors.bold}--- [1] 50 Concurrent Scans Race Condition Test ---${colors.reset}`);
  const targetPassToken = 'wp_pass_demo_concurrency_race_1';

  // Seed a fresh party & pass for testing
  const regGuest = await registerGroupGuest('colleagues', 'ضيف سباق التزامن', '0598765432', 1);
  const passToken = regGuest.entryPass.raw_pass_token;

  console.log(`  🚀 Firing 50 parallel burst scan requests simultaneously...`);
  const burstResults = await Promise.all(
    Array.from({ length: 50 }).map((_, idx) =>
      executeCheckIn(event.id, passToken, `بوابة ${idx + 1}`, `مشغل ${idx + 1}`, 'QR_SCAN', undefined, 'men')
    )
  );

  const successes = burstResults.filter((r) => r.success === true && r.code === 'SUCCESS');
  const alreadyCheckedIns = burstResults.filter((r) => r.success === false && r.code === 'ALREADY_CHECKED_IN');
  const others = burstResults.filter((r) => r.code !== 'SUCCESS' && r.code !== 'ALREADY_CHECKED_IN');

  console.log(`  📊 Results: Successes: ${successes.length}, Already Checked-In: ${alreadyCheckedIns.length}, Errors: ${others.length}`);
  assert(successes.length === 1, 'Exactly 1 request succeeded and admitted the guest', `Got ${successes.length} successes`);
  assert(alreadyCheckedIns.length === 49, 'Exactly 49 requests were rejected as ALREADY_CHECKED_IN', `Got ${alreadyCheckedIns.length}`);
  assert(others.length === 0, 'Zero unhandled errors or race anomalies occurred');

  // TEST 2: 50 Concurrent Registrations on a Strict Group Capped at 5 Seats
  console.log(`\n${colors.bold}--- [2] 50 Concurrent Registrations on Capped Group Quota ---${colors.reset}`);
  const groupSlug = `race_grp_${Date.now()}`;
  await createGroupLink(event.id, 'قروب سباق الكوتا', groupSlug, 'العريس', 'strict', 5, 1, 'men');

  console.log(`  🚀 Firing 50 parallel registration requests on a 5-seat capped group...`);
  const groupBurst = await Promise.all(
    Array.from({ length: 50 }).map((_, idx) =>
      registerGroupGuest(groupSlug, `ضيف ${idx + 1}`, `05011${String(idx).padStart(5, '0')}`, 1)
    )
  );

  const groupSuccesses = groupBurst.filter((r) => r.success === true && r.code === 'SUCCESS');
  const groupExceeded = groupBurst.filter((r) => r.success === false && r.code === 'QUOTA_EXCEEDED');

  console.log(`  📊 Results: Registered: ${groupSuccesses.length}, Quota Exceeded Rejections: ${groupExceeded.length}`);
  assert(groupSuccesses.length === 5, 'Exactly 5 seats were allocated under intense concurrent burst', `Got ${groupSuccesses.length}`);
  assert(groupExceeded.length === 45, 'Exactly 45 burst requests were rejected with QUOTA_EXCEEDED');

  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`  CONCURRENCY CHAOS SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  if (passed === total) {
    console.log(`${colors.bold}${colors.green}  🎉 100% PASS: ATOMIC CONCURRENCY & RACE CONDITIONS DEFENDED!  `);
  } else {
    console.log(`${colors.bold}${colors.red}  ⚠️ SOME CONCURRENCY TESTS FAILED.  `);
  }
  console.log(`=======================================================================${colors.reset}\n`);

  process.exit(passed === total ? 0 : 1);
}

runConcurrencyChaosSuite().catch((err) => {
  console.error('Fatal concurrency runner error:', err);
  process.exit(1);
});
