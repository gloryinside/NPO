import Link from "next/link";
import { getTenant } from "@/lib/tenant/context";

export default async function PublicNav() {
  const tenant = await getTenant();
  const orgName = tenant?.name ?? "NPO 후원관리";

  return (
    <header
      style={{
        height: "56px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
      className="flex items-center px-6"
    >
      <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
        <span className="font-semibold text-[var(--text)]">{orgName}</span>
        <Link
          href="/admin/login"
          className="text-sm text-[var(--muted-foreground)] hover:text-[var(--text)] transition-colors px-3 py-1 rounded-md hover:bg-[var(--surface-2)]"
        >
          로그인
        </Link>
      </div>
    </header>
  );
}
