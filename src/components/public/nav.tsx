import Link from "next/link";
import { getTenant } from "@/lib/tenant/context";

export default async function PublicNav() {
  const tenant = await getTenant();
  const orgName = tenant?.name ?? "NPO 후원관리";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-4 backdrop-blur-md sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="text-base font-bold tracking-[-0.02em] text-[var(--text)] no-underline">
          {orgName}
        </Link>
        <Link
          href="/admin/login"
          className="inline-flex items-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-glow transition-colors hover:bg-[var(--accent-hover)]"
        >
          로그인
        </Link>
      </div>
    </header>
  );
}
