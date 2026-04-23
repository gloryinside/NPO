"use client";

import { useEffect, useRef, useState } from "react";

/**
 * G-D182: admin 헤더 알림 벨 + 드롭다운.
 *
 * 60초 간격으로 /api/admin/notifications 폴링 (unread 우선).
 * 실시간 푸시(WebSocket/SSE)는 후속 개선.
 */
type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const r = await fetch("/api/admin/notifications/unread-count", {
          cache: "no-store",
        });
        if (!r.ok) return;
        const d = (await r.json()) as { count?: number };
        if (!cancelled) setUnread(d.count ?? 0);
      } catch {
        // no-op
      }
    }
    fetchCount();
    const t = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!r.ok) return;
        const data = (await r.json()) as Notif[] | { items?: Notif[] };
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : (data.items ?? []);
        setItems(arr.slice(0, 8));
      } catch {
        // no-op
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function markRead(id: string) {
    try {
      await fetch(`/api/admin/notifications/${id}/read`, { method: "PATCH" });
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnread((c) => Math.max(0, c - 1));
    } catch {
      // no-op
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="알림"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg transition-opacity hover:opacity-80"
        style={{ color: "var(--muted-foreground)" }}
      >
        <span style={{ fontSize: 18 }}>🔔</span>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: "var(--negative)" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl shadow-lg"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="px-4 py-3 text-sm font-semibold"
            style={{
              color: "var(--text)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            알림 {unread > 0 ? `(${unread})` : ""}
          </div>
          {items.length === 0 ? (
            <p
              className="p-6 text-center text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              새 알림이 없습니다.
            </p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.map((n) => (
                <li
                  key={n.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.link) window.location.href = n.link;
                    }}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <p
                      className="text-sm font-medium"
                      style={{
                        color: n.read ? "var(--muted-foreground)" : "var(--text)",
                      }}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p
                        className="mt-0.5 truncate text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {n.body}
                      </p>
                    )}
                    <p
                      className="mt-1 text-[11px]"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {new Date(n.created_at).toLocaleString("ko-KR", {
                        timeZone: "Asia/Seoul",
                      })}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <a
            href="/admin/notifications"
            className="block border-t px-4 py-2 text-center text-xs font-medium"
            style={{
              borderColor: "var(--border)",
              color: "var(--accent)",
              textDecoration: "none",
            }}
          >
            전체 보기 →
          </a>
        </div>
      )}
    </div>
  );
}
