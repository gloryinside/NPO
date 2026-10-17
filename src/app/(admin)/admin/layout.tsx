import { requireAdminUser } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/sidebar";
import { Toaster } from "sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminUser();
  return (
    <div className="app-canvas flex h-screen">
      <AdminSidebar user={user} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-8 lg:px-10">{children}</div>
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
