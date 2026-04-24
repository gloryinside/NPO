"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  children?: { href: string; label: string }[];
}

const ITEMS: NavItem[] = [
  { href: "/donor", label: "홈" },
  { href: "/donor/promises", label: "약정" },
  { href: "/donor/payments", label: "납입" },
  { href: "/donor/receipts", label: "영수증" },
  { href: "/donor/impact", label: "임팩트" },
  { href: "/donor/cheer", label: "응원" },
  {
    href: "/donor/support",
    label: "고객지원",
    children: [
      { href: "/donor/support", label: "지원 허브" },
      { href: "/donor/support/notice", label: "공지사항" },
      { href: "/donor/support/faq", label: "FAQ" },
      { href: "/donor/support/inquiries", label: "내 문의" },
      { href: "/donor/support/inquiries/new", label: "문의하기" },
    ],
  },
  { href: "/donor/invite", label: "초대" },
  { href: "/donor/profile", label: "내 정보" },
  { href: "/donor/settings", label: "설정" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/donor") return pathname === "/donor";
  return pathname.startsWith(href);
}

export function DonorNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-6 flex items-center gap-3">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        if (item.children) {
          const groupActive = pathname.startsWith(item.href);
          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                className={[
                  "text-sm no-underline pb-0.5 transition-colors duration-150",
                  groupActive
                    ? "font-medium text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "font-normal text-[var(--muted-foreground)] border-b-2 border-transparent hover:text-[var(--text)]",
                ].join(" ")}
              >
                {item.label} ▾
              </Link>
              {/* 드롭다운 */}
              <div className="absolute left-0 top-full z-50 hidden group-hover:block pt-1">
                <ul className="min-w-[8rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={[
                            "block px-4 py-2 text-xs no-underline transition-colors",
                            childActive
                              ? "font-medium text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                              : "text-[var(--text)] hover:bg-[var(--surface-2)]",
                          ].join(" ")}
                        >
                          {child.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "text-sm no-underline pb-0.5 border-b-2 transition-colors duration-150",
              active
                ? "font-medium text-[var(--accent)] border-[var(--accent)]"
                : "font-normal text-[var(--muted-foreground)] border-transparent hover:text-[var(--text)]",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
