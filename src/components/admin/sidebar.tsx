"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { logout } from "@/app/(admin)/admin/actions";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  group: string;
  defaultOpen: boolean;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: "후원관리",
    defaultOpen: true,
    items: [
      { label: "후원자 관리", href: "/admin/members" },
      { label: "약정 관리", href: "/admin/promises" },
      { label: "납입 관리", href: "/admin/payments" },
    ],
  },
  {
    group: "결제관리",
    defaultOpen: true,
    items: [
      { label: "미납 관리", href: "/admin/unpaid" },
      { label: "정기 스케줄", href: "/admin/schedules" },
      { label: "CMS 출금 오류", href: "/admin/cms-errors" },
    ],
  },
  {
    group: "캠페인",
    defaultOpen: true,
    items: [{ label: "캠페인 목록", href: "/admin/campaigns" }],
  },
  {
    group: "보고서",
    defaultOpen: false,
    items: [
      { label: "대시보드", href: "/admin" },
      { label: "통계", href: "/admin/stats" },
      { label: "기부금영수증", href: "/admin/receipts" },
    ],
  },
  {
    group: "설정",
    defaultOpen: false,
    items: [
      { label: "기관 설정", href: "/admin/settings" },
      { label: "사용자 관리", href: "/admin/users" },
    ],
  },
];

interface AdminSidebarProps {
  user: User;
}

function NavGroupSection({ group, items, defaultOpen }: NavGroup) {
  const [open, setOpen] = useState(defaultOpen);
  const pathname = usePathname();

  return (
    <div>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          background: "none",
          border: "none",
          outline: "none",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--muted-foreground)",
          }}
        >
          {group}
        </span>
        {open ? (
          <ChevronDown size={14} color="var(--muted-foreground)" />
        ) : (
          <ChevronRight size={14} color="var(--muted-foreground)" />
        )}
      </button>

      {open && (
        <div>
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.375rem 1.5rem",
                  borderRadius: "0.375rem",
                  fontSize: "0.875rem",
                  textDecoration: "none",
                  transition: "color 0.15s, background-color 0.15s",
                  color: isActive ? "var(--accent)" : "var(--muted-foreground)",
                  background: isActive
                    ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                    : "transparent",
                  fontWeight: isActive ? 500 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--text)";
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.backgroundColor = "var(--surface)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--muted-foreground)";
                    (
                      e.currentTarget as HTMLAnchorElement
                    ).style.backgroundColor = "transparent";
                  }
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  return (
    <aside
      style={{
        width: "240px",
        flexShrink: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-2)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Brand area */}
      <div
        style={{
          padding: "1rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            color: "var(--text)",
            fontWeight: 600,
            fontSize: "0.9375rem",
          }}
        >
          NPO 관리시스템
        </div>
        <div
          style={{
            color: "var(--muted-foreground)",
            fontSize: "0.75rem",
            marginTop: "0.125rem",
          }}
        >
          관리자
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
        {NAV.map((group) => (
          <NavGroupSection key={group.group} {...group} />
        ))}
      </nav>

      {/* User area */}
      <div
        style={{
          padding: "1rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            color: "var(--muted-foreground)",
            fontSize: "0.75rem",
            marginBottom: "0.5rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {user.email}
        </div>
        <form action={logout}>
          <button
            type="submit"
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--muted-foreground)",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color =
                "var(--muted-foreground)";
            }}
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
