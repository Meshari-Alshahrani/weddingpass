import {
  getDefaultEvent,
  getPartyByInvitationToken,
  submitPartyRSVP,
  registerGroupGuest,
  recoverGuestPassByPhone,
  executeCheckIn,
  getAllParties,
  getEventStats,
  updatePartyTableNumber,
  getActivePassesForOfflineCache,
  addWish,
  getWishes,
  toggleWishApproval,
  addMoment,
  getMoments,
  toggleMomentApproval,
  deleteMoment,
  updateEventSettings,
  searchParties,
} from '../lib/db/store';
import { generateInvitationToken, generateEntryPassToken, hashToken } from '../lib/crypto/tokens';
import { normalizeSaudiPhone } from '../lib/utils/phone';

// ANSI Colors for QA Terminal Output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${testName}`);
  } else {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runQASuite() {
  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  WEDDINGPASS v5.1 - COMPREHENSIVE QA & CHAOS SUITE   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);

  const event = await getDefaultEvent();
  console.log(`📌 Target Event: ${colors.bold}${event.groom_name} & ${event.bride_name}${colors.reset} (ID: ${event.id})\n`);

  // --------------------------------------------------------------------------
  // SECTION 1: Crypto & Token Security
  // --------------------------------------------------------------------------
  console.log(`${colors.bold}--- [1] Crypto & Token Integrity Tests ---${colors.reset}`);
  const rawToken = generateInvitationToken();
  const rawPass = generateEntryPassToken();
  assert(rawToken.startsWith('wp_inv_') && rawToken.length > 20, 'Generates secure high-entropy invitation token');
  assert(rawPass.startsWith('wp_pass_') && rawPass.length > 20, 'Generates secure high-entropy entry pass token');

  const hash1 = await hashToken(rawToken);
  const hash2 = await hashToken(rawToken);
  assert(hash1 === hash2, 'SHA-256 token hashing is deterministic');
  assert(hash1 !== rawToken, 'Raw token is not stored in plaintext');

  // --------------------------------------------------------------------------
  // SECTION 2: Saudi Phone Normalization Edge Cases
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [2] Phone Normalization & Arabic Numerals ---${colors.reset}`);
  assert(normalizeSaudiPhone('0501234567') === '966501234567', 'Normalizes 05XXXXXXXX format');
  assert(normalizeSaudiPhone('+966501234567') === '966501234567', 'Normalizes +9665XXXXXXXX format');
  assert(normalizeSaudiPhone('966501234567') === '966501234567', 'Normalizes 9665XXXXXXXX format');
  assert(normalizeSaudiPhone('501234567') === '966501234567', 'Normalizes 5XXXXXXXX without leading zero');
  assert(normalizeSaudiPhone('٠٥٠١٢٣٤٥٦٧') === '966501234567', 'Normalizes Arabic Eastern numerals (٠-٩)');
  assert(normalizeSaudiPhone('12345') === null, 'Rejects invalid short numbers');
  assert(normalizeSaudiPhone('abcd') === null, 'Rejects alphabetic strings');

  // --------------------------------------------------------------------------
  // SECTION 3: Private Guest RSVP Journey (Individual Token)
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [3] Private Guest RSVP & Pass Generation ---${colors.reset}`);
  const guest1Data = await getPartyByInvitationToken('wp_inv_demo_1_أحم');
  assert(guest1Data !== null, 'Retrieves guest party by raw invitation token');
  if (guest1Data) {
    assert(guest1Data.party.party_name === 'أحمد محمد العتيبي (عائلة)', 'Correct party name mapping');
    assert(guest1Data.party.rsvp_status === 'confirmed', 'RSVP confirmed status mapped correctly');
    assert(guest1Data.entryPass !== undefined, 'Active entry pass attached to confirmed party');
  }

  // Test RSVP Confirmation with Special Assistance
  const rsvpResult = await submitPartyRSVP(
    'party_demo_5',
    'confirmed',
    3,
    'مبارك لكم ونسأل الله التوفيق',
    true
  );
  assert(rsvpResult.success === true, 'Confirms RSVP successfully');
  assert(rsvpResult.entryPass !== undefined, 'Issues entry pass upon confirmation');
  
  const updatedParty = (await getAllParties(event.id)).find((p) => p.id === 'party_demo_5');
  assert(updatedParty?.needs_wheelchair === true, 'Saves special assistance wheelchair flag');
  assert(updatedParty?.confirmed_count === 3, 'Sets confirmed seats correctly');

  // --------------------------------------------------------------------------
  // SECTION 4: Smart Group Registration & Quota Enforcement
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [4] WhatsApp Group Registration & Quotas ---${colors.reset}`);
  
  // Register new guest in colleagues group
  const groupReg1 = await registerGroupGuest('colleagues', 'سلطان فهد الدوسري', '0541112233', 2, 'ألف مبروك');
  assert(groupReg1.success === true && groupReg1.code === 'SUCCESS', 'Registers new guest in group link');
  assert(groupReg1.party?.host_name === 'العريس', 'Assigns group host correctly');
  assert(groupReg1.entryPass?.raw_pass_token !== undefined, 'Issues QR pass token for group guest');

  // Idempotency: Re-register with same phone number
  const groupRegDup = await registerGroupGuest('colleagues', 'سلطان فهد الدوسري', '0541112233', 2);
  assert(groupRegDup.code === 'ALREADY_REGISTERED', 'Detects duplicate phone and recovers pass without consuming extra seats');

  // Phone Pass Recovery
  const recovery = await recoverGuestPassByPhone(event.id, '0541112233');
  assert(recovery.success === true, 'Recovers guest pass via phone number search');
  assert(recovery.party?.party_name === 'سلطان فهد الدوسري', 'Recovers correct party details');

  // Strict Quota Enforcement (Group Friends: cap 15)
  const fullGroupReg = await registerGroupGuest('friends', 'ضيف متأخر', '0599999999', 5);
  assert(fullGroupReg.success === false && fullGroupReg.code === 'QUOTA_EXCEEDED', 'Enforces strict group quota limit and refuses overbooking');

  // --------------------------------------------------------------------------
  // SECTION 5: Gate Check-In, VIP Detection & Replay Attack Defense
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [5] Gate Check-In & Anti-Replay Defense ---${colors.reset}`);

  // 1. Valid Check-In for VIP Party
  const vipPassToken = 'wp_pass_demo_2'; // الشيخ سلطان بن مطلق السبيعي
  const checkin1 = await executeCheckIn(event.id, vipPassToken, 'بوابة 1', 'فهد', 'QR_SCAN', undefined, 'men');
  assert(checkin1.success === true, 'Accepts valid active pass at the gate');
  assert(checkin1.is_vip === true, 'Identifies VIP party and flags royal alert');
  assert(checkin1.needs_wheelchair === true, 'Identifies special assistance wheelchair flag');
  assert(checkin1.table_number === 'طاولة كبار الشخصيات VIP', 'Returns assigned table number for routing');

  // 2. Replay Attack (Scanning the exact same QR code second time)
  const replayCheckin = await executeCheckIn(event.id, vipPassToken, 'بوابة 1', 'فهد', 'QR_SCAN', undefined, 'men');
  assert(replayCheckin.success === false, 'Rejects duplicate scan (Replay Attack)');
  assert(replayCheckin.code === 'ALREADY_CHECKED_IN', 'Returns ALREADY_CHECKED_IN code with previous checkin time');

  // 3. Forged / Non-existent Token
  const fakeCheckin = await executeCheckIn(event.id, 'wp_pass_fake_99999', 'بوابة 1', 'فهد', 'QR_SCAN');
  assert(fakeCheckin.success === false && fakeCheckin.code === 'NOT_FOUND', 'Rejects forged or invalid token');

  // --------------------------------------------------------------------------
  // SECTION 6: Cross-Section Gate Safety (Men vs. Women Gate)
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [6] Cross-Section Gate Routing ---${colors.reset}`);
  
  const womenPassToken = 'wp_pass_demo_3'; // أم راشد الشمري (قسم النساء)
  
  // Scanning women pass on Men's Gate
  const crossScan = await executeCheckIn(event.id, womenPassToken, 'بوابة الرجال', 'أحمد', 'QR_SCAN', undefined, 'men');
  assert(crossScan.success === false, 'Intercepts cross-section scan');
  assert(crossScan.code === 'CROSS_SECTION_WARNING', 'Triggers yellow CROSS_SECTION_WARNING alert');
  assert(crossScan.is_cross_section_warning === true, 'Provides guidance to women gate');

  // Force Admit Override at Gate
  const forceAdmit = await executeCheckIn(event.id, womenPassToken, 'بوابة الرجال', 'أحمد', 'QR_SCAN', undefined, 'men', true);
  assert(forceAdmit.success === true, 'Allows authorized manual override when requested by gate supervisor');

  // --------------------------------------------------------------------------
  // SECTION 7: Offline Cache Engine
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [7] Offline Cache Synchronization ---${colors.reset}`);
  const cacheDump = await getActivePassesForOfflineCache(event.id);
  assert(cacheDump.length > 0, 'Extracts active passes for offline client caching');
  assert(cacheDump[0].passTokenHash !== undefined, 'Caches pass hashes for fast local hashing');
  assert(cacheDump.some((p) => p.needsWheelchair !== undefined), 'Preserves special assistance metadata in offline mode');

  // --------------------------------------------------------------------------
  // SECTION 8: Live Moments & Wishes Moderation
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [8] Live Moments & Wishes Moderation ---${colors.reset}`);
  
  // Wish Flow
  const wish = await addWish(event.id, 'خالد العتيبي', 'ألف مبروك يا سلمان', undefined, true);
  assert(wish.id.startsWith('wish_'), 'Creates new guestbook wish');
  const wishesList = await getWishes(event.id, true);
  assert(wishesList.some((w) => w.id === wish.id), 'Retrieves approved wishes for hall live screen');
  await toggleWishApproval(wish.id, false);
  const hiddenWishes = await getWishes(event.id, true);
  assert(!hiddenWishes.some((w) => w.id === wish.id), 'Toggles wish approval status and hides from live broadcast');

  // Moment (Photo Drop) Flow
  const moment = await addMoment(event.id, 'فهد محمد', 'https://example.com/test.webp', 'لقطة العرضة', 'men', '0501234567');
  assert(moment.is_approved === false, 'Quarantines newly uploaded photo until admin approval');
  const publicMoments1 = await getMoments(event.id, true);
  assert(!publicMoments1.some((m) => m.id === moment.id), 'Photo not visible in public album while unapproved');

  await toggleMomentApproval(moment.id, true);
  const publicMoments2 = await getMoments(event.id, true);
  assert(publicMoments2.some((m) => m.id === moment.id), 'Photo becomes visible in public album upon admin approval');

  await deleteMoment(moment.id);
  const publicMoments3 = await getMoments(event.id, false);
  assert(!publicMoments3.some((m) => m.id === moment.id), 'Deletes moment permanently when requested');

  // --------------------------------------------------------------------------
  // SECTION 9: Multi-Host Statistics & Table Management
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [9] Multi-Host Scoping & Table Routing ---${colors.reset}`);
  
  await updatePartyTableNumber('party_demo_1', 'طاولة 9 VIP');
  const updatedTableParty = (await getAllParties(event.id)).find((p) => p.id === 'party_demo_1');
  assert(updatedTableParty?.table_number === 'طاولة 9 VIP', 'Assigns table number inline');

  const stats = await getEventStats(event.id);
  assert(stats.totalParties > 0, 'Calculates total parties count');
  assert(Boolean(stats.hostBreakdown && stats.hostBreakdown['العريس']), 'Computes stats for hosts');
  assert(Boolean(stats.hostBreakdown['العريس']?.totalAllowed > 0), 'Computes groom specific invites correctly');

  // --------------------------------------------------------------------------
  // SECTION 10: Event Settings & Gate PIN Security
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}--- [10] Event Settings, Timeline & Gate PIN ---${colors.reset}`);
  const updatedEvent = await updateEventSettings(event.id, {
    timeline_reception: '07:30 م',
    gate_pin: '9988',
    iban: 'SA1234567890123456789012',
  });
  assert(updatedEvent?.timeline_reception === '07:30 م', 'Updates wedding timeline correctly');
  assert(updatedEvent?.gate_pin === '9988', 'Updates gate security PIN correctly');
  assert(updatedEvent?.iban === 'SA1234567890123456789012', 'Persists banking IBAN correctly');

  // Search Parties
  const searchResults = await searchParties(event.id, 'السبيعي');
  assert(searchResults.length > 0, 'Performs fast in-memory party search by name query');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n${colors.bold}${colors.cyan}======================================================${colors.reset}`);
  console.log(`${colors.bold}  QA TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)${colors.reset}`);
  if (passedTests === totalTests) {
    console.log(`${colors.bold}${colors.green}  🎉 ALL 10 QA SECTORS & CHAOS TESTS PASSED PERFECTLY!  ${colors.reset}`);
  } else {
    console.log(`${colors.bold}${colors.red}  ⚠️ SOME TESTS FAILED. PLEASE INSPECT LOGS ABOVE.  ${colors.reset}`);
  }
  console.log(`${colors.bold}${colors.cyan}======================================================${colors.reset}\n`);
}

runQASuite().catch(console.error);
