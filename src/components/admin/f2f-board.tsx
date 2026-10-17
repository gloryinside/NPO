"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKRW } from "@/lib/format";

type Agent = {
  id: string;
  name: string;
  code: string;
  active: boolean;
  expiresAt: string;
  campaignTitle: string | null;
  signups: number;
  activeSignups: number;
  monthly: number;
};

/** 현장 모금(태블릿) — 모금가별 신청 링크 발급·중지와 실적 */
export function F2fBoard({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [form, setForm] = useState({ name: "", code: "", campaignId: campaigns[0]?.id ?? "", days: 30 });
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; url: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/f2f-agents");
    const data = (await res.json().catch(() => ({}))) as { items?: Agent[] };
    setAgents(data.items ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/f2f-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; path?: string };
    setBusy(false);
    if (!res.ok || !data.path) return void toast.error(data.error ?? "링크를 만들지 못했습니다.");
    setIssued({ name: form.name, url: `${window.location.origin}${data.path}` });
    setForm({ ...form, name: "", code: "" });
    void load();
  }

  async function stop(a: Agent) {
    const res = await fetch(`/api/admin/f2f-agents/${a.id}`, { method: "DELETE" });
    if (!res.ok) return void toast.error("중지하지 못했습니다.");
    toast.success(`${a.name} 링크를 중지했습니다`);
    void load();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크를 복사했습니다");
    } catch {
      toast.error("복사하지 못했습니다. 직접 선택해 복사해 주세요.");
    }
  }

  const now = Date.now();

  return (
    <div className="space-y-6">
      <PageHeader
        title="현장 모금(태블릿)"
        description="거리·행사장에서 모금가가 태블릿으로 정기후원 신청을 받습니다. 모금가마다 링크를 만들어 태블릿에서 여세요. 자동이체 신청은 그 자리에서 출금동의 서명을 받습니다."
      />

      <form onSubmit={create} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-5 sm:items-end">
        <label className="text-sm text-[var(--text)] sm:col-span-1">
          모금가 이름
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} required className="mt-1" />
        </label>
        <label className="text-sm text-[var(--text)]">
          코드 (영문·숫자)
          <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} pattern="[A-Za-z0-9_-]{2,20}" required className="mt-1" placeholder="예: SEOUL01" />
        </label>
        <label className="text-sm text-[var(--text)]">
          캠페인
          <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} required
            className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-sm text-[var(--text)]">
          사용 기간(일)
          <Input type="number" min={1} max={90} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} className="mt-1" />
        </label>
        <Button type="submit" loading={busy} disabled={campaigns.length === 0}>링크 만들기</Button>
        {campaigns.length === 0 && <p className="text-xs text-[var(--muted-foreground)] sm:col-span-5">진행 중인 캠페인이 있어야 링크를 만들 수 있습니다.</p>}
      </form>

      {issued && (
        <div role="status" className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] p-4 text-sm text-[var(--text)]">
          <p className="font-semibold">{issued.name} 님의 신청 링크</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">이 링크는 지금 한 번만 보여 드립니다. 태블릿에서 열어 두세요. 잃어버리면 중지하고 새로 만드세요.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded bg-[var(--surface)] px-2 py-1 text-xs">{issued.url}</code>
            <Button type="button" variant="outline" size="sm" onClick={() => copy(issued.url)}>복사</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2">모금가</th>
              <th className="px-3 py-2">캠페인</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2 text-right">신청</th>
              <th className="px-3 py-2 text-right">진행 중</th>
              <th className="px-3 py-2 text-right">월 약정액</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {agents === null ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--muted-foreground)]">불러오는 중…</td></tr>
            ) : agents.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-[var(--muted-foreground)]">아직 만든 링크가 없습니다. 위에서 모금가 링크를 만들어 보세요.</td></tr>
            ) : (
              agents.map((a) => {
                const live = a.active && new Date(a.expiresAt).getTime() > now;
                return (
                  <tr key={a.id} className="border-t border-[var(--border)]">
                    <td className="px-3 py-2 text-[var(--text)]">{a.name} <span className="text-xs text-[var(--muted-foreground)]">{a.code}</span></td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">{a.campaignTitle ?? "-"}</td>
                    <td className="px-3 py-2 text-xs">
                      {live ? (
                        <span className="text-[var(--positive)]">사용 중 · {new Date(a.expiresAt).toLocaleDateString("ko-KR")}까지</span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">{a.active ? "기간 끝남" : "중지됨"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.signups}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.activeSignups}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKRW(a.monthly)}</td>
                    <td className="px-3 py-2 text-right">
                      {live && <Button type="button" variant="outline" size="sm" onClick={() => stop(a)}>중지</Button>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
