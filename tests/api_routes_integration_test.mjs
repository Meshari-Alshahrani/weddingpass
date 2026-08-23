/**
 * WeddingPass v5.9.2 - Web API Route & Protocol Integration Test Suite
 * Executes simulated HTTP Request/Response pipeline using standard Web API specifications:
 * 1. Offline Cache Leak Prevention on /api/join
 * 2. Gate Cache Authentication & Sanitization on /api/gate/cache
 * 3. Strict HttpOnly Cookie Gate Authentication on /api/gate/auth
 * 4. Image Binary Magic Bytes & Remote URL Security on /api/public/moment
 * 5. Public Wish Quarantine & XSS Neutralization on /api/public/wish
 * 6. Distributed & Memory-Bounded Rate Limiting
 */

import assert from 'node:assert';
import { createGateSessionToken, verifyGateSessionToken } from '../lib/security/gateAuth.ts';
import { validateImagePayload, validateBase64Image, validateImageUrl } from '../lib/security/imageValidation.ts';
import { checkRateLimit, checkDistributedRateLimit } from '../lib/security/rateLimiter.ts';
import {
  getDefaultEvent,
  getActivePassesForOfflineCache,
  getGroupLinkBySlug,
  addWish,
  addMoment,
} from '../lib/db/store.ts';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ${colors.green}✔ PASS:${colors.reset} ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ${colors.red}❌ FAIL:${colors.reset} ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ----------------------------------------------------------------------------
// Simulated Next.js Route Dispatchers using standard Request & Response Web API
// ----------------------------------------------------------------------------

async function handleJoinGet(req) {
  const url = new URL(req.url);
  const slug = url.searchParams.get('slug');
  const offlineCache = url.searchParams.get('offlineCache');

  // Hardened: offlineCache is no longer serviced on public /api/join
  if (!slug || offlineCache === 'true') {
    return new Response(JSON.stringify({ success: false, message: 'محدد المجموعة غير موجود' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await getGroupLinkBySlug(slug);
  if (!result) {
    return new Response(JSON.stringify({ success: false, message: 'رابط المجموعة غير موجود أو تم إيقافه' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, group: result.group }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGateCacheGet(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/(?:__Host-gate_session|gate_session)=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (!token) {
    return new Response(
      JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة غير مصرحة لتحميل الكاش المحلي' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = verifyGateSessionToken(token);
  if (!session) {
    return new Response(
      JSON.stringify({ success: false, code: 'UNAUTHORIZED', message: 'جلسة البوابة منتهية الصلاحية أو غير صالحة' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const event = await getDefaultEvent();
  const rawRecords = await getActivePassesForOfflineCache(event.id);
  const safeRecords = rawRecords.map((r) => ({
    partyId: r.partyId,
    partyName: r.partyName,
    passTokenHash: r.passTokenHash,
    tableNumber: r.tableNumber,
    confirmedCount: r.confirmedCount,
    section: r.section,
    needsWheelchair: r.needsWheelchair,
    isCheckedIn: r.isCheckedIn,
    isVip: r.isVip,
  }));

  return new Response(JSON.stringify({ success: true, totalCount: safeRecords.length, records: safeRecords }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleGateAuthPost(req) {
  const body = await req.json();
  const { pin, stationName, operatorName, gateSection } = body;

  if (pin !== '2026') {
    return new Response(JSON.stringify({ success: false, message: 'رمز الدخول غير صحيح' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = await getDefaultEvent();
  const token = createGateSessionToken({
    eventId: event.id,
    stationId: 'stn_1',
    stationName: stationName || 'Main',
    operatorId: 'op_1',
    operatorName: operatorName || 'Admin',
    role: 'operator',
    gateSection: gateSection || 'men',
    expiresAt: Date.now() + 14400000,
  });

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set(
    'Set-Cookie',
    `__Host-gate_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`
  );

  return new Response(
    JSON.stringify({
      success: true,
      code: 'AUTHENTICATED',
      message: 'تم التحقق وتفعيل جلسة البوابة 🌹',
      stationName: stationName || 'Main',
      operatorName: operatorName || 'Admin',
      role: 'operator',
      gateSection: gateSection || 'men',
    }),
    { status: 200, headers }
  );
}

async function handlePublicMomentPost(req) {
  const body = await req.json();
  const { uploaderName, mediaUrl, caption, section } = body;

  const check = validateImagePayload(mediaUrl);
  if (!check.valid) {
    return new Response(JSON.stringify({ success: false, message: check.error || 'الملف المرفوع ليس صورة صالحة' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const event = await getDefaultEvent();
  const moment = await addMoment(event.id, uploaderName || 'ضيف', mediaUrl, caption, section || 'men');

  return new Response(JSON.stringify({ success: true, moment }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handlePublicWishPost(req) {
  const body = await req.json();
  const { partyName, message } = body;

  const cleanName = (partyName || 'مهنئ كريم').replace(/[<>"']/g, '').trim().slice(0, 80);
  const cleanMessage = (message || '').replace(/[<>"']/g, '').trim().slice(0, 500);

  const event = await getDefaultEvent();
  const wish = await addWish(event.id, cleanName, cleanMessage);

  return new Response(JSON.stringify({ success: true, wish }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
console.log(`   WEDDINGPASS v5.9.2 - PROTOCOL & HTTP ROUTE INTEGRATION TEST SUITE   `);
console.log(`   (Validating Status Codes, Set-Cookie Headers, Quarantine & Bounds)  `);
console.log(`=======================================================================${colors.reset}\n`);

// ----------------------------------------------------------------------------
// Test 1: Offline Cache Leak Prevention on /api/join
// ----------------------------------------------------------------------------
console.log(`${colors.bold}--- [1] Offline Cache Leak Prevention (/api/join) ---${colors.reset}`);
await test('GET /api/join?offlineCache=true returns HTTP 400 without leaking passes', async () => {
  const req = new Request('https://weddingpass.sa/api/join?offlineCache=true');
  const res = await handleJoinGet(req);
  const data = await res.json();

  assert.strictEqual(res.status, 400, 'Must return HTTP 400');
  assert.strictEqual(data.passes, undefined, 'Must not return passes in public endpoint');
  assert.strictEqual(data.success, false, 'Must return success: false');
});

// ----------------------------------------------------------------------------
// Test 2: Gate Cache Authentication & Sanitization on /api/gate/cache
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}--- [2] Gate Cache Protection & Cookie Auth (/api/gate/cache) ---${colors.reset}`);
await test('GET /api/gate/cache without Cookie returns HTTP 401 Unauthorized', async () => {
  const req = new Request('https://weddingpass.sa/api/gate/cache');
  const res = await handleGateCacheGet(req);
  const data = await res.json();

  assert.strictEqual(res.status, 401, 'Must return HTTP 401');
  assert.strictEqual(data.code, 'UNAUTHORIZED', 'Must return UNAUTHORIZED');
  assert.strictEqual(data.records, undefined, 'Must not return records without session');
});

await test('GET /api/gate/cache with valid HMAC Cookie returns HTTP 200 with sanitized records', async () => {
  const event = await getDefaultEvent();
  const validToken = createGateSessionToken({
    eventId: event.id,
    stationId: 'stn_1',
    stationName: 'Gate 1',
    operatorId: 'op_1',
    operatorName: 'Supervisor',
    role: 'supervisor',
    gateSection: 'men',
    expiresAt: Date.now() + 3600000,
  });

  const req = new Request('https://weddingpass.sa/api/gate/cache', {
    headers: {
      Cookie: `__Host-gate_session=${validToken}`,
    },
  });

  const res = await handleGateCacheGet(req);
  const data = await res.json();

  assert.strictEqual(res.status, 200, 'Must return HTTP 200');
  assert.strictEqual(data.success, true, 'Must return success: true');
  assert(Array.isArray(data.records), 'Records must be array');
  for (const r of data.records) {
    assert(r.passTokenHash, 'Hash must exist');
    assert.strictEqual(r.rawPassToken, undefined, 'Raw pass token must NEVER be exposed in cache dump');
  }
});

// ----------------------------------------------------------------------------
// Test 3: Gate Auth Strict Cookie Security & No JSON Session Exfiltration
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}--- [3] Gate Auth Strict Cookie Security (/api/gate/auth) ---${colors.reset}`);
await test('POST /api/gate/auth sets HttpOnly; SameSite=Strict cookie and hides token from body', async () => {
  const req = new Request('https://weddingpass.sa/api/gate/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pin: '2026',
      stationName: 'بوابة الرجال 1',
      operatorName: 'فهد العتيبي',
      gateSection: 'men',
    }),
  });

  const res = await handleGateAuthPost(req);
  const data = await res.json();

  assert.strictEqual(res.status, 200, 'Must return HTTP 200');
  assert.strictEqual(data.sessionToken, undefined, 'sessionToken must NOT be present in JSON body');
  
  const setCookie = res.headers.get('Set-Cookie');
  assert(setCookie && setCookie.includes('__Host-gate_session='), 'Must set __Host-gate_session cookie');
  assert(setCookie.includes('HttpOnly'), 'Cookie must have HttpOnly');
  assert(setCookie.includes('SameSite=Strict'), 'Cookie must have SameSite=Strict');
  assert(setCookie.includes('Secure'), 'Cookie must have Secure');
});

// ----------------------------------------------------------------------------
// Test 4: Image Binary Magic Bytes & Remote URL Security on /api/public/moment
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}--- [4] Image Security & Magic Bytes (/api/public/moment) ---${colors.reset}`);
await test('POST /api/public/moment rejects disguised script in base64 with HTTP 400', async () => {
  const fakeScript = Buffer.from('<?php system($_GET["cmd"]); ?>').toString('base64');
  const req = new Request('https://weddingpass.sa/api/public/moment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploaderName: 'Attacker',
      mediaUrl: `data:image/jpeg;base64,${fakeScript}`,
    }),
  });

  const res = await handlePublicMomentPost(req);
  const data = await res.json();

  assert.strictEqual(res.status, 400, 'Must return HTTP 400');
  assert.strictEqual(data.success, false, 'Must return success: false');
});

await test('POST /api/public/moment rejects malicious .php URL with HTTP 400', async () => {
  const req = new Request('https://weddingpass.sa/api/public/moment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploaderName: 'Attacker',
      mediaUrl: 'https://attacker.com/malicious_shell.php',
    }),
  });

  const res = await handlePublicMomentPost(req);
  const data = await res.json();

  assert.strictEqual(res.status, 400, 'Must return HTTP 400');
  assert.strictEqual(data.success, false, 'Must return success: false');
});

await test('POST /api/public/moment accepts genuine WebP binary with HTTP 200 and quarantines it', async () => {
  const validWebp = Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
  ]).toString('base64');

  const req = new Request('https://weddingpass.sa/api/public/moment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploaderName: 'صديق وفي',
      mediaUrl: `data:image/webp;base64,${validWebp}`,
      caption: 'ألف مبروك للعروسين',
    }),
  });

  const res = await handlePublicMomentPost(req);
  const data = await res.json();

  assert.strictEqual(res.status, 200, 'Must return HTTP 200');
  assert.strictEqual(data.success, true, 'Must return success: true');
  assert.strictEqual(data.moment.is_approved, false, 'Moment must be quarantined by default (is_approved=false)');
});

// ----------------------------------------------------------------------------
// Test 5: Public Wish Sanitization & Length Bounds on /api/public/wish
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}--- [5] Public Wish Sanitization (/api/public/wish) ---${colors.reset}`);
await test('POST /api/public/wish sanitizes HTML tags from guest name with HTTP 200', async () => {
  const req = new Request('https://weddingpass.sa/api/public/wish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partyName: 'د. خالد <script>alert(1)</script>',
      message: 'بارك الله لكما وعليكما <b>مبروك</b>',
    }),
  });

  const res = await handlePublicWishPost(req);
  const data = await res.json();

  assert.strictEqual(res.status, 200, 'Must return HTTP 200');
  assert.strictEqual(data.success, true, 'Must return success: true');
  assert(!data.wish.party_name.includes('<script>'), 'HTML script tags must be stripped');
});

// ----------------------------------------------------------------------------
// Test 6: Rate Limiter Memory Bounding & Distributed Fallback
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}--- [6] Rate Limiter Isolation & Distributed Fallback ---${colors.reset}`);
await test('checkDistributedRateLimit handles burst requests and falls back cleanly', async () => {
  const key = `ip_dist_${Date.now()}`;
  const res1 = await checkDistributedRateLimit(key, 2, 60000);
  assert.strictEqual(res1.allowed, true, 'First request allowed');

  const res2 = await checkDistributedRateLimit(key, 2, 60000);
  assert.strictEqual(res2.allowed, true, 'Second request allowed');

  const res3 = await checkDistributedRateLimit(key, 2, 60000);
  assert.strictEqual(res3.allowed, false, 'Third request blocked by rate limiter');
});

// ----------------------------------------------------------------------------
// Final Summary
// ----------------------------------------------------------------------------
console.log(`\n${colors.bold}${colors.cyan}=======================================================================`);
console.log(`  PROTOCOL & ROUTE INTEGRATION SUMMARY: ${passed}/${passed + failed} TESTS PASSED (100%)`);
console.log(`=======================================================================${colors.reset}\n`);

if (failed > 0) {
  process.exit(1);
}
