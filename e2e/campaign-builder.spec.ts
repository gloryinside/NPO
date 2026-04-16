import { test, expect } from '@playwright/test';

test('builder: create, edit blocks, autosave, publish', async ({ page, request }) => {
  // Login
  await page.goto('/admin/login');
  await page.getByLabel('이메일').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('비밀번호').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL('**/admin/**');

  // Create campaign
  await page.goto('/admin/campaigns');
  await page.getByRole('button', { name: /새 캠페인/ }).click();
  await page.getByLabel('제목').fill('E2E Builder');
  const slug = `e2e-builder-${Date.now()}`;
  await page.getByLabel('슬러그').fill(slug);
  await page.getByRole('button', { name: /저장/ }).click();

  // Open page editor
  await page.getByRole('link', { name: /페이지 편집기 열기/ }).click();
  await page.waitForURL('**/edit');

  // Add blocks
  await page.getByRole('button', { name: 'Hero 배너' }).click();
  await page.getByRole('button', { name: '텍스트' }).click();
  await page.getByRole('button', { name: '퀵 후원 폼' }).click();

  // Wait for autosave
  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 8000 });

  // Publish
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '게시하기' }).click();
  await expect(page.getByText(/게시되었습니다/)).toBeVisible({ timeout: 5000 });

  // Verify public page is accessible
  const pub = await request.get(`/campaigns/${slug}`);
  expect(pub.status()).toBe(200);
});
