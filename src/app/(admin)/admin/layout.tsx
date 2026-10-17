import { requireAdminUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "sonner";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { SessionExpiredGuard } from "@/components/common/session-expired-guard";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminUser();
  return (
    <div className="app-canvas flex h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text)] shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        본문으로 건너뛰기
      </a>
      <AdminSidebar user={user} />
      <main id="main" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <AdminBreadcrumb />
          <SessionExpiredGuard
            apiPrefix="/api/admin/"
            loginHref="/admin/login?reason=expired"
            dismissible
            expiredBody="오래 쓰지 않아 로그아웃됐어요. 쓰던 내용이 있으면 닫고 복사해 둔 뒤 다시 로그인하세요."
          />
          {children}
        </div>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
