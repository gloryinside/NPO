"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentWithRelations } from "@/types/payment";

type Props = {
  payments: PaymentWithRelations[];
  total: number;
  initialQ: string;
};

function formatKRW(n: number) {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}
function formatDate(v: string | null) {
  if (!v) return "-";
  return v.slice(0, 10).replace(/-/g, ".");
}

const STATUS_BADGE: Record<string, { label: string; style: React.CSSProperties }> = {
  unpaid: {
    label: "미납",
    style: { background: "var(--warning-soft)", color: "var(--warning)" },
  },
  failed: {
    label: "실패",
    style: { background: "var(--negative-soft)", color: "var(--negative)" },
  },
};

export function UnpaidList({ payments, total, initialQ }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [isPending, startTransition] = useTransition();
  const [processing, setProcessing] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const totalAmount = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (q.trim()) params.set("q", q.trim());
    else params.delete("q");
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const markPaid = useCallback(
    async (id: string) => {
      if (!confirm("해당 건을 수기로 납부완료 처리하시겠습니까?")) return;
      setProcessing(id);
      try {
        const res = await fetch(`/api/admin/payments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pay_status: "paid", deposit_date: new Date().toISOString().slice(0, 10) }),
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

  async function markSelectedPaid() {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}건을 납부완료 처리하시겠습니까?`)) return;
    const ids = Array.from(selected);
    for (const id of ids) {
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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === payments.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(payments.map((p) => p.id)));
    }
  }

  const surface = { background: "var(--surface)", borderColor: "var(--border)" };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
            미납 관리
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            미납·실패 건을 확인하고 수기 납부 처리하세요.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-semibold" style={{ color: "var(--negative)" }}>
            총 {total.toLocaleString("ko-KR")}건
          </span>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            미납 금액 {formatKRW(totalAmount)}
          </span>
        </div>
      </div>

      {/* 검색 + 일괄처리 */}
      <div className="flex flex-wrap gap-2 items-center">
        <form onSubmit={search} className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="후원자명 검색"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text)" }}
          />
          <Button type="submit" disabled={isPending}
            style={{ background: "var(--accent)", color: "#fff" }}>
            검색
          </Button>
        </form>
        {selected.size > 0 && (
          <Button
            onClick={markSelectedPaid}
            style={{ background: "var(--positive)", color: "#fff" }}
          >
            선택 {selected.size}건 납부완료 처리
          </Button>
        )}
      </div>

      {/* 목록 */}
      <div className="rounded-lg border overflow-hidden" style={surface}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={payments.length > 0 && selected.size === payments.length}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5"
                />
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>후원자</th>
              <th className="text-left px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>캠페인</th>
              <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>상태</th>
              <th className="text-right px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>금액</th>
              <th className="text-center px-4 py-3 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>납입 예정일</th>
              <th className="px-4 py-3 text-xs font-medium text-right" style={{ color: "var(--muted-foreground)" }}>처리</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-sm" style={{ color: "var(--positive)" }}>
                  ✓ 미납·실패 건이 없습니다.
                </td>
              </tr>
            ) : (
              payments.map((p, idx) => {
                const badge = STATUS_BADGE[p.pay_status] ?? STATUS_BADGE.unpaid;
                const isProcessing = processing === p.id;
                const isSelected = selected.has(p.id);
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
                      background: isSelected ? "rgba(124,58,237,0.06)" : undefined,
                    }}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/members/${p.member_id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--text)" }}
                      >
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
                      <Badge style={badge.style} className="border-0 text-xs font-medium">
                        {badge.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "var(--negative)" }}>
                      {formatKRW(Number(p.amount ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {formatDate(p.pay_date)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => markPaid(p.id)}
                        className="rounded border px-2 py-1 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{
                          borderColor: "var(--positive)",
                          color: "var(--positive)",
                          background: "rgba(34,197,94,0.08)",
                        }}
                      >
                        {isProcessing ? "처리중..." : "납부완료"}
                      </button>
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
