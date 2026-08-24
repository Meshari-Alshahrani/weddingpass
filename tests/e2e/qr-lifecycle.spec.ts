import { test, expect } from '@playwright/test';

/**
 * THE business flow of the entire product (Definition of Done, part 1):
 *   join via group link -> credential issued (raw token) -> QR rendered
 *   -> gate check-in SUCCESS -> immediate second scan ALREADY_CHECKED_IN.
 *
 * Runs against `next dev` with WEDDINGPASS_ALLOW_MOCK=true (demo seed).
 */

const MOCK_EVENT_ID = 'e82b75a1-4321-4f99-8d76-9c8821a71101';
const PASS_STORAGE_KEY = `weddingpass_pass_${MOCK_EVENT_ID}`;

test('QR lifecycle: join → credential → check-in SUCCESS → duplicate rejected', async ({ page }) => {
  // Unique guest per run: the dev server reuses its mock store across runs.
  const suffix = String(Date.now()).slice(-8);
  const phone = `05${suffix}`; // valid Saudi mobile shape: 10 digits

  // -------------------------------------------------------------------
  // 1. Guest registers through the WhatsApp group link
  // -------------------------------------------------------------------
  await page.goto('/join/colleagues', { waitUntil: 'networkidle' });

  await page.getByPlaceholder('مثال: خالد محمد العتيبي').fill(`ضيف اختبار ${suffix}`);
  await page.getByPlaceholder('05XXXXXXXX').first().fill(phone);
  await page.getByRole('button', { name: /تأكيد الحضور واستلام بطاقة الدخول/ }).click();

  // -------------------------------------------------------------------
  // 2. Credential was issued and cached for the guest's own device
  //    (localStorage write happens right after a successful registration)
  // -------------------------------------------------------------------
  await page.waitForFunction(
    (key) => {
      try {
        const raw = localStorage.getItem(key);
        return Boolean(raw && JSON.parse(raw as string)?.raw_pass_token);
      } catch {
        return false;
      }
    },
    PASS_STORAGE_KEY,
    { timeout: 10_000 }
  );

  const storedRaw = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as { raw_pass_token?: string }).raw_pass_token ?? null;
    } catch {
      return null;
    }
  }, PASS_STORAGE_KEY);

  expect(storedRaw, 'raw pass token must be issued and cached after successful registration').toBeTruthy();
  expect(storedRaw!.startsWith('wp_pass_')).toBe(true);

  // -------------------------------------------------------------------
  // 3. Gate operator authenticates with the demo gate PIN
  // -------------------------------------------------------------------
  await page.goto('/checkin', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('••••').fill('2026');
  await page.getByRole('button', { name: /دخول للماسح/ }).click();

  // Manual verification input becomes available after auth
  const manualInput = page.getByPlaceholder('مثال: wp_pass_xxx أو 05XXXXXXXX');
  await expect(manualInput).toBeVisible();

  // -------------------------------------------------------------------
  // 4. First scan: admitted
  // -------------------------------------------------------------------
  await manualInput.fill(storedRaw!);
  await page.getByRole('button', { name: 'تحقق' }).click();
  await expect(page.getByText('مصرح بالدخول ✅')).toBeVisible({ timeout: 15_000 });

  // -------------------------------------------------------------------
  // 5. Immediate second scan (anti-replay): rejected
  // -------------------------------------------------------------------
  await page.getByRole('button', { name: 'تحقق' }).click();
  await expect(page.getByText(/تم استخدام بطاقة الدخول هذه مسبقاً/)).toBeVisible({ timeout: 15_000 });
});
