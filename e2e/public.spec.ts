import { test, expect } from "@playwright/test";

/**
 * Phase 1 E2E: read-only public flows + auth page accessibility.
 *
 * Multi-tenant subdomain routing is tested by navigating to
 * `http://demo.localhost:3000` directly — *.localhost resolves to 127.0.0.1
 * on macOS/modern Linux stub resolvers, and Next.js middleware extracts the
 * `demo` slug from the Host header. No /etc/hosts tweaks needed.
 */

const PLATFORM_ORIGIN = "http://localhost:3000";
const TENANT_ORIGIN = "http://demo.localhost:3000";

test.describe("Public pages — platform root (no tenant)", () => {
  test("shows platform hero and CTA", async ({ page }) => {
    await page.goto(`${PLATFORM_ORIGIN}/`);
    await expect(
      page.getByRole("heading", {
        name: "비영리단체를 위한 후원관리 플랫폼",
      })
    ).toBeVisible();
    const cta = page.getByRole("link", { name: "시작하기" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/admin/login");
  });

  test("shows 3 feature cards", async ({ page }) => {
    await page.goto(`${PLATFORM_ORIGIN}/`);
    // Icon + title are concatenated in a single text node (e.g. "🤝후원자 관리"),
    // so we match on the trailing label only.
    await expect(page.getByText(/후원자 관리$/)).toBeVisible();
    await expect(page.getByText(/캠페인 운영$/)).toBeVisible();
    await expect(page.getByText(/기부금 영수증$/)).toBeVisible();
  });
});

test.describe("Public pages — tenant (demo)", () => {
  test("tenant landing shows org name", async ({ page }) => {
    await page.goto(`${TENANT_ORIGIN}/`);
    await expect(
      page.getByRole("heading", {
        name: /데모 복지재단의 후원 캠페인/,
      })
    ).toBeVisible();
  });

  test("unknown campaign slug shows not found", async ({ page }) => {
    await page.goto(`${TENANT_ORIGIN}/campaigns/nonexistent-slug-xyz`);
    await expect(page.getByText("캠페인을 찾을 수 없습니다.")).toBeVisible();
  });
});

test.describe("Auth pages accessibility", () => {
  test("/admin/login renders form", async ({ page }) => {
    await page.goto(`${PLATFORM_ORIGIN}/admin/login`);
    await expect(
      page.getByRole("heading", { name: "관리자 로그인" })
    ).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByLabel("비밀번호")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
  });

  test("/admin without auth redirects to /admin/login", async ({ page }) => {
    await page.goto(`${PLATFORM_ORIGIN}/admin`);
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("/donor/login renders form with signup link", async ({ page }) => {
    await page.goto(`${PLATFORM_ORIGIN}/donor/login`);
    await expect(
      page.getByRole("heading", { name: "후원자 로그인" })
    ).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();
    await expect(page.getByLabel("비밀번호")).toBeVisible();
    await expect(page.getByRole("button", { name: "로그인" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "회원가입" })
    ).toHaveAttribute("href", "/donor/signup");
  });
});
