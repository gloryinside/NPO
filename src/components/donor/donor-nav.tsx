"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "후원",
    items: [
      { href: "/donor/promises", label: "약정" },
      { href: "/donor/payments", label: "납입내역" },
      { href: "/donor/receipts", label: "영수증" },
    ],
  },
  {
    label: "참여",
    items: [
      { href: "/donor/impact", label: "임팩트" },
      { href: "/donor/cheer", label: "응원" },
      { href: "/donor/invite", label: "초대" },
    ],
  },
];

const SINGLE_HOME: NavItem = { href: "/donor", label: "홈" };
const SINGLE_SETTINGS: NavItem = { href: "/donor/settings", label: "설정" };

function isActive(pathname: string, href: string): boolean {
  if (href === "/donor") return pathname === "/donor";
  return pathname.startsWith(href);
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? "var(--accent)" : "var(--muted-foreground)",
    fontSize: 14,
    textDecoration: "none",
    fontWeight: active ? 500 : 400,
    borderTop: "none",
    borderLeft: "none",
    borderRight: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    paddingBottom: 2,
    transition: "color 0.15s",
    background: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
  };
}

function DropdownGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = group.items.some((it) => isActive(pathname, it.href));

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const baseStyle = tabStyle(groupActive);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...baseStyle,
          borderBottom:
            groupActive || open
              ? "2px solid var(--accent)"
              : "2px solid transparent",
        }}
      >
        {group.label}
        <ChevronDown
          size={12}
          style={{
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-card)",
            padding: 4,
            minWidth: 140,
            zIndex: 50,
          }}
        >
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "0.5rem 0.75rem",
                  fontSize: 14,
                  color: active ? "var(--accent)" : "var(--text)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  borderRadius: 4,
                  textDecoration: "none",
                  fontWeight: active ? 500 : 400,
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

function SingleTab({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} style={tabStyle(active)}>
      {item.label}
    </Link>
  );
}

export function DonorNav() {
  return (
    <nav
      style={{
        marginLeft: "1.5rem",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <SingleTab item={SINGLE_HOME} />
      {GROUPS.map((g) => (
        <DropdownGroup key={g.label} group={g} />
      ))}
      <SingleTab item={SINGLE_SETTINGS} />
    </nav>
  );
}
