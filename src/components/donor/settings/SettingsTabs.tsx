"use client";

import Link from "next/link";

export type SettingsTabKey = "notifications" | "security" | "preferences" | "account";

interface Props {
  active: SettingsTabKey;
  labels: Record<SettingsTabKey, string>;
}

const ORDER: SettingsTabKey[] = ["notifications", "security", "preferences", "account"];

export function SettingsTabs({ active, labels }: Props) {
  return (
    <div
      role="tablist"
      aria-label="설정 탭"
      className="flex gap-1 overflow-x-auto"
      style={{
        borderBottom: "1px solid var(--border)",
      }}
    >
      {ORDER.map((key) => {
        const isActive = key === active;
        const href = key === "notifications" ? "/donor/settings" : `/donor/settings?tab=${key}`;
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
