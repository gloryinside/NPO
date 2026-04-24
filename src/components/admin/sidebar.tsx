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
      { label: "통계 개요", href: "/admin/stats" },
      { label: "후원자 라이프사이클", href: "/admin/stats/lifecycle" },
      { label: "LTV / 코호트", href: "/admin/stats/ltv" },
      { label: "기부금영수증", href: "/admin/receipts" },
      { label: "데이터 품질", href: "/admin/reports/data-health" },
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
      { label: "환불 승인", href: "/admin/refund-approvals" },
      { label: "카드 분쟁(Chargeback)", href: "/admin/chargebacks" },
      { label: "은행 입금 대사", href: "/admin/bank-reconciliation" },
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
    group: "고객지원",
    items: [
      { label: "문의 관리", href: "/admin/inquiries" },
      { label: "게시판 (공지/FAQ)", href: "/admin/board" },
    ],
  },
  {
    group: "설정",
    items: [
      { label: "기관 설정", href: "/admin/settings" },
      { label: "사용자 관리", href: "/admin/users" },
      { label: "감사 로그", href: "/admin/audit-logs" },
      { label: "이메일 템플릿", href: "/admin/email-templates" },
      { label: "이메일 반송", href: "/admin/email-bounces" },
      { label: "컴플라이언스", href: "/admin/compliance" },
    ],
  },
];

interface AdminSidebarProps {
  user: User;
}

function NavGroupSection({ group, items }: NavGroup) {
  const pathname = usePathname();
  return (
    <div className="mt-3">
      <div className="px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-[var(--muted-foreground)]">
        {group}
      </div>
      <div>
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "block px-4 py-1.5 text-sm no-underline transition-colors duration-150",
                "border-l-2",
                isActive
                  ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] font-medium text-[var(--accent)]"
                  : "border-transparent font-normal text-[var(--text)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
              ].join(" ")}
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
      className={[
        "mb-1 flex items-center rounded-md px-4 py-1.5 text-sm no-underline transition-colors duration-150",
        isActive
          ? "bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] font-medium text-[var(--accent)]"
          : "font-normal text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
      ].join(" ")}
    >
      알림
      <NotificationBadge />
    </Link>
  );
}

export function AdminSidebar({ user }: AdminSidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-2)]">
      {/* Brand area */}
      <div className="border-b border-[var(--border)] p-4">
        <LogoWithText variant="header" size="md" />
        <div className="mt-1 text-xs text-[var(--muted-foreground)]">관리자</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <NotificationLink />
        {NAV.map((group) => (
          <NavGroupSection key={group.group} {...group} />
        ))}
      </nav>

      {/* Theme toggle */}
      <div className="border-t border-[var(--border)] px-4 py-3">
        <ThemeToggle persistToServer={false} />
      </div>

      {/* User area */}
      <div className="border-t border-[var(--border)] p-4">
        <div className="mb-2 truncate text-xs text-[var(--muted-foreground)]">
          {user.email}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="cursor-pointer bg-transparent p-0 text-[0.8125rem] text-[var(--muted-foreground)] hover:text-[var(--text)] transition-colors duration-150"
          >
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
