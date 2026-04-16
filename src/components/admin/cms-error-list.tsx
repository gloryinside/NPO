"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import type { PaymentWithRelations } from "@/types/payment";

type Props = {
  payments: PaymentWithRelations[];
  total: number;
};

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}
function formatDate(v: string | null) {
  if (!v) return "-";
  return v.slice(0, 10).replace(/-/g, ".");
}

export function CmsErrorList({ payments, total }: Props) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const retryOrMarkPaid = useCallback(
    async (id: string, action: "retry" | "paid") => {
      const label = action === "paid" ? "수기 납부완료 처리" : "재출금 예약";
      if (!confirm(`${label}하시겠습니까?`)) return;
      setProcessing(id);
      try {
        const body =
          action === "paid"
            ? { pay_status: "paid", deposit_date: new Date().toISOString().slice(0, 10) }
            : { pay_status: "unpaid" }; // 재출금은 unpaid로 초기화 → cron이 재처리
        const res = await fetch(`/api/admin/payments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const d = await res.json();
          alert(d.error ?? "처리 실패");
          return;
        }
        router.refresh();
      } finally {
        setProcessing(null);
      }
    },
    [router]
  );

  async function bulkMarkPaid() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 수기 납부완료 처리하시겠습니까?`)) return;
    for (const id of Array.from(selected)) {
      await fetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay_status: "paid", deposit_date: new Date().toISOString().slice(0, 10) }),
      });
    }
    setSelected(new Set());
    router.refresh();
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(selected.size === payments.length ? new Set() : new Set(payments.map((p) => p.id)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            CMS 출금 오류
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            CMS 자동이체 실패·미납 건을 관리합니다. 재출금 또는 수기 납부 처리할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold" style={{ color: "var(--negative)" }}>
            {total.toLocaleString("ko-KR")}건
          </span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {formatKRW(totalAmount)}
          </span>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={bulkMarkPaid}
            className="rounded-md px-3 py-1.5 text-sm font-medium"
            style={{ background: "var(--positive)", color: "#fff" }}
          >
            선택 {selected.size}건 납부완료 처리
          </button>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <th className="px-4 py-3 w-10">
                <input type="checkbox"
                  checked={payments.length > 0 && selected.size === payments.length}
                  onChange={toggleAll} className="h-3.5 w-3.5" />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>후원자</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>캠페인</th>
              <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>상태</th>
              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>금액</th>
              <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>출금일</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>실패 사유</th>
              <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: "var(--muted-foreground)" }}>처리</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-sm" style={{ color: "var(--positive)" }}>
                  ✓ CMS 출금 오류 건이 없습니다.
                </td>
              </tr>
            ) : (
              payments.map((p, idx) => {
                const isFailed = p.pay_status === "failed";
                const isSelected = selected.has(p.id);
                const isProcessing = processing === p.id;
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                      background: isSelected ? "rgba(124,58,237,0.06)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={isSelected}
                        onChange={() => toggleSelect(p.id)} className="h-3.5 w-3.5" />
                    </td>
                    <td className="px-4 py-3">
                      <a href={`/admin/members/${p.member_id}`}
                        className="font-medium hover:underline" style={{ color: "var(--text)" }}>
                        {p.members?.name ?? "-"}
                      </a>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {p.members?.member_code ?? ""}
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>
                      {p.campaigns?.title ?? "일반 후원"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge
                        className="border-0 text-xs font-medium"
                        style={isFailed
                          ? { background: "rgba(239,68,68,0.15)", color: "var(--negative)" }
                          : { background: "rgba(245,158,11,0.15)", color: "var(--warning)" }}
                      >
                        {isFailed ? "실패" : "미납"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--negative)" }}>
                      {formatKRW(Number(p.amount ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {formatDate(p.pay_date)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: "var(--muted-foreground)" }}
                      title={p.fail_reason ?? undefined}>
                      {p.fail_reason ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button type="button" disabled={isProcessing}
                          onClick={() => retryOrMarkPaid(p.id, "retry")}
                          className="rounded border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                          style={{ borderColor: "var(--info, #38bdf8)", color: "var(--info, #38bdf8)", background: "rgba(56,189,248,0.08)" }}>
                          재출금
                        </button>
                        <button type="button" disabled={isProcessing}
                          onClick={() => retryOrMarkPaid(p.id, "paid")}
                          className="rounded border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                          style={{ borderColor: "var(--positive)", color: "var(--positive)", background: "rgba(34,197,94,0.08)" }}>
                          납부완료
                        </button>
                      </div>
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
