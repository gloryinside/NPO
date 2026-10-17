"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PrivacyOfficer } from "@/lib/legal/default-templates";

/** 개인정보 보호책임자 지정 — 처리방침 12항에 공개된다 */
export function PrivacyOfficerForm({ initial, canEdit }: { initial: PrivacyOfficer | null; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ name: initial?.name ?? "", title: initial?.title ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "" });
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/settings/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ officer: v }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return void toast.error(data.error ?? "저장하지 못했습니다.");
    toast.success("보호책임자를 저장했습니다. 처리방침에 바로 반영됩니다.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end">
      {([["name", "이름"], ["title", "직책"], ["phone", "전화"], ["email", "이메일"]] as const).map(([k, l]) => (
        <label key={k} className="text-sm text-[var(--text)]">
          {l}
          <Input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} disabled={!canEdit} className="mt-1" required={k === "name"} />
        </label>
      ))}
      {canEdit ? (
        <div className="sm:col-span-4"><Button type="submit" loading={busy}>보호책임자 저장</Button></div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)] sm:col-span-4">최고 관리자만 바꿀 수 있습니다.</p>
      )}
    </form>
  );
}
