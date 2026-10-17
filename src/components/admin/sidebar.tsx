"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  ChartColumn,
  ChevronDown,
  House,
  Megaphone,
  Menu,
  Search,
  Settings,
  Star,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(admin)/admin/actions";
import { NotificationBadge } from "./notification-badge";
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { ADMIN_NAV, ALL_NAV_ITEMS, activeNavHref, hubOfHref, type AdminNavHub, type AdminNavItem } from "@/lib/admin/nav";
import { useNavFavorites } from "./nav-favorites";
import { NavCommandPalette } from "./nav-command-palette";

/**
 * 관리자 사이드바 — 6개 허브 아코디언(지금 있는 허브만 펼침) + 즐겨찾기 + 메뉴 검색(⌘K).
 * 허브 안에서는 주요 메뉴만 보이고 나머지는 "더 보기". 모바일(md 미만)은 상단 바 + 서랍.
 * 현재 위치는 슬레이트 면 + 굵은 글씨(JobYLW 규칙: 그린은 행동·결과 신호 전용).
 */
const HUB_ICON: Record<AdminNavHub["icon"], LucideIcon> = {
  home: House,
  users: Users,
  wallet: Wallet,
  megaphone: Megaphone,
  chart: ChartColumn,
  settings: Settings,
};

function NavLink({
  item,
  active,
  favorite,
  onToggleFavorite,
}: {
  item: AdminNavItem;
  active: boolean;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <li className="group/nav relative">
      <Link
        href={item.href}
        title={item.desc}
        aria-current={active ? "page" : undefined}
        className={[
          "flex items-center justify-between rounded-lg py-1.5 pl-9 pr-8 text-sm no-underline transition-colors",
          active
            ? "bg-[var(--surface-2)] font-semibold text-[var(--text)]"
            : "text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
        ].join(" ")}
      >
        <span className="truncate">{item.label}</span>
        {item.href === "/admin/notifications" && <NotificationBadge />}
      </Link>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-label={favorite ? `${item.label} 즐겨찾기 해제` : `${item.label} 즐겨찾기`}
        aria-pressed={favorite}
        className={[
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity",
          favorite
            ? "text-[var(--warning)] opacity-100"
            : "text-[var(--muted-2)] opacity-0 hover:text-[var(--text)] focus-visible:opacity-100 group-hover/nav:opacity-100 pointer-coarse:opacity-100",
        ].join(" ")}
      >
        <Star className="size-3.5" fill={favorite ? "currentColor" : "none"} aria-hidden />
      </button>
    </li>
  );
}

function NavBody({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const activeHref = activeNavHref(pathname);
  const currentHub = hubOfHref(activeHref) ?? "home";
  const { favorites, toggle, isFavorite } = useNavFavorites();

  // 지금 있는 허브는 항상 펼침. 다른 허브는 눌러서 펼친 것만(다른 허브로 이동하면 정리)
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set()); // "더 보기"를 연 허브
  const [prevHub, setPrevHub] = useState(currentHub);
  if (prevHub !== currentHub) {
    setPrevHub(currentHub);
    setOpened(new Set());
  }

  const toggleSet = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const favItems = favorites
    .map((h) => ALL_NAV_ITEMS.find((i) => i.href === h))
    .filter((i): i is (typeof ALL_NAV_ITEMS)[number] => !!i);

  return (
    <>
      <button
        type="button"
        onClick={onOpenSearch}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm text-[var(--muted-foreground)] transition-colors hover:text-[var(--text)]"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">무엇을 할까요? 메뉴 찾기</span>
        <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      {favItems.length > 0 && (
        <div className="mb-3">
          <p className="px-2.5 pb-1 text-xs font-medium text-[var(--muted-2)]">즐겨찾기</p>
          <ul className="space-y-0.5">
            {favItems.map((it) => (
              <NavLink
                key={it.href}
                item={it}
                active={it.href === activeHref}
                favorite
                onToggleFavorite={() => toggle(it.href)}
              />
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-1">
        {ADMIN_NAV.map((hub) => {
          const Icon = HUB_ICON[hub.icon];
          const isCurrent = hub.id === currentHub;
          const isOpen = isCurrent || opened.has(hub.id);
          const showAll = expanded.has(hub.id);
          // 주요 메뉴 + (지금 보고 있는 메뉴가 "더 보기" 안이면 그것도) 보여 준다
          const visible = showAll ? hub.items : hub.items.filter((it) => it.primary || it.href === activeHref);
          const hiddenCount = hub.items.length - visible.length;
          const panelId = `nav-hub-${hub.id}`;
          return (
            <li key={hub.id}>
              <button
                type="button"
                onClick={() => !isCurrent && setOpened((s) => toggleSet(s, hub.id))}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={[
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  isCurrent ? "font-semibold text-[var(--text)]" : "font-medium text-[var(--muted-foreground)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
                ].join(" ")}
              >
                <Icon className={`size-4 ${isCurrent ? "text-[var(--accent)]" : ""}`} aria-hidden />
                <span className="flex-1 text-left">{hub.label}</span>
                {!isCurrent && (
                  <ChevronDown className={`size-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
                )}
              </button>
              {isOpen && (
                <div id={panelId}>
                  <ul className="mt-0.5 space-y-0.5">
                    {visible.map((it) => (
                      <NavLink
                        key={it.href}
                        item={it}
                        active={it.href === activeHref}
                        favorite={isFavorite(it.href)}
                        onToggleFavorite={() => toggle(it.href)}
                      />
                    ))}
                  </ul>
                  {(hiddenCount > 0 || showAll) && hub.items.some((it) => !it.primary) && (
                    <button
                      type="button"
                      onClick={() => setExpanded((s) => toggleSet(s, hub.id))}
                      className="mt-0.5 w-full rounded-lg py-1 pl-9 text-left text-xs text-[var(--muted-2)] hover:text-[var(--text)]"
                    >
                      {showAll ? "접기" : `더 보기 ${hiddenCount}`}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function UserArea({ user }: { user: User }) {
  return (
    <div className="border-t border-[var(--border)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-[var(--text)]">{user.email}</div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-0.5 cursor-pointer bg-transparent p-0 text-xs text-[var(--muted-foreground)] transition-colors hover:text-[var(--text)]"
            >
              로그아웃
            </button>
          </form>
        </div>
        <ThemeToggle persistToServer={false} />
      </div>
    </div>
  );
}

export function AdminSidebar({ user }: { user: User }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 다른 화면으로 가면 모바일 서랍을 닫는다(그리는 중 비교 — 효과로 닫으면 한 번 더 그린다)
  const [prevPath, setPrevPath] = useState(pathname);
  if (pathname !== prevPath) {
    setPrevPath(pathname);
    setDrawerOpen(false);
  }

  const openSearch = () => {
    setDrawerOpen(false);
    setSearchOpen(true);
  };

  return (
    <>
      {/* 모바일 상단 바 */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 md:hidden">
        <LogoWithText variant="header" size="sm" />
        <div className="flex items-center gap-1">
          <button type="button" onClick={openSearch} aria-label="메뉴 검색" className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]">
            <Search className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            aria-expanded={drawerOpen}
            aria-controls="admin-drawer"
            className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* 모바일 서랍 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onKeyDown={(e) => e.key === "Escape" && setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside
            id="admin-drawer"
            aria-label="관리자 메뉴"
            className="animate-rise absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-[var(--surface)] shadow-[var(--shadow-hero)]"
          >
            <div className="flex items-center justify-between px-4 py-3">
              <LogoWithText variant="header" size="sm" />
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="메뉴 닫기" autoFocus className="rounded-lg p-2 text-[var(--muted-foreground)] hover:bg-[var(--surface-2)]">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto px-3 pb-4">
              <NavBody onOpenSearch={openSearch} />
            </nav>
            <UserArea user={user} />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] md:flex">
        <div className="px-5 pb-4 pt-5">
          <LogoWithText variant="header" size="md" />
          <p className="mt-1.5 text-xs font-medium text-[var(--muted-foreground)]">후원 관리</p>
        </div>
        <nav aria-label="관리자 메뉴" className="flex-1 overflow-y-auto px-3 pb-4">
          <NavBody onOpenSearch={openSearch} />
        </nav>
        <UserArea user={user} />
      </aside>

      <NavCommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
