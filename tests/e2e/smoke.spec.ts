import { test, expect, type Page } from '@playwright/test';

/**
 * Hardened-CSP + hydration smoke across the six public/operational surfaces.
 * Fails on: uncaught page errors, console errors, and CSP violations.
 */

const BENIGN_CONSOLE_PATTERNS = [
  /Download the React DevTools/i,
  /Autoplay policy/i, // Web Audio unlock prompts before user gesture
  /\[Fast Refresh\]/i,
  /React will try to reopen this Error Boundary/i,
  // Pre-auth probes are expected: GateScanner polls /api/gate/cache (and
  // /api/checkin session checks) before the operator logs in → 401 noise.
  /Failed to load resource.*401/,
];

function isBenign(text: string): boolean {
  return BENIGN_CONSOLE_PATTERNS.some((re) => re.test(text));
}

const ROUTES = ['/', '/moments', '/admin/login', '/admin', '/checkin'];

for (const route of ROUTES) {
  test(`smoke: ${route} renders without console/CSP/hydration errors`, async ({ page }, testInfo) => {
    const problems: string[] = [];

    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isBenign(text)) return;
      problems.push(`console.error: ${text}`);
    });

    await page.goto(route, { waitUntil: 'networkidle' });

    // /admin without a session must land on the login screen (proxy gate)
    if (route === '/admin') {
      expect(page.url()).toContain('/admin/login');
    }

    expect(problems, `Route ${route} reported:\n` + problems.join('\n')).toEqual([]);
    void testInfo;
  });
}
