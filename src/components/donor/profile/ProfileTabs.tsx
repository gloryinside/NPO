"use client";

import Link from "next/link";

export type ProfileTabKey = "info" | "password";

interface Props {
  active: ProfileTabKey;
  labels: Record<ProfileTabKey, string>;
}

const ORDER: ProfileTabKey[] = ["info", "password"];

export function ProfileTabs({ active, labels }: Props) {
  return (
    <div
      role="tablist"
      aria-label="내 정보 탭"
      className="flex gap-1 overflow-x-auto"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      {ORDER.map((key) => {
        const isActive = key === active;
        const href = key === "info" ? "/donor/profile" : `/donor/profile?tab=${key}`;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            scroll={false}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              color: isActive ? "var(--accent)" : "var(--muted-foreground)",
              borderBottom: isActive
                ? "2px solid var(--accent)"
                : "2px solid transparent",
              marginBottom: -1,
              textDecoration: "none",
            }}
          >
            {labels[key]}
          </Link>
        );
      })}
    </div>
  );
}
