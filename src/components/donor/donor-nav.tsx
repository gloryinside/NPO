"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
}

const ITEMS: NavItem[] = [
  { href: "/donor", label: "홈" },
  { href: "/donor/promises", label: "약정" },
  { href: "/donor/payments", label: "납입" },
  { href: "/donor/receipts", label: "영수증" },
  { href: "/donor/impact", label: "임팩트" },
  { href: "/donor/cheer", label: "응원" },
  { href: "/donor/invite", label: "초대" },
  { href: "/donor/settings", label: "설정" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/donor") return pathname === "/donor";
  return pathname.startsWith(href);
}

export function DonorNav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        marginLeft: "1.5rem",
        display: "flex",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: active ? "var(--accent)" : "var(--muted-foreground)",
              fontSize: 14,
              textDecoration: "none",
              fontWeight: active ? 500 : 400,
              borderBottom: active
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              paddingBottom: 2,
              transition: "color 0.15s",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
