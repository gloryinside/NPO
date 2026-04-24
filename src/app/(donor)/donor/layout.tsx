import type { Metadata, Viewport } from "next";
import { getDonorSession } from "@/lib/auth";
import { logoutDonor } from "./actions";
import { EmailVerifyBanner } from "@/components/donor/auth/EmailVerifyBanner";

// G-D63: PWA manifest — 홈 화면 추가, standalone 모드
export const metadata: Metadata = {
  manifest: "/manifest.json",
};
export const viewport: Viewport = {
  themeColor: "#7c3aed",
};
import { DonorNav } from "@/components/donor/donor-nav";
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { SessionKeepalive } from "@/components/donor/auth/SessionKeepalive";
import { SessionExpiredGuard } from "@/components/donor/auth/SessionExpiredGuard";
import { WebVitalsReporter } from "@/components/observability/WebVitalsReporter";
import { OfflineBanner } from "@/components/donor/ui/OfflineBanner";
import { DonorFAB } from "@/components/donor/ui/DonorFAB";

export default async function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDonorSession();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {session && <SessionKeepalive />}
      {session && <SessionExpiredGuard />}
      <WebVitalsReporter />
      <OfflineBanner />
      <header
        className="sticky top-0 z-40"
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
       <div
         className="mx-auto flex h-full items-center gap-3 px-4 sm:px-6 lg:px-8"
         style={{ maxWidth: 1200 }}
       >
        {/* 로고 */}
        <a
          href="/donor"
          style={{
            color: "var(--text)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <LogoWithText variant="header" size="md" />
        </a>

        {/* 데스크탑 내비 */}
        {session && (
          <div className="hidden sm:flex">
            <DonorNav />
          </div>
        )}

        {/* 우측 액션 */}
        <div
          className="ml-auto flex items-center gap-3"
        >
          <ThemeToggle persistToServer={!!session} />

          {session ? (
            <>
              <span
                className="hidden sm:inline text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {session.member.name}님
              </span>
              <form action={logoutDonor}>
                <button
                  type="submit"
                  className="text-sm transition-opacity hover:opacity-70"
                  style={{
                    color: "var(--muted-foreground)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <a
              href="/donor/login"
              className="text-sm"
              style={{ color: "var(--muted-foreground)", textDecoration: "none" }}
            >
              로그인
            </a>
          )}
        </div>
       </div>
      </header>

      {/* 모바일 FAB — 새 후원 CTA (G-D09/D37) */}
      {session && <DonorFAB />}

      {/* 모바일 하단 네비바 */}
      {session && (
        <nav
          aria-label="모바일 주요 메뉴"
          className="fixed bottom-0 left-0 right-0 z-40 flex sm:hidden"
          style={{
            background: "var(--surface)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {[
            { href: "/donor", icon: "🏠", label: "홈" },
            { href: "/donor/promises", icon: "📋", label: "약정" },
            { href: "/donor/payments", icon: "💳", label: "납입" },
            { href: "/donor/impact", icon: "✨", label: "임팩트" },
            { href: "/donor/settings", icon: "⚙️", label: "설정" },
          ].map(({ href, icon, label }) => (
            <a
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center justify-center py-2 text-xs transition-opacity hover:opacity-70"
              style={{
                color: "var(--muted-foreground)",
                textDecoration: "none",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
              <span>{label}</span>
            </a>
          ))}
        </nav>
      )}

      {/* G-D64: Skip-to-content 링크 */}
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        style={{ background: "var(--accent)" }}
      >
        본 내용으로 건너뛰기
      </a>

      <main
        id="content"
        role="main"
        className="mx-auto px-4 pt-6 pb-24 sm:pb-8 sm:px-6 lg:px-8"
        style={{ maxWidth: 1200 }}
      >
        {/* G-D55: Supabase 이메일 계정 미인증 안내 */}
        {session?.authMethod === "supabase" &&
          session.user?.email &&
          !session.user.email_confirmed_at && (
            <EmailVerifyBanner email={session.user.email} />
          )}
        {children}
      </main>

      {/* G-D61: Legal 풋터 */}
      <footer
        className="mx-auto mt-8 px-4 py-6 text-center text-xs sm:px-6 lg:px-8"
        style={{ maxWidth: 1200, color: "var(--muted-foreground)" }}
        data-print-hide="true"
      >
        <nav aria-label="정책" className="flex flex-wrap justify-center gap-4">
          <a
            href="/privacy"
            className="hover:underline"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            개인정보처리방침
          </a>
          <a
            href="/terms"
            className="hover:underline"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            이용약관
          </a>
          <a
            href="/contact"
            className="hover:underline"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            문의하기
          </a>
        </nav>
      </footer>
    </div>
  );
}
