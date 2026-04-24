"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDonorT } from "@/lib/i18n/use-donor-t";

type LoginRecord = {
  id: string;
  created_at: string;
  ip: string | null;
  user_agent: string | null;
};

function parseUA(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (/mobile/i.test(ua)) return "Mobile";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  if (/edge/i.test(ua)) return "Edge";
  return "Browser";
}

export function SessionsCard() {
  const t = useDonorT();
  const [records, setRecords] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/donor/account/sessions");
      if (!res.ok) return;
      const data = await res.json();
      setRecords(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function signOutAll() {
    if (!confirm(t("donor.sessions.confirm_signout_all"))) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
      window.location.href = "/donor/login";
    } finally {
      setSigningOut(false);
    }
  }

  if (loading || records.length === 0) return null;

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--text)" }}>
            <span aria-hidden="true">🖥️</span> {t("donor.sessions.title")}
          </h3>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t("donor.sessions.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={signOutAll}
          disabled={signingOut}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--negative)" }}
        >
          {signingOut ? "…" : t("donor.sessions.signout_all")}
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-xs"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium" style={{ color: "var(--text)" }}>
                {parseUA(r.user_agent)}
                {r.ip && (
                  <span className="ml-1.5 font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {r.ip}
                  </span>
                )}
              </p>
              <p style={{ color: "var(--muted-foreground)" }}>
                {new Date(r.created_at).toLocaleString("ko-KR")}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
