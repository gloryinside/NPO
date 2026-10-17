"use client";

import { useState, useCallback, useTransition } from "react";

export type IncomeStatus = "pending" | "processing" | "confirmed" | "excluded";

export interface ReconcileRow {
  id: string;
  pay_date: string | null;
  amount: number;
  income_status: IncomeStatus;
  pay_method: string | null;
  member_name: string | null;
  member_code: string | null;
  campaign_title: string | null;
}

interface Props {
  initialRows: ReconcileRow[];
  isSuper: boolean;
}

const STATUS_LABEL: Record<IncomeStatus, string> = {
  pending: "대기",
  processing: "진행",
  confirmed: "완료",
  excluded: "제외",
};

const STATUS_CLASS: Record<IncomeStatus, string> = {
  pending: "bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] text-[var(--warning)]",
  processing: "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)]",
  confirmed: "bg-[color-mix(in_srgb,#22c55e_15%,transparent)] text-[#22c55e]",
  excluded: "bg-[color-mix(in_srgb,var(--muted-foreground)_15%,transparent)] text-[var(--muted-foreground)]",
};

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }).format(n);
}

export function ReconcileClient({ initialRows, isSuper }: Props) {
  const [rows, setRows] = useState<ReconcileRow[]>(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<IncomeStatus>>(
    new Set(["pending", "processing"])
  );
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [dropdownId, setDropdownId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleStatus = (s: IncomeStatus) => {
    setFilterStatuses((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
    setSelected(new Set());
  };

  const filtered = rows.filter((r) => {
    if (!filterStatuses.has(r.income_status)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (r.member_name ?? "").toLowerCase().includes(q) ||
        (r.member_code ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const applyStatus = useCallback(
    async (ids: string[], target: IncomeStatus) => {
      const res = await fetch("/api/admin/erp/reconcile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_ids: ids, target_status: target }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "오류가 발생했습니다.", false);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          ids.includes(r.id) ? { ...r, income_status: target } : r
        )
      );
      setSelected(new Set());
      setDropdownId(null);
      showToast(`${json.updated}건 → ${STATUS_LABEL[target]} 변경 완료`);
    },
    []
  );

  const batchApply = (target: IncomeStatus) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    startTransition(() => { applyStatus(ids, target); });
  };

  const singleApply = (id: string, target: IncomeStatus) => {
    startTransition(() => { applyStatus([id], target); });
  };

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.ok
              ? "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(["pending", "processing", "confirmed", "excluded"] as IncomeStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterStatuses.has(s)
                  ? STATUS_CLASS[s]
                  : "border border-[var(--border)] text-[var(--muted-foreground)]"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="후원자명 또는 코드 검색"
          className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              <th className="px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-medium">납입일</th>
              <th className="px-4 py-3 text-left font-medium">후원자</th>
              <th className="px-4 py-3 text-left font-medium">캠페인</th>
              <th className="px-4 py-3 text-right font-medium">금액</th>
              <th className="px-4 py-3 text-left font-medium">회계 반영</th>
              <th className="px-4 py-3 text-left font-medium">결제수단</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-[var(--muted-foreground)]">
                  해당 조건의 납입 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          next.has(row.id) ? next.delete(row.id) : next.add(row.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-[var(--text)]">
                    {row.pay_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--text)]">{row.member_name ?? "—"}</p>
                    {row.member_code && (
                      <p className="text-xs text-[var(--muted-foreground)]">{row.member_code}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {row.campaign_title ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text)]">
                    {formatKRW(row.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.income_status]}`}>
                      {STATUS_LABEL[row.income_status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {row.pay_method ?? "—"}
                  </td>
                  <td className="relative px-4 py-3 text-right">
                    <button
                      onClick={() => setDropdownId(dropdownId === row.id ? null : row.id)}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--text)]"
                    >
                      ···
                    </button>
                    {dropdownId === row.id && (
                      <div className="absolute right-4 top-10 z-20 w-36 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
                        {(["processing", "confirmed", "excluded"] as IncomeStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => singleApply(row.id, s)}
                            disabled={row.income_status === s || isPending}
                            className="block w-full px-4 py-2 text-left text-xs text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                          >
                            → {STATUS_LABEL[s]}
                          </button>
                        ))}
                        {isSuper && (
                          <button
                            onClick={() => singleApply(row.id, "pending")}
                            disabled={row.income_status === "pending" || isPending}
                            className="block w-full px-4 py-2 text-left text-xs text-[var(--warning)] hover:bg-[var(--surface-2)] disabled:opacity-40"
                          >
                            ↩ 되돌리기
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-6 py-3 shadow-xl">
          <span className="text-sm font-medium text-[var(--text)]">
            {selected.size}건 선택됨
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => batchApply("processing")}
              disabled={isPending}
              className="rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              수입진행으로
            </button>
            <button
              onClick={() => batchApply("confirmed")}
              disabled={isPending}
              className="rounded-lg bg-[#22c55e] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              수입완료로
            </button>
            <button
              onClick={() => batchApply("excluded")}
              disabled={isPending}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:text-[var(--text)] disabled:opacity-50"
            >
              수입제외로
            </button>
            {isSuper && (
              <button
                onClick={() => batchApply("pending")}
                disabled={isPending}
                className="rounded-lg border border-[var(--warning)] px-3 py-1.5 text-xs font-medium text-[var(--warning)] transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                ↩ 되돌리기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
