"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKRW } from "@/lib/format";
import { MIN_CONVERSIONS, MIN_VIEWS, type VariantSettings } from "@/lib/ab/form-test";
import type { AbStats } from "@/lib/ab/form-test-data";

type Test = {
  id: string;
  name: string;
  status: "running" | "stopped";
  variants: VariantSettings[];
  startedAt: string;
  stoppedAt: string | null;
  campaignTitle: string | null;
  stats: AbStats;
};

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const presetsText = (v: VariantSettings) => (v.amountPresets.length ? v.amountPresets.map((n) => n.toLocaleString("ko-KR")).join(" · ") : "캠페인 설정 그대로");
const typeText = (v: VariantSettings) => (v.defaultType === "regular" ? "정기 먼저" : v.defaultType === "onetime" ? "일시 먼저" : "캠페인 설정 그대로");

function verdict(t: Test): string {
  const r = t.stats.result;
  if (!r.enoughData) return `아직 판단하기 이릅니다 — 안마다 ${MIN_VIEWS}명 이상 보고, 신청이 모두 ${MIN_CONVERSIONS * 2}건 이상 모이면 판정합니다.`;
  if (r.leader) return `${r.leader}안의 신청률이 의미 있게 높습니다(p=${r.pValue!.toFixed(3)}). ${r.leader}안을 캠페인 금액 버튼으로 적용하는 것을 권합니다.`;
  return `두 안의 신청률 차이가 우연일 수 있습니다(p=${r.pValue!.toFixed(3)}). 더 모으거나 차이가 큰 안으로 다시 비교해 보세요.`;
}

/** 후원 신청 화면 A/B 비교 — 금액 버튼·기본 후원 유형을 두 안으로 나눠 신청률을 비교한다 */
export function AbTestBoard({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [tests, setTests] = useState<Test[] | null>(null);
  const [form, setForm] = useState({ campaignId: campaigns[0]?.id ?? "", name: "", presetsB: "", typeB: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/ab-tests");
    const data = (await res.json().catch(() => ({}))) as { items?: Test[] };
    setTests(data.items ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const presets = form.presetsB.split(/[,\s·]+/).map((x) => Number(x.replace(/[^0-9]/g, ""))).filter((n) => n > 0);
    const res = await fetch("/api/admin/ab-tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: form.campaignId,
        name: form.name,
        variants: [
          { amountPresets: [], defaultType: null },
          { amountPresets: presets, defaultType: form.typeB || null },
        ],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return void toast.error(data.error ?? "시작하지 못했습니다.");
    toast.success("비교를 시작했습니다. 방문자의 절반은 B안을 봅니다.");
    setForm({ ...form, name: "", presetsB: "", typeB: "" });
    void load();
  }

  async function stop(t: Test) {
    const res = await fetch(`/api/admin/ab-tests/${t.id}`, { method: "DELETE" });
    if (!res.ok) return void toast.error("끝내지 못했습니다.");
    toast.success("비교를 끝냈습니다. 신청 화면은 캠페인 설정으로 돌아갑니다.");
    void load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="신청 화면 A/B 비교"
        description="캠페인 후원 신청 화면의 금액 버튼과 먼저 보이는 후원 유형을 두 안으로 나눠, 어느 쪽이 더 많이 신청받는지 비교합니다. 방문자는 반씩 나뉘고 같은 사람은 늘 같은 안을 봅니다."
      />

      <form onSubmit={start} className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2">
        <label className="text-sm text-[var(--text)]">캠페인
          <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} required
            className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </label>
        <label className="text-sm text-[var(--text)]">비교 이름<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={60} className="mt-1" placeholder="예: 소액 버튼 추가" /></label>
        <p className="text-sm text-[var(--muted-foreground)] sm:col-span-2">A안은 지금 캠페인 설정 그대로입니다. B안에서 바꿔 볼 것을 정하세요.</p>
        <label className="text-sm text-[var(--text)]">B안 금액 버튼(원, 쉼표로 2~6개)<Input value={form.presetsB} onChange={(e) => setForm({ ...form, presetsB: e.target.value })} className="mt-1" placeholder="5000, 10000, 20000, 30000" /></label>
        <label className="text-sm text-[var(--text)]">B안에서 먼저 보일 후원 유형
          <select value={form.typeB} onChange={(e) => setForm({ ...form, typeB: e.target.value })}
            className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            <option value="">캠페인 설정 그대로</option>
            <option value="regular">정기후원 먼저</option>
            <option value="onetime">일시후원 먼저</option>
          </select>
        </label>
        <div className="sm:col-span-2"><Button type="submit" loading={busy} disabled={campaigns.length === 0}>비교 시작</Button></div>
      </form>

      {tests === null ? (
        <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
      ) : tests.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">아직 비교한 적이 없습니다.</p>
      ) : (
        tests.map((t) => (
          <section key={t.id} className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text)]">{t.name}</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t.campaignTitle ?? "-"} · {new Date(t.startedAt).toLocaleDateString("ko-KR")}부터
                  {t.status === "running" ? " · 진행 중" : ` · ${t.stoppedAt ? new Date(t.stoppedAt).toLocaleDateString("ko-KR") : ""} 종료`}
                </p>
              </div>
              {t.status === "running" && <Button variant="outline" size="sm" onClick={() => stop(t)}>비교 끝내기</Button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-[var(--muted-foreground)]">
                  <tr><th className="py-1.5">안</th><th>금액 버튼</th><th>먼저 보이는 유형</th><th className="text-right">본 사람</th><th className="text-right">신청</th><th className="text-right">신청률</th><th className="text-right">일시 평균</th><th className="text-right">정기 월평균</th></tr>
                </thead>
                <tbody>
                  {t.variants.map((v) => {
                    const s = t.stats[v.key];
                    const conv = s.onetime + s.regular;
                    return (
                      <tr key={v.key} className={`border-t border-[var(--border)] ${t.stats.result.leader === v.key ? "font-semibold" : ""}`}>
                        <td className="py-1.5">{v.key}{t.stats.result.leader === v.key && " ✓"}</td>
                        <td>{presetsText(v)}</td>
                        <td>{typeText(v)}</td>
                        <td className="text-right tabular-nums">{s.views.toLocaleString("ko-KR")}</td>
                        <td className="text-right tabular-nums">{conv.toLocaleString("ko-KR")} <span className="text-xs text-[var(--muted-foreground)]">(정기 {s.regular})</span></td>
                        <td className="text-right tabular-nums">{pct(t.stats.result.rate[v.key])}</td>
                        <td className="text-right tabular-nums">{s.onetime ? formatKRW(Math.round(s.onetimeAmount / s.onetime)) : "-"}</td>
                        <td className="text-right tabular-nums">{s.regular ? formatKRW(Math.round(s.regularMonthly / s.regular)) : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p role="status" className="text-sm text-[var(--text)]">{verdict(t)}</p>
          </section>
        ))
      )}
    </div>
  );
}
