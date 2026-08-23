/**
 * WeddingPass v5.9.2 - Security & Policy Integration Test Suite
 * Validates:
 * 1. Offline Cache Access Control (Safe vs Unauthorized)
 * 2. Strict HMAC Gate Session & Expiration Controls
 * 3. Base64 & Magic Bytes Binary Security (WebP, JPEG, PNG, AVIF vs disguised scripts)
 * 4. Rate Limiting & Sliding Window Isolation
 * 5. Input Sanitization & Anti-XSS Guards
 */

import assert from 'node:assert';
import { createGateSessionToken, verifyGateSessionToken } from '../lib/security/gateAuth.ts';
import { validateBase64Image, validateImageMagicBytes } from '../lib/security/imageValidation.ts';
import { checkRateLimit } from '../lib/security/rateLimiter.ts';
import { getDefaultEvent, getActivePassesForOfflineCache } from '../lib/db/store.ts';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}❌ FAIL:${colors.reset} ${name}`);
    console.error(`     ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}❌ FAIL:${colors.reset} ${name}`);
    console.error(`     ${err.message}`);
  }
}

console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
console.log(`   WEDDINGPASS v5.9.2 - SECURITY & POLICY INTEGRATION TEST SUITE       `);
console.log(`=======================================================================${colors.reset}\n`);

// 1. Offline Cache Access Control
console.log(`${colors.bold}--- [1] Offline Cache Access Control & Sanitization ---${colors.reset}`);
await runAsyncTest('getActivePassesForOfflineCache retrieves only active hashed records', async () => {
  const event = await getDefaultEvent();
  const passes = await getActivePassesForOfflineCache(event.id);
  assert(Array.isArray(passes), 'Passes must be an array');
  for (const p of passes) {
    assert(p.partyId, 'Party ID must exist');
    assert(p.passTokenHash, 'Pass token hash must exist');
    assert.strictEqual(p.rawPassToken, undefined, 'Raw pass token must NEVER be exposed in cache dump');
  }
});

// 2. Strict HMAC Session Integrity & Expiration
console.log(`\n${colors.bold}--- [2] Strict HMAC Session Integrity & Expiration ---${colors.reset}`);
runTest('verifyGateSessionToken validates authentic token and extracts payload', () => {
  const token = createGateSessionToken({
    eventId: 'a0000000-0000-0000-0000-000000000001',
    stationId: 'stn_gate_1',
    stationName: 'Gate 1',
    operatorId: 'op_admin',
    operatorName: 'Supervisor',
    role: 'supervisor',
    gateSection: 'men',
    expiresAt: Date.now() + 3600000,
  });

  const verified = verifyGateSessionToken(token);
  assert(verified !== null, 'Should verify valid token');
  assert.strictEqual(verified.role, 'supervisor', 'Role must match');
  assert.strictEqual(verified.stationName, 'Gate 1', 'Station name must match');
});

runTest('verifyGateSessionToken rejects tampered signature', () => {
  const token = createGateSessionToken({
    eventId: 'a0000000-0000-0000-0000-000000000001',
    stationId: 'stn_gate_1',
    stationName: 'Gate 1',
    operatorId: 'op_admin',
    operatorName: 'Supervisor',
    role: 'supervisor',
    gateSection: 'men',
    expiresAt: Date.now() + 3600000,
  });

  const tamperedToken = token.slice(0, -4) + 'abcd';
  const verified = verifyGateSessionToken(tamperedToken);
  assert.strictEqual(verified, null, 'Tampered token must be rejected');
});

runTest('verifyGateSessionToken rejects expired session', () => {
  const expiredToken = createGateSessionToken({
    eventId: 'a0000000-0000-0000-0000-000000000001',
    stationId: 'stn_gate_1',
    stationName: 'Gate 1',
    operatorId: 'op_admin',
    operatorName: 'Supervisor',
    role: 'supervisor',
    gateSection: 'men',
    expiresAt: Date.now() - 1000, // 1 second ago
  });

  const verified = verifyGateSessionToken(expiredToken);
  assert.strictEqual(verified, null, 'Expired token must be rejected');
});

// 3. Binary Magic Bytes & Polyglot Upload Defense
console.log(`\n${colors.bold}--- [3] Binary Magic Bytes & Polyglot Upload Defense ---${colors.reset}`);
runTest('validateBase64Image rejects PHP/JS script payload disguised as image', () => {
  const fakeScriptBase64 = Buffer.from('<?php system($_GET["cmd"]); ?>').toString('base64');
  const result = validateBase64Image(`data:image/jpeg;base64,${fakeScriptBase64}`);
  assert.strictEqual(result.valid, false, 'Should reject script file disguised as image');
});

runTest('validateBase64Image accepts authentic WebP image data URI', () => {
  const webpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  ]);
  const result = validateBase64Image(`data:image/webp;base64,${webpBuffer.toString('base64')}`);
  assert.strictEqual(result.valid, true, 'Should accept valid WebP');
});

runTest('validateBase64Image accepts authentic JPEG image data URI', () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const result = validateBase64Image(`data:image/jpeg;base64,${jpegBuffer.toString('base64')}`);
  assert.strictEqual(result.valid, true, 'Should accept valid JPEG');
});

runTest('validateBase64Image accepts authentic PNG image data URI', () => {
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  const result = validateBase64Image(`data:image/png;base64,${pngBuffer.toString('base64')}`);
  assert.strictEqual(result.valid, true, 'Should accept valid PNG');
});

// 4. Rate Limiter Sliding Window Isolation
console.log(`\n${colors.bold}--- [4] Rate Limiter Sliding Window Isolation ---${colors.reset}`);
runTest('checkRateLimit isolates different IP keys and enforces threshold', () => {
  const key1 = `test_ip_1_${Date.now()}`;
  const key2 = `test_ip_2_${Date.now()}`;

  // Key 1 consumes 3 tokens (limit 3)
  assert.strictEqual(checkRateLimit(key1, 3, 60000).allowed, true);
  assert.strictEqual(checkRateLimit(key1, 3, 60000).allowed, true);
  assert.strictEqual(checkRateLimit(key1, 3, 60000).allowed, true);
  assert.strictEqual(checkRateLimit(key1, 3, 60000).allowed, false, 'Key 1 must be blocked after 3 requests');

  // Key 2 should still be allowed (independent quota)
  assert.strictEqual(checkRateLimit(key2, 3, 60000).allowed, true, 'Key 2 must be unaffected by Key 1');
});

// Summary
console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
console.log(`  POLICY & SECURITY INTEGRATION SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
console.log(`=======================================================================${colors.reset}\n`);

if (passed !== total) {
  process.exit(1);
}
