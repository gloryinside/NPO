import { getDonorSession } from "@/lib/auth";
import { logoutDonor } from "./actions";
import { DonorNav } from "@/components/donor/donor-nav";
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { SessionKeepalive } from "@/components/donor/auth/SessionKeepalive";
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
      <OfflineBanner />
      <header
        className="sticky top-0 z-40"
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          gap: "0.75rem",
        }}
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

      <main
        className="mx-auto px-4 pt-6 pb-24 sm:pb-8"
        style={{ maxWidth: 800 }}
      >
        {children}
      </main>
    </div>
  );
}
