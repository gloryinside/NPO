"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/donor", label: "홈" },
  { href: "/donor/promises", label: "약정" },
  { href: "/donor/payments", label: "납입내역" },
  { href: "/donor/receipts", label: "영수증" },
];

export function DonorNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        marginLeft: "1.5rem",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/donor"
            ? pathname === "/donor"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              color: isActive ? "var(--accent)" : "var(--muted-foreground)",
              fontSize: 14,
              textDecoration: "none",
              fontWeight: isActive ? 500 : 400,
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
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
