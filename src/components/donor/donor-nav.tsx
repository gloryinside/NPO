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
    href: "/donor/sponsorships",
    label: "커뮤니티",
    children: [
      { href: "/donor/sponsorships", label: "내 결연" },
      { href: "/donor/volunteer", label: "봉사 활동" },
      { href: "/donor/events", label: "행사" },
      { href: "/donor/gifts", label: "기념품" },
      { href: "/donor/p2p", label: "P2P 모금" },
    ],
  },
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
  { href: "/donor/profile", label: "내 정보" },
  { href: "/donor/settings", label: "설정" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/donor") return pathname === "/donor";
  return pathname.startsWith(href);
}

// JobYLW GNB 문법 — 현재 위치는 슬레이트 면, 그린은 행동 신호(CTA)에만
function gnbLinkClass(active: boolean): string {
  return [
    "inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors",
    active
      ? "bg-[var(--surface-2)] text-[var(--text)]"
      : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
  ].join(" ");
}

export function DonorNav() {
  const pathname = usePathname();
  return (
    <nav className="ml-4 flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        if (item.children) {
          const groupActive = pathname.startsWith(item.href);
          return (
            <div key={item.href} className="relative group">
              <Link
                href={item.href}
                aria-current={groupActive ? "page" : undefined}
                className={gnbLinkClass(groupActive)}
              >
                {item.label} ▾
              </Link>
              {/* 드롭다운 */}
              <div className="absolute left-0 top-full z-50 hidden group-hover:block pt-1">
                <ul className="min-w-[11rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-card">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={[
                            "block whitespace-nowrap px-3.5 py-2 text-sm no-underline transition-colors hover:bg-[var(--surface-2)]",
                            childActive
                              ? "font-semibold text-[var(--text)]"
                              : "text-[var(--muted-foreground)] hover:text-[var(--text)]",
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
            aria-current={active ? "page" : undefined}
            className={gnbLinkClass(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
