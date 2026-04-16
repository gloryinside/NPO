import { getDonorSession } from "@/lib/auth";
import { logoutDonor } from "./actions";
import { DonorNav } from "@/components/donor/donor-nav";

export default async function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDonorSession();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
        }}
      >
        <a
          href="/donor"
          style={{
            color: "var(--text)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          후원자 마이페이지
        </a>
        {session && <DonorNav />}
        <nav
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          {session ? (
            <>
              <span
                style={{
                  color: "var(--muted-foreground)",
                  fontSize: 14,
                }}
              >
                {session.member.name}님
              </span>
              <form action={logoutDonor}>
                <button
                  type="submit"
                  style={{
                    color: "var(--muted-foreground)",
                    fontSize: 14,
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
              style={{
                color: "var(--muted-foreground)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              로그인
            </a>
          )}
        </nav>
      </header>
      <main
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "2rem 1rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
