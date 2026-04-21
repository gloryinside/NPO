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
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "var(--bg)",
      }}
    >
      <AdminSidebar user={user} />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "2rem",
        }}
      >
        {children}
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
