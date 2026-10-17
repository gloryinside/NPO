"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ALL_NAV_ITEMS, activeNavHref } from "@/lib/admin/nav";

/**
 * 지금 위치 — "후원·결제 › 기부금영수증 › 상세".
 * 메뉴 정의(lib/admin/nav)에서 자동으로 만든다. 상세 화면에서 목록으로 한 번에 돌아갈 수 있게.
 */
export function AdminBreadcrumb() {
  const pathname = usePathname();
  const href = activeNavHref(pathname);
  if (!href || href === "/admin") return null;
  const item = ALL_NAV_ITEMS.find((i) => i.href === href);
  if (!item) return null;
  const deeper = pathname !== href;

  return (
    <nav aria-label="현재 위치" className="mb-4 text-xs text-[var(--muted-foreground)]">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>{item.hubLabel}</li>
        <li aria-hidden>›</li>
        <li>
          {deeper ? (
            <Link href={href} className="rounded hover:text-[var(--text)] hover:underline">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-[var(--text)]">
              {item.label}
            </span>
          )}
        </li>
        {deeper && (
          <>
            <li aria-hidden>›</li>
            <li aria-current="page" className="font-medium text-[var(--text)]">
              {pathname.endsWith("/new") ? "새로 만들기" : pathname.endsWith("/edit") ? "편집" : "상세"}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
