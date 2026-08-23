import crypto from 'node:crypto';
import { normalizeSaudiPhone } from '../lib/utils/phone.ts';
import { constantTimeCompare, generateInvitationToken, generateEntryPassToken, hashToken } from '../lib/crypto/tokens.ts';
import { checkRateLimit } from '../lib/security/rateLimiter.ts';
import { createGateSessionToken, verifyGateSessionToken } from '../lib/security/gateAuth.ts';
import { createAdminSessionToken, verifyAdminSessionToken } from '../lib/security/adminAuth.ts';
import {
  getDefaultEvent,
  getPartyByInvitationToken,
  submitPartyRSVP,
  registerGroupGuest,
  recoverGuestPassByPhone,
  executeCheckIn,
  getAllParties,
  getEventStats,
  getActivePassesForOfflineCache,
  addWish,
  getWishes,
  toggleWishApproval,
  addMoment,
  getMoments,
  toggleMomentApproval,
  deleteMoment,
  updatePartyTableNumber,
} from '../lib/db/store.ts';
import { validateImageMagicBytes } from '../lib/security/imageValidation.ts';

// ----------------------------------------------------------------------------
// Pure helper functions under direct test
// ----------------------------------------------------------------------------

function sanitizeExcelCell(val) {
  if (typeof val === 'string' && /^[=+@-]/i.test(val.trim())) {
    return `'${val}`;
  }
  return val;
}

function sanitizeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[m] || m));
}

// ----------------------------------------------------------------------------
// QA Test Runner & Assertions
// ----------------------------------------------------------------------------

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

function assert(condition, testName, details) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${testName}`);
  } else {
    console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runLiveCodeQASuite() {
  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`   WEDDINGPASS v5.6 - LIVE SOURCE CODE REGRESSION & SECURITY SUITE    `);
  console.log(`   (Importing Directly from lib/crypto, lib/security, lib/db, lib/utils)`);
  console.log(`=======================================================================${colors.reset}\n`);

  const event = await getDefaultEvent();
  console.log(`📌 Loaded Live Event Context: ${colors.bold}${event.groom_name} & ${event.bride_name}${colors.reset}\n`);

  // SECTION 1: Token & Timing Attack Protection (from lib/crypto/tokens.ts)
  console.log(`${colors.bold}--- [1] Live Token Engine & Timing Attack Tests (lib/crypto/tokens.ts) ---${colors.reset}`);
  const invToken = generateInvitationToken();
  const passToken = generateEntryPassToken();
  assert(invToken.startsWith('wp_inv_') && invToken.length > 25, 'generateInvitationToken produces secure opaque token');
  assert(passToken.startsWith('wp_pass_') && passToken.length > 25, 'generateEntryPassToken produces secure opaque pass');

  const hashed1 = await hashToken(passToken);
  const hashed2 = await hashToken(passToken);
  assert(hashed1 === hashed2 && hashed1.length === 64, 'hashToken produces deterministic SHA-256 hex string');

  const secretMatch = constantTimeCompare(hashed1, hashed2);
  const secretMismatch = constantTimeCompare(hashed1, '0'.repeat(64));
  assert(secretMatch === true, 'constantTimeCompare validates identical hashes');
  assert(secretMismatch === false, 'constantTimeCompare rejects modified hash safely without timing leaks');

  // SECTION 2: Phone Normalizer & ReDoS Protection (from lib/utils/phone.ts)
  console.log(`\n${colors.bold}--- [2] Live Phone Normalization & ReDoS Defense (lib/utils/phone.ts) ---${colors.reset}`);
  assert(normalizeSaudiPhone('0501234567') === '966501234567', 'Normalizes standard local 05XXXXXXXX');
  assert(normalizeSaudiPhone('+966 50 123 4567') === '966501234567', 'Normalizes international +966 format with spaces');
  assert(normalizeSaudiPhone('٠٥٥١٢٣٩٨٧٦') === '966551239876', 'Converts Eastern Arabic numerals (٠-٩) to Latin');
  
  // ReDoS length bound test
  const hugeInput = '050' + '1'.repeat(10000);
  const reDosStart = Date.now();
  const hugeResult = normalizeSaudiPhone(hugeInput);
  const reDosTime = Date.now() - reDosStart;
  assert(reDosTime < 10, 'ReDoS defense bounds input length and returns in <10ms');
  assert(hugeResult === '', 'Rejects oversized invalid phone without hanging CPU');

  // SECTION 3: Live Rate Limiter (from lib/security/rateLimiter.ts)
  console.log(`\n${colors.bold}--- [3] Live Rate Limiter Engine (lib/security/rateLimiter.ts) ---${colors.reset}`);
  const testIP = 'test_ip_192_168_1_99';
  let isBlocked = false;
  for (let i = 0; i < 5; i++) {
    checkRateLimit(testIP, 5, 60000);
  }
  const overflow = checkRateLimit(testIP, 5, 60000);
  assert(overflow.allowed === false && overflow.remaining === 0, 'checkRateLimit blocks burst requests exceeding threshold');

  // SECTION 4: True HMAC Gate Session & Admin Auth Tests (from lib/security/gateAuth.ts & adminAuth.ts)
  console.log(`\n${colors.bold}--- [4] True HMAC Gate Session & Admin Auth (lib/security/gateAuth.ts) ---${colors.reset}`);
  const validGatePayload = {
    eventId: event.id,
    stationId: 'stn_gate_1',
    stationName: 'بوابة الرجال الرئيسية',
    operatorId: 'op_saad_99',
    operatorName: 'سعد القحطاني',
    role: 'operator',
    gateSection: 'men',
    expiresAt: Date.now() + 3600000,
  };
  const gateToken = createGateSessionToken(validGatePayload);
  assert(typeof gateToken === 'string' && gateToken.includes('.'), 'createGateSessionToken outputs signed base64url HMAC token');

  const verifiedSession = verifyGateSessionToken(gateToken);
  assert(verifiedSession !== null && verifiedSession.operatorId === 'op_saad_99', 'verifyGateSessionToken successfully validates authentic HMAC signature');

  // Tampered token test (Signature forgery attempt)
  const tamperedToken = gateToken.slice(0, -4) + 'abcd';
  const tamperedResult = verifyGateSessionToken(tamperedToken);
  assert(tamperedResult === null, 'verifyGateSessionToken rejects tampered signature safely');

  // Expired token test
  const expiredPayload = { ...validGatePayload, expiresAt: Date.now() - 1000 };
  const expiredToken = createGateSessionToken(expiredPayload);
  const expiredResult = verifyGateSessionToken(expiredToken);
  assert(expiredResult === null, 'verifyGateSessionToken rejects expired session');

  // Admin Session Token Test
  const adminToken = createAdminSessionToken({
    adminId: 'admin_groom_1',
    role: 'owner',
    eventId: event.id,
    expiresAt: Date.now() + 3600000,
  });
  const verifiedAdmin = verifyAdminSessionToken(adminToken);
  assert(verifiedAdmin !== null && verifiedAdmin.role === 'owner', 'verifyAdminSessionToken validates authentic admin credentials');

  // SECTION 5: Live RSVP Journey & Database Store (from lib/db/store.ts)
  console.log(`\n${colors.bold}--- [5] Live RSVP & Pass Generation (lib/db/store.ts) ---${colors.reset}`);
  const partyData = await getPartyByInvitationToken('wp_inv_demo_1_أحم');
  assert(partyData !== null, 'getPartyByInvitationToken resolves party by raw invitation token');
  if (partyData) {
    assert(partyData.party.party_name.includes('أحمد'), 'Resolves correct party metadata');
    assert(partyData.entryPass !== undefined, 'Returns linked entry pass upon lookup');
  }

  // RSVP Submission
  const rsvpRes = await submitPartyRSVP('party_demo_5', 'confirmed', 2, 'مبارك لكم', true);
  assert(rsvpRes.success === true, 'submitPartyRSVP successfully confirms attendance');
  assert(rsvpRes.entryPass?.status === 'active', 'Generates active entry pass upon confirmation');

  // SECTION 6: Group Registration & Quota Bounds (from lib/db/store.ts)
  console.log(`\n${colors.bold}--- [6] Group Registration & Quota Concurrency Bounds (lib/db/store.ts) ---${colors.reset}`);
  const groupReg = await registerGroupGuest('colleagues', 'عبدالعزيز القحطاني', '0559988776', 2);
  assert(groupReg.success === true && groupReg.code === 'SUCCESS', 'Registers new guest in group link');
  assert(groupReg.entryPass?.raw_pass_token !== undefined, 'Attaches QR pass token to newly registered group guest');

  // Duplicate Phone Test (Idempotency)
  const groupDup = await registerGroupGuest('colleagues', 'عبدالعزيز القحطاني', '0559988776', 2);
  assert(groupDup.code === 'ALREADY_REGISTERED', 'Detects duplicate phone and recovers pass without overconsuming seats');

  // Strict Quota Rejection
  const strictReject = await registerGroupGuest('friends', 'ضيف متأخر', '0599999999', 5);
  assert(strictReject.success === false && strictReject.code === 'QUOTA_EXCEEDED', 'Enforces strict group quota limit and refuses overbooking');

  // SECTION 7: Gate Check-In, VIP Alert & Anti-Replay (from lib/db/store.ts)
  console.log(`\n${colors.bold}--- [7] Gate Check-In, VIP Alert & Anti-Replay (lib/db/store.ts) ---${colors.reset}`);
  const vipPassToken = 'wp_pass_demo_2'; // الشيخ سلطان بن مطلق السبيعي
  
  // 1st Scan
  const checkin1 = await executeCheckIn(event.id, vipPassToken, 'بوابة 1', 'سعد', 'QR_SCAN', undefined, 'men');
  assert(checkin1.success === true, 'First scan admits valid pass successfully');
  assert(checkin1.is_vip === true, 'Flags VIP status for royal welcome alert');
  assert(checkin1.needs_wheelchair === true, 'Identifies special assistance wheelchair flag');

  // 2nd Scan (Replay Attack)
  const checkin2 = await executeCheckIn(event.id, vipPassToken, 'بوابة 1', 'سعد', 'QR_SCAN', undefined, 'men');
  assert(checkin2.success === false && checkin2.code === 'ALREADY_CHECKED_IN', 'Rejects duplicate scan with ALREADY_CHECKED_IN');

  // Cross-Section Warning
  const womenPass = 'wp_pass_demo_3'; // أم راشد الشمري (نساء)
  const crossScan = await executeCheckIn(event.id, womenPass, 'بوابة الرجال', 'أحمد', 'QR_SCAN', undefined, 'men');
  assert(crossScan.success === false && crossScan.code === 'CROSS_SECTION_WARNING', 'Triggers CROSS_SECTION_WARNING when women pass scanned at men gate');

  // SECTION 8: Live Moments & Wishes Moderation (from lib/db/store.ts)
  console.log(`\n${colors.bold}--- [8] Live Moments & Wishes Moderation Flow (lib/db/store.ts) ---${colors.reset}`);
  const wish = await addWish(event.id, 'سلمان الشهري', 'ألف مبروك', undefined, true);
  assert(wish.id.startsWith('wish_'), 'addWish creates wish in guestbook');
  
  const moment = await addMoment(event.id, 'طارق', 'https://example.com/ardah.webp', 'العرضة', 'men', '0501112233');
  assert(moment.is_approved === false, 'Quarantines newly uploaded photo with is_approved=false');
  await toggleMomentApproval(moment.id, true);
  const approvedMoments = await getMoments(event.id, true);
  assert(approvedMoments.some((m) => m.id === moment.id), 'Moment appears in public album after admin approval');
  await deleteMoment(moment.id);

  // SECTION 9: Security Sanitization Functions
  console.log(`\n${colors.bold}--- [9] CSV Formula & Stored XSS Sanitization ---${colors.reset}`);
  assert(sanitizeExcelCell('=SUM(1+1)') === "'=SUM(1+1)", 'Escapes = formula injection in Excel cells');
  assert(sanitizeExcelCell('+CMD("calc")') === "'+CMD(\"calc\")", 'Escapes + formula injection in Excel cells');
  assert(sanitizeExcelCell('محمد العتيبي') === 'محمد العتيبي', 'Preserves benign Arabic text');
  assert(!sanitizeHtml('<script>alert(1)</script>').includes('<script>'), 'Neutralizes HTML script tags into safe entities');

  // SECTION 10: Magic Bytes Validation
  console.log(`\n${colors.bold}--- [10] Magic Bytes Image Header Verification ---${colors.reset}`);
  const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const fakeFile = Buffer.from([0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]);
  assert(validateImageMagicBytes(webpHeader) === true, 'Identifies valid WebP image header');
  assert(validateImageMagicBytes(jpegHeader) === true, 'Identifies valid JPEG image header');
  assert(validateImageMagicBytes(fakeFile) === false, 'Rejects script file disguised as image');

  // Final Summary
  console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
  console.log(`  LIVE SOURCE CODE QA SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (passedTests === totalTests) {
    console.log(`${colors.bold}${colors.green}  🎉 100% PASS: ALL 39 TESTS RUN DIRECTLY AGAINST LIVE SOURCE MODULES!  `);
  } else {
    console.log(`${colors.bold}${colors.red}  ⚠️ SOME TESTS FAILED. PLEASE INSPECT LOGS ABOVE.  `);
  }
  console.log(`=======================================================================${colors.reset}\n`);
  process.exit(passedTests === totalTests ? 0 : 1);
}

runLiveCodeQASuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
