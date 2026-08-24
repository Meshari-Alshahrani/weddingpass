import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const nodeArgs = [
  '--experimental-strip-types',
  '--input-type=module',
  '--eval',
  "import('./lib/repositories/index.ts').then(({ getRepository }) => { getRepository(); process.exit(0); }).catch(() => process.exit(1));",
];

const result = spawnSync(process.execPath, nodeArgs, {
  cwd: process.cwd(),
  env: { PATH: process.env.PATH, NODE_ENV: 'production' },
});

assert.notEqual(result.status, 0, 'Production must reject a missing Supabase service-role configuration');

const rateLimiter = await readFile(new URL('../lib/security/rateLimiter.ts', import.meta.url), 'utf8');
assert(rateLimiter.includes("RATE_LIMITER_MODE"), 'Rate limiter must require an explicit production mode');
assert(rateLimiter.includes("Distributed rate limiting is required in production"), 'Production must reject an implicit local rate limiter');

const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
for (const key of [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'GATE_SESSION_SECRET',
  'ADMIN_SECRET',
  'SUPERVISOR_PIN',
  'ADMIN_PIN',
  'CSP_MODE',
  'RATE_LIMITER_MODE',
]) {
  assert(envExample.includes(key), `.env.example must document ${key}`);
}

// Secret separation guard (ADR-032): the admin dashboard credential must never
// equal the gate or supervisor credentials, and the legacy '2026' default is
// banned from any admin authentication path.
const authRouteSource = await readFile(new URL('../app/api/admin/auth/route.ts', import.meta.url), 'utf8');
assert(authRouteSource.includes('assertAdminPinSeparation'), 'Admin auth route must enforce ADMIN_PIN secret separation');
assert(!authRouteSource.includes("'2026'"), 'Admin auth route must not contain the legacy 2026 PIN');

const dashboardSource = await readFile(new URL('../components/AdminDashboard.tsx', import.meta.url), 'utf8');
assert(!dashboardSource.includes("=== '2026'"), 'AdminDashboard must not contain a hardcoded 2026 PIN bypass');
assert(!dashboardSource.includes('weddingpass_admin_auth_'), 'AdminDashboard must not trust client-side sessionStorage auth');
assert(dashboardSource.includes('/api/admin/auth'), 'AdminDashboard lock button must clear the server session');

const proxySource = await readFile(new URL('../proxy.ts', import.meta.url), 'utf8');
assert(proxySource.includes('verifyAdminSessionToken'), 'Proxy must optimistically verify the admin session cookie');
assert(proxySource.includes('Content-Security-Policy'), 'Proxy must emit the hardened CSP header');

const storeFacade = await readFile(new URL('../lib/db/store.ts', import.meta.url), 'utf8');
assert(storeFacade.includes("import { getRepository }"), 'store facade must delegate to the repository composition root');
assert(!storeFacade.includes('globalThis.__weddingpass_db'), 'store facade must not contain an in-memory production database');

const legacySchema = await readFile(new URL('../lib/db/schema.sql', import.meta.url), 'utf8');
assert(legacySchema.includes('DEPRECATED'), 'legacy consolidated schema must remain disabled to avoid migration drift');

console.log('✔ Production configuration guards and deployment template verified');
