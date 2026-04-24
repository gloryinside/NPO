"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { logout } from "@/app/(admin)/admin/actions";
import { NotificationBadge } from "./notification-badge";
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    group: "보고서",
    items: [
      { label: "대시보드", href: "/admin" },
      { label: "통계", href: "/admin/stats" },
      { label: "기부금영수증", href: "/admin/receipts" },
    ],
  },
  {
    group: "후원관리",
    items: [
      { label: "후원자 관리", href: "/admin/members" },
      { label: "약정 관리", href: "/admin/promises" },
      { label: "약정 변경 추이", href: "/admin/promises/changes" },
      { label: "납입 관리", href: "/admin/payments" },
    ],
  },
  {
    group: "결제관리",
    items: [
      { label: "미납 관리", href: "/admin/unpaid" },
      { label: "이탈 위험 후원자", href: "/admin/at-risk" },
      { label: "정기 스케줄", href: "/admin/schedules" },
      { label: "CMS 출금 오류", href: "/admin/cms-errors" },
    ],
  },
  {
    group: "캠페인",
    items: [
      { label: "캠페인 목록", href: "/admin/campaigns" },
      { label: "랜딩페이지 편집", href: "/admin/landing" },
      { label: "응원 메시지 검수", href: "/admin/cheer" },
    ],
  },
  {
    group: "설정",
    items: [
      { label: "기관 설정", href: "/admin/settings" },
      { label: "사용자 관리", href: "/admin/users" },
      { label: "감사 로그", href: "/admin/audit-logs" },
      { label: "이메일 템플릿", href: "/admin/email-templates" },
    ],
  },
];

interface AdminSidebarProps {
  user: User;
}

function NavGroupSection({ group, items }: NavGroup) {
  const pathname = usePathname();
  return (
    <div style={{ marginTop: "0.75rem" }}>
      <div
        style={{
          padding: "0.25rem 1rem",
          fontSize: "0.7rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--muted-foreground)",
        }}
      >
        {group}
      </div>
      <div>
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "block",
                padding: "0.375rem 1rem",
                fontSize: "0.875rem",
                textDecoration: "none",
                transition: "color 0.15s, background-color 0.15s",
                color: isActive ? "var(--accent)" : "var(--text)",
                background: isActive
                  ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                  : "transparent",
                fontWeight: isActive ? 500 : 400,
                borderLeft: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function NotificationLink() {
  const pathname = usePathname();
  const isActive = pathname === "/admin/notifications";

  return (
    <Link
      href="/admin/notifications"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.375rem 1rem",
        borderRadius: "0.375rem",
        fontSize: "0.875rem",
        textDecoration: "none",
        transition: "color 0.15s, background-color 0.15s",
        color: isActive ? "var(--accent)" : "var(--muted-foreground)",
        background: isActive
          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
          : "transparent",
        fontWeight: isActive ? 500 : 400,
        marginBottom: "0.25rem",
      }}
    >
      알림
      <NotificationBadge />
    </Link>
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
        <LogoWithText variant="header" size="md" />
        <div
          style={{
            color: "var(--muted-foreground)",
            fontSize: "0.75rem",
            marginTop: "0.25rem",
          }}
        >
          관리자
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: "auto", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
        <NotificationLink />
        {NAV.map((group) => (
          <NavGroupSection key={group.group} {...group} />
        ))}
      </nav>

      {/* Theme toggle */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid var(--border)",
        }}
      >
        <ThemeToggle persistToServer={false} />
      </div>

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
