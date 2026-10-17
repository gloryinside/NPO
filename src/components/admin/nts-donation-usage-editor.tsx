"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ORG_CATEGORIES, checkForm, totals, type Nts637Form } from "@/lib/disclosure/nts-63-7";
import { formatKRW } from "@/lib/format";

/**
 * 연간 기부금 모금액 및 활용실적 명세서(법인세법 시행규칙 별지 제63호의7서식) 작성 화면.
 * 시스템 기록으로 채운 초안을 고쳐 저장하고, 서식 그대로 PDF로 내려받는다.
 */

type Col<R> = { key: keyof R & string; label: string; type: "text" | "number" | "month"; width?: string };

function RowsEditor<R extends Record<string, unknown>>({
  title, cols, rows, onChange, empty, makeRow,
}: {
  title: string;
  cols: Col<R>[];
  rows: R[];
  onChange: (rows: R[]) => void;
  empty: string;
  makeRow: () => R;
}) {
  const set = (i: number, key: string, v: string, type: Col<R>["type"]) => {
    const n = [...rows];
    n[i] = { ...n[i]!, [key]: type === "number" ? (v === "" ? null : Number(v.replace(/[^0-9-]/g, ""))) : v };
    onChange(n);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--text)]">{title}</p>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--muted-foreground)]">
            <tr>
              {cols.map((c) => <th key={c.key} className="px-2 py-1.5" style={{ width: c.width }}>{c.label}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length + 1} className="px-2 py-3 text-center text-xs text-[var(--muted-foreground)]">{empty}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-[var(--border)]">
                {cols.map((c) => (
                  <td key={c.key} className="px-1 py-1">
                    <input
                      aria-label={`${c.label} ${i + 1}행`}
                      type={c.type === "month" ? "month" : "text"}
                      inputMode={c.type === "number" ? "numeric" : undefined}
                      value={r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key])}
                      onChange={(e) => set(i, c.key, e.target.value, c.type)}
                      className={`h-8 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 ${c.type === "number" ? "text-right tabular-nums" : ""}`}
                    />
                  </td>
                ))}
                <td className="px-1 text-center">
                  <button type="button" aria-label={`${i + 1}행 삭제`} onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-[var(--negative)]">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...rows, makeRow()])} className="rounded border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-2)]">+ 줄 추가</button>
    </div>
  );
}

export function NtsDonationUsageEditor({ defaultYear, canSave }: { defaultYear: number; canSave: boolean }) {
  const [year, setYear] = useState(defaultYear);
  const [form, setForm] = useState<Nts637Form | null>(null);
  const [saved, setSaved] = useState<{ at: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (fresh = false) => {
    setForm(null);
    const res = await fetch(`/api/admin/disclosures/nts-63-7?year=${year}${fresh ? "&fresh=1" : ""}`);
    const data = (await res.json().catch(() => ({}))) as { form?: Nts637Form; saved?: boolean; updatedAt?: string | null; error?: string };
    if (!res.ok || !data.form) return void toast.error(data.error ?? "불러오지 못했습니다.");
    setForm(data.form);
    setSaved(data.saved ? { at: data.updatedAt ?? null } : null);
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!form) return;
    setBusy(true);
    const res = await fetch("/api/admin/disclosures/nts-63-7", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, form }),
    });
    const data = (await res.json().catch(() => ({}))) as { form?: Nts637Form; error?: string };
    setBusy(false);
    if (!res.ok || !data.form) return void toast.error(data.error ?? "저장하지 못했습니다.");
    setForm(data.form);
    setSaved({ at: new Date().toISOString() });
    toast.success("저장했습니다");
  }

  const t = form ? totals(form) : null;
  // 잔액은 전기이월에서 월마다 누적(작성방법 2)
  const withBalance = form
    ? form.months.reduce<{ rows: Nts637Form["months"]; bal: number }>(
        (acc, m) => {
          const bal = acc.bal + m.income - m.expense;
          return { rows: [...acc.rows, { ...m, balance: bal }], bal };
        },
        { rows: [], bal: form.carriedIn },
      ).rows
    : [];
  const warnings = form ? checkForm({ ...form, months: withBalance }) : [];
  const setBasic = (k: keyof Nts637Form["basic"], v: string) => form && setForm({ ...form, basic: { ...form.basic, [k]: v } });
  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader
        title="기부금 모금액·활용실적 명세서"
        description="법인세법 시행규칙 별지 제63호의7서식(2022. 3. 18. 개정). 받은 후원금과 사업 집행 내역으로 초안을 채웠습니다. 고쳐서 저장한 뒤 PDF로 내려받아 공개하세요."
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-[var(--text)]">
          사업연도
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="ml-2 h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
            {Array.from({ length: 6 }, (_, i) => thisYear - i).map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
        </label>
        <span className="text-xs text-[var(--muted-foreground)]">
          {saved ? `저장한 작성본${saved.at ? ` · ${new Date(saved.at).toLocaleString("ko-KR")}` : ""}` : "아직 저장하지 않은 초안"}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => load(true)} disabled={!form}>기록으로 다시 채우기</Button>
          <a href={`/api/admin/disclosures/nts-63-7/pdf?year=${year}`}
            className="inline-flex h-9 items-center rounded-md border border-[var(--border)] px-3 text-sm text-[var(--text)] hover:bg-[var(--surface-2)]">
            PDF 내려받기{saved ? "" : "(초안)"}
          </a>
          {canSave && <Button onClick={save} loading={busy} disabled={!form}>저장</Button>}
        </div>
      </div>
      {!canSave && <p className="text-xs text-[var(--muted-foreground)]">저장은 회계 담당자만 할 수 있습니다.</p>}

      {!form ? (
        <p className="text-sm text-[var(--muted-foreground)]">불러오는 중…</p>
      ) : (
        <>
          {warnings.length > 0 && (
            <ul role="status" className="list-disc space-y-1 rounded-lg border border-[var(--warning)] bg-[var(--warning-soft)] py-3 pl-8 pr-4 text-sm text-[var(--text)]">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}

          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">1. 기본사항</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {([
                ["orgName", "① 법인명"], ["businessNo", "② 사업자등록번호(고유번호)"], ["representative", "③ 대표자 성명"],
              ] as const).map(([k, l]) => (
                <label key={k} className="text-sm text-[var(--text)]">{l}<Input value={form.basic[k]} onChange={(e) => setBasic(k, e.target.value)} className="mt-1" /></label>
              ))}
              <label className="text-sm text-[var(--text)]">④ 공익법인등 구분
                <select value={form.basic.orgCategory} onChange={(e) => setBasic("orgCategory", e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm">
                  <option value="">골라 주세요</option>
                  {ORG_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              {([
                ["email", "⑤ 전자우편주소"], ["fiscalYear", "⑥ 사업연도"], ["phone", "⑦ 전화번호"], ["designatedAt", "⑧ 공익법인등 지정일"],
              ] as const).map(([k, l]) => (
                <label key={k} className="text-sm text-[var(--text)]">{l}<Input value={form.basic[k]} onChange={(e) => setBasic(k, e.target.value)} className="mt-1" placeholder={k === "designatedAt" ? "예: 2015-06-19" : undefined} /></label>
              ))}
              <label className="text-sm text-[var(--text)] sm:col-span-2">⑨ 소재지<Input value={form.basic.address} onChange={(e) => setBasic("address", e.target.value)} className="mt-1" /></label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">2. 기부금의 수입·지출 명세</h2>
            <label className="text-sm text-[var(--text)]">전기이월 잔액(원)
              <Input inputMode="numeric" value={String(form.carriedIn)} onChange={(e) => setForm({ ...form, carriedIn: Number(e.target.value.replace(/[^0-9-]/g, "")) || 0 })} className="mt-1 w-48 text-right tabular-nums" />
            </label>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-[var(--surface-2)] text-left text-xs text-[var(--muted-foreground)]">
                  <tr><th className="px-2 py-1.5">⑩ 월별</th><th className="px-2 py-1.5 text-right">⑪ 수입</th><th className="px-2 py-1.5 text-right">⑫ 지출</th><th className="px-2 py-1.5 text-right">⑬ 잔액</th></tr>
                </thead>
                <tbody>
                  {withBalance.map((m, i) => (
                    <tr key={m.month} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">{Number(m.month.slice(5))}월</td>
                      {(["income", "expense"] as const).map((k) => (
                        <td key={k} className="px-1 py-1">
                          <input aria-label={`${Number(m.month.slice(5))}월 ${k === "income" ? "수입" : "지출"}`} inputMode="numeric" value={String(m[k])}
                            onChange={(e) => {
                              const months = [...form.months];
                              months[i] = { ...months[i]!, [k]: Number(e.target.value.replace(/[^0-9-]/g, "")) || 0 };
                              setForm({ ...form, months });
                            }}
                            className="h-8 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-right tabular-nums" />
                        </td>
                      ))}
                      <td className="px-2 py-1 text-right tabular-nums">{formatKRW(m.balance)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--border)] font-semibold">
                    <td className="px-2 py-1.5">합계</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatKRW(t!.income)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatKRW(t!.expense)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">차기이월 {formatKRW(t!.carriedOut)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">3. 기부금 지출 명세서(국내사업)</h2>
            <p className="text-xs text-[var(--muted-foreground)]">지출월별·지급목적별로 적습니다. 연도별 표에는 1개 단체에 연간 100만원 이상 준 경우 그 단체를 따로 적고, 수혜인원은 연간 실제 인원을 적습니다.</p>
            <RowsEditor
              title="지출월별"
              cols={[{ key: "month", label: "⑭ 지출월", type: "month", width: "140px" }, { key: "purpose", label: "⑮ 지급목적", type: "text" }, { key: "count", label: "⑯ 지급건수", type: "number", width: "90px" }, { key: "payee", label: "⑰ 대표 지급처명", type: "text" }, { key: "amount", label: "⑱ 금액", type: "number", width: "140px" }]}
              rows={form.domesticByMonth}
              onChange={(rows) => setForm({ ...form, domesticByMonth: rows })}
              empty="그해 사업 집행 내역이 없습니다."
              makeRow={() => ({ month: `${year}-01`, purpose: "", count: 1, payee: "", amount: 0 })}
            />
            <RowsEditor
              title="연도별"
              cols={[{ key: "year", label: "⑲ 연도별", type: "text", width: "80px" }, { key: "purpose", label: "⑳ 지급목적", type: "text" }, { key: "beneficiaries", label: "㉑ 수혜인원", type: "number", width: "90px" }, { key: "payee", label: "㉒ 대표 지급처명", type: "text" }, { key: "amount", label: "㉓ 금액", type: "number", width: "140px" }]}
              rows={form.domesticByYear}
              onChange={(rows) => setForm({ ...form, domesticByYear: rows })}
              empty="연도별 지출이 없습니다."
              makeRow={() => ({ year: String(year), purpose: "", beneficiaries: null, payee: "", amount: 0 })}
            />
            <p className="text-right text-sm text-[var(--text)]">합계 수혜인원 {t!.domesticPeople.toLocaleString("ko-KR")}명 · {formatKRW(t!.domestic)}</p>
          </section>

          <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)]">4. 기부금 지출 명세서(국외사업)</h2>
            <p className="text-xs text-[var(--muted-foreground)]">국외사업이 있는 경우만 국가별로 적습니다.</p>
            <RowsEditor
              title="지출월별"
              cols={[{ key: "month", label: "㉔ 지출월", type: "month", width: "140px" }, { key: "country", label: "㉕ 국가명", type: "text", width: "110px" }, { key: "purpose", label: "㉖ 지급목적", type: "text" }, { key: "count", label: "㉗ 지급건수", type: "number", width: "90px" }, { key: "payee", label: "㉘ 대표 지급처명", type: "text" }, { key: "amount", label: "㉙ 금액", type: "number", width: "130px" }]}
              rows={form.overseasByMonth}
              onChange={(rows) => setForm({ ...form, overseasByMonth: rows })}
              empty="국외사업이 없으면 비워 두세요."
              makeRow={() => ({ month: `${year}-01`, country: "", purpose: "", count: 1, payee: "", amount: 0 })}
            />
            <RowsEditor
              title="연도별"
              cols={[{ key: "year", label: "㉚ 연도별", type: "text", width: "80px" }, { key: "country", label: "㉛ 국가명", type: "text", width: "110px" }, { key: "purpose", label: "㉜ 지급목적", type: "text" }, { key: "beneficiaries", label: "㉝ 수혜인원", type: "number", width: "90px" }, { key: "payee", label: "㉞ 대표 지급처명", type: "text" }, { key: "amount", label: "㉟ 금액", type: "number", width: "130px" }]}
              rows={form.overseasByYear}
              onChange={(rows) => setForm({ ...form, overseasByYear: rows })}
              empty="국외사업이 없으면 비워 두세요."
              makeRow={() => ({ year: String(year), country: "", purpose: "", beneficiaries: null, payee: "", amount: 0 })}
            />
          </section>

          <section className="grid grid-cols-1 gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2">
            <label className="text-sm text-[var(--text)]">공개일<Input type="date" value={form.submittedOn} onChange={(e) => setForm({ ...form, submittedOn: e.target.value })} className="mt-1" /></label>
            <label className="text-sm text-[var(--text)]">제출인<Input value={form.submitter} onChange={(e) => setForm({ ...form, submitter: e.target.value })} className="mt-1" /></label>
            <p className="text-xs text-[var(--muted-foreground)] sm:col-span-2">PDF에는 직인 자리가 비어 있습니다. 출력해 직인을 찍거나 전자 직인을 넣어 공개하세요.</p>
          </section>
        </>
      )}
    </div>
  );
}
