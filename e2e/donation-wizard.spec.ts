import { test, expect } from '@playwright/test';

test('wizard: 일시 후원 happy path', async ({ page }) => {
  const slug = process.env.E2E_CAMPAIGN_SLUG!;

  await page.goto(`/donate/wizard?campaign=${slug}&type=onetime&amount=10000`);

  // Step 1: amount/type selection
  await expect(page.getByRole('button', { name: '다음' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  // Step 2: donor info
  await page.getByLabel('이름 *').fill('홍길동');
  await page.getByLabel('휴대폰 *').fill('01012345678');
  await page.getByLabel('이메일').fill('test@example.com');

  await page.getByLabel('[필수] 이용약관 동의').check();
  await page.getByLabel('[필수] 개인정보 수집·이용 동의').check();

  await page.getByRole('button', { name: '후원하기' }).click();

  // For offline/direct flow: should reach completed step
  await page.waitForURL(/completed=1/, { timeout: 15000 });
  await expect(page.getByText(/감사합니다/)).toBeVisible();
});

test('wizard: step 1 — custom amount updates state', async ({ page }) => {
  const slug = process.env.E2E_CAMPAIGN_SLUG!;
  await page.goto(`/donate/wizard?campaign=${slug}`);

  // Select a preset
  await page.getByRole('button', { name: '30,000원' }).click();
  await expect(page.getByRole('button', { name: '30,000원' })).toHaveClass(/border-rose-500/);

  // Next should be enabled
  await expect(page.getByRole('button', { name: '다음' })).toBeEnabled();
});
