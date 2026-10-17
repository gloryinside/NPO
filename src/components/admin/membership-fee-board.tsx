"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/layer";
import { formatKRW } from "@/lib/format";
import {
  FEE_CYCLES, FEE_CYCLE_LABEL, FEE_PAY_METHODS, FEE_PAY_METHOD_LABEL, FEE_STATUS_LABEL, LIFETIME_UNTIL,
  type FeeCycle, type FeeStatus,
} from "@/lib/membership/fees";

type Plan = { id: string; name: string; fee_amount: number; cycle: FeeCycle; active: boolean; description: string | null };
type Row = { id: string; name: string; memberCode: string | null; planId: string; paidUntil: string | null; status: FeeStatus };
type Found = { id: string; name: string; member_code: string | null; phone: string | null };

const STATUS_COLOR: Record<FeeStatus, string> = {
  paid: "text-[var(--positive)]",
  due_soon: "text-[var(--warning)]",
  overdue: "text-[var(--negative)]",
  unpaid: "text-[var(--negative)]",
};

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "처리하지 못했습니다.");
  return data;
}

/** 회비 — 회비 종류, 가입 회원의 납부 상태, 납부 기록 */
export function MembershipFeeBoard({ today, canRecord }: { today: string; canRecord: boolean }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<FeeStatus | "all">("all");
  const [newPlan, setNewPlan] = useState({ name: "", feeAmount: "", cycle: "annual" as FeeCycle });
  const [paying, setPaying] = useState<Row | null>(null);
  const [pay, setPay] = useState({ amount: "", paidDate: today, method: "transfer", notes: "" });
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [addPlanId, setAddPlanId] = useState("");

  const load = useCallback(async () => {
    const [p, m] = await Promise.all([
      fetch("/api/admin/membership-fee-plans").then((r) => r.json()).catch(() => ({})),
      fetch("/api/admin/membership-fees").then((r) => r.json()).catch(() => ({})),
    ]);
    setPlans((p as { items?: Plan[] }).items ?? []);
    setRows((m as { items?: Row[] }).items ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const counts = useMemo(() => {
    const c: Record<FeeStatus, number> = { paid: 0, due_soon: 0, overdue: 0, unpaid: 0 };
    for (const r of rows ?? []) c[r.status] += 1;
    return c;
  }, [rows]);
  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === filter);
  const activePlans = plans.filter((p) => p.active);

  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    try {
      await send("/api/admin/membership-fee-plans", "POST", { ...newPlan, feeAmount: Number(newPlan.feeAmount.replace(/\D/g, "")) });
      setNewPlan({ name: "", feeAmount: "", cycle: "annual" });
      toast.success("회비 종류를 추가했습니다");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function togglePlan(p: Plan) {
    try {
      await send(`/api/admin/membership-fee-plans/${p.id}`, "PATCH", { active: !p.active });
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const res = await fetch(`/api/admin/members?q=${encodeURIComponent(q.trim())}&limit=10`);
    const data = (await res.json().catch(() => ({}))) as { members?: Found[] };
    setFound(data.members ?? []);
  }

  async function assign(memberId: string, planId: string | null) {
    try {
      await send("/api/admin/membership-fees/assign", "POST", { memberId, planId });
      toast.success(planId ? "회비에 가입했습니다" : "회비를 해지했습니다");
      setAdding(false);
      setFound([]);
      setQ("");
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function openPay(r: Row) {
    setPaying(r);
    setPay({ amount: String(planById.get(r.planId)?.fee_amount ?? ""), paidDate: today, method: "transfer", notes: "" });
  }

  async function recordPay() {
    if (!paying) return;
    try {
      const data = (await send("/api/admin/membership-fees/payments", "POST", {
        memberId: paying.id, amount: Number(pay.amount.replace(/\D/g, "")), paidDate: pay.paidDate, method: pay.method, notes: pay.notes,
      })) as { period?: { start: string; end: string } };
      toast.success(`기록했습니다 (${data.period?.start} ~ ${data.period?.end === LIFETIME_UNTIL ? "평생" : data.period?.end})`);
      setPaying(null);
      void load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="회비"
        description="회원에게 받는 회비를 후원금과 따로 관리합니다. 회비는 기부금영수증 대상이 아닙니다. 낸 회비를 기록하면 납부 만료일이 주기만큼 늘어납니다."
        actions={activePlans.length > 0 ? <Button onClick={() => { setAddPlanId(activePlans[0]!.id); setAdding(true); }}>회원 가입시키기</Button> : undefined}
      />

      <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold text-[var(--text)]">회비 종류</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">아직 회비 종류가 없습니다. 아래에서 &lsquo;정회원 연회비&rsquo;처럼 만들어 주세요.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {plans.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className={p.active ? "text-[var(--text)]" : "text-[var(--muted-foreground)] line-through"}>
                  {p.name} · {FEE_CYCLE_LABEL[p.cycle]} {formatKRW(Number(p.fee_amount))}
                </span>
                <Button variant="outline" size="sm" onClick={() => togglePlan(p)}>{p.active ? "사용 중지" : "다시 사용"}</Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addPlan} className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-end">
          <label className="text-sm text-[var(--text)]">이름<Input value={newPlan.name} onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })} maxLength={40} required className="mt-1" placeholder="정회원 연회비" /></label>
          <label className="text-sm text-[var(--text)]">금액(원)<Input inputMode="numeric" value={newPlan.feeAmount} onChange={(e) => setNewPlan({ ...newPlan, feeAmount: e.target.value })} required className="mt-1 text-right tabular-nums" /></label>
          <label className="text-sm text-[var(--text)]">주기
            <select value={newPlan.cycle} onChange={(e) => setNewPlan({ ...newPlan, cycle: e.target.value as FeeCycle })} className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
              {FEE_CYCLES.map((c) => <option key={c} value={c}>{FEE_CYCLE_LABEL[c]}</option>)}
            </select>
          </label>
          <Button type="submit">회비 종류 추가</Button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="납부 상태로 거르기">
          {(["all", "overdue", "due_soon", "unpaid", "paid"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1 text-xs ${filter === s ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}>
              {s === "all" ? `전체 ${rows?.length ?? 0}` : `${FEE_STATUS_LABEL[s]} ${counts[s]}`}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--muted-foreground)]">
              <tr><th className="px-3 py-2">회원</th><th className="px-3 py-2">회비</th><th className="px-3 py-2">납부 만료일</th><th className="px-3 py-2">상태</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--muted-foreground)]">불러오는 중…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-[var(--muted-foreground)]">{rows.length === 0 ? "회비에 가입한 회원이 없습니다." : "이 상태의 회원이 없습니다."}</td></tr>
              ) : shown.map((r) => (
                <tr key={r.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2"><a href={`/admin/members/${r.id}`} className="text-[var(--accent)]">{r.name}</a> <span className="text-xs text-[var(--muted-foreground)]">{r.memberCode}</span></td>
                  <td className="px-3 py-2 text-[var(--muted-foreground)]">{planById.get(r.planId)?.name ?? "-"}</td>
                  <td className="px-3 py-2 tabular-nums">{r.paidUntil === LIFETIME_UNTIL ? "평생" : r.paidUntil ?? "-"}</td>
                  <td className={`px-3 py-2 text-xs font-medium ${STATUS_COLOR[r.status]}`}>{FEE_STATUS_LABEL[r.status]}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {canRecord && <Button size="sm" onClick={() => openPay(r)}>납부 기록</Button>}
                      <Button size="sm" variant="outline" onClick={() => assign(r.id, null)}>해지</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!canRecord && <p className="text-xs text-[var(--muted-foreground)]">납부 기록은 회계 담당자만 할 수 있습니다.</p>}
      </section>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`${paying?.name ?? ""} 회비 납부 기록`}
        footer={<><Button variant="outline" onClick={() => setPaying(null)}>취소</Button><Button onClick={recordPay}>기록</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-[var(--text)]">금액(원)<Input inputMode="numeric" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-1 text-right tabular-nums" /></label>
          <label className="text-sm text-[var(--text)]">낸 날짜<Input type="date" max={today} value={pay.paidDate} onChange={(e) => setPay({ ...pay, paidDate: e.target.value })} className="mt-1" /></label>
          <label className="text-sm text-[var(--text)]">방법
            <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
              {FEE_PAY_METHODS.map((m) => <option key={m} value={m}>{FEE_PAY_METHOD_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="text-sm text-[var(--text)]">메모<Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} maxLength={200} className="mt-1" /></label>
          <p className="text-xs text-[var(--muted-foreground)] sm:col-span-2">
            지금 만료일({paying?.paidUntil ?? "없음"}) 다음 날부터, 기간이 끊겼으면 낸 날부터 {paying ? FEE_CYCLE_LABEL[planById.get(paying.planId)?.cycle ?? "annual"] : ""} 한 주기만큼 늘어납니다.
          </p>
        </div>
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} title="회원 가입시키기">
        <div className="space-y-3">
          <label className="block text-sm text-[var(--text)]">회비 종류
            <select value={addPlanId} onChange={(e) => setAddPlanId(e.target.value)} className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
              {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name} ({formatKRW(Number(p.fee_amount))})</option>)}
            </select>
          </label>
          <form onSubmit={search} className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·연락처·이메일로 찾기" aria-label="회원 찾기" />
            <Button type="submit" variant="outline">찾기</Button>
          </form>
          <ul className="divide-y divide-[var(--border)]">
            {found.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{m.name} <span className="text-xs text-[var(--muted-foreground)]">{m.member_code} {m.phone}</span></span>
                <Button size="sm" onClick={() => assign(m.id, addPlanId)}>가입</Button>
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    </div>
  );
}
