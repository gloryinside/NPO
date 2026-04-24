"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Badge } from "@/components/ui/badge";

interface SpendItem {
  year: number;
  month: number;
  amount: number;
  note: string | null;
  updated_at: string | null;
}

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(n);
}

export default function MarketingSpendPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<SpendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null); // month being saved
  const [editMonth, setEditMonth] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/marketing-spend?year=${year}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const byMonth = new Map(items.map((i) => [i.month, i]));
  const total = items.reduce((s, i) => s + i.amount, 0);

  function startEdit(month: number) {
    const existing = byMonth.get(month);
    setEditMonth(month);
    setEditAmount(existing ? String(existing.amount) : "");
    setEditNote(existing?.note ?? "");
  }

  async function save() {
    if (editMonth == null) return;
    const amount = Number(editAmount);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(editMonth);
    try {
      await fetch("/api/admin/marketing-spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month: editMonth, amount, note: editNote || null }),
      });
      setEditMonth(null);
      await load();
    } finally {
      setSaving(null);
    }
  }

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div>
      <PageHeader
        title="마케팅 지출 분석"
        description="월별 마케팅 비용을 입력하고 후원 유치 비용(CAC)을 추적합니다."
      />

      {/* 연도 선택 */}
      <div className="mb-6 flex items-center gap-3">
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
        <Badge className="border-0 bg-[var(--accent-soft)] text-[var(--accent)]">
          연간 합계: {formatKRW(total)}
        </Badge>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--muted-foreground)]">불러오는 중…</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
                <th className="px-4 py-3 text-left font-medium">월</th>
                <th className="px-4 py-3 text-right font-medium">지출금액</th>
                <th className="px-4 py-3 text-left font-medium">비고</th>
                <th className="px-4 py-3 text-right font-medium">최종수정</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((label, idx) => {
                const month = idx + 1;
                const item = byMonth.get(month);
                const isEditing = editMonth === month;

                return (
                  <tr
                    key={month}
                    className={`border-t border-[var(--border)] ${isEditing ? "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text)]">{label}</td>

                    {isEditing ? (
                      <>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min={0}
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            placeholder="0"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-right text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-4 py-2" colSpan={2}>
                          <input
                            type="text"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            placeholder="비고 (선택)"
                            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={save}
                              disabled={saving === month}
                              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                            >
                              {saving === month ? "저장 중…" : "저장"}
                            </button>
                            <button
                              onClick={() => setEditMonth(null)}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--text)]"
                            >
                              취소
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">
                          {item ? formatKRW(item.amount) : <span className="text-[var(--muted-foreground)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[var(--muted-foreground)]">
                          {item?.note ?? ""}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[var(--muted-foreground)]">
                          {item?.updated_at
                            ? new Date(item.updated_at).toLocaleDateString("ko-KR")
                            : ""}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => startEdit(month)}
                            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            {item ? "수정" : "입력"}
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)] bg-[var(--surface-2)]">
                <td className="px-4 py-3 text-sm font-semibold text-[var(--text)]">합계</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-[var(--text)]">
                  {formatKRW(total)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
