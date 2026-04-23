import { test, expect } from "@playwright/test";

/**
 * G-D140: Admin 구역 스모크 테스트.
 *
 * 본 스펙은 **미인증 접근 방어**만 검증 — 로그인 정액권 픽스처가 없는 환경에서도
 * 실행되어야 하므로 실제 admin 기능(멤버 CRUD, 환불 등)은 커버하지 않는다.
 * 인증 계정을 CI 에 주입한 뒤에는 admin-flow.spec.ts 로 확장 권장.
 */
test.describe("admin guard", () => {
  test("admin 루트 직접 접근은 로그인 페이지로 유도", async ({ page }) => {
    const res = await page.goto("/admin");
    // middleware 가 302/307 redirect 를 걸면 최종 URL 이 /admin/login
    await expect(page).toHaveURL(/\/admin\/login/);
    expect(res?.status()).toBeLessThan(500);
  });

  test("관리자 API 는 401 반환", async ({ request }) => {
    const r = await request.get("/api/admin/notifications");
    expect([401, 403]).toContain(r.status());
  });

  test("관리자 비밀번호 찾기 페이지 렌더", async ({ page }) => {
    await page.goto("/admin/password/forgot");
    await expect(page.getByRole("heading", { name: /비밀번호 찾기/ })).toBeVisible();
  });
});

test.describe("legal pages", () => {
  test("/privacy 접근 가능", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("article")).toBeVisible();
  });

  test("/terms 접근 가능", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.ok()).toBeTruthy();
    await expect(page.locator("article")).toBeVisible();
  });
});

test.describe("health check", () => {
  test("/api/health 200 + DB ok", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    const body = (await r.json()) as {
      status: string;
      checks: Record<string, { ok: boolean }>;
    };
    expect(body.status).toBe("ok");
    expect(body.checks.db?.ok).toBe(true);
  });
});
