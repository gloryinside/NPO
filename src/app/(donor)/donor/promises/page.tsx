"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { AmountChangeDialog } from "@/components/donor/promises/AmountChangeDialog";
import type { PromiseStatus, PromiseType } from "@/types/promise";

type CampaignRef = { id: string; title: string } | null;

type DonorPromise = {
  id: string;
  promise_code: string;
  status: PromiseStatus;
  type: PromiseType;
  amount: number | null;
  pay_day: number | null;
  started_at: string | null;
  ended_at: string | null;
  campaigns: CampaignRef;
};

const STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
  pending_billing: "결제수단 등록 대기",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

const STATUS_BADGE_CLS: Record<PromiseStatus, string> = {
  active: "bg-[var(--positive-soft)] text-[var(--positive)]",
  suspended: "bg-[var(--warning-soft)] text-[var(--warning)]",
  cancelled: "bg-[var(--negative-soft)] text-[var(--negative)]",
  completed: "bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]",
  pending_billing: "bg-[var(--warning-soft)] text-[var(--warning)]",
};

const STATUS_ORDER: PromiseStatus[] = [
  "active",
  "pending_billing",
  "suspended",
  "completed",
  "cancelled",
];

function formatAmount(value: number | null | undefined) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

type AmountDialogState = { open: true; promise: DonorPromise } | { open: false };

export default function DonorPromisesPage() {
  const [promises, setPromises] = useState<DonorPromise[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [amountDialog, setAmountDialog] = useState<AmountDialogState>({ open: false });

  const fetchPromises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/donor/promises");
      if (!res.ok) return;
      const data = await res.json();
      const all = (data.promises ?? []) as DonorPromise[];
      const sorted = [...all].sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
      );
      setPromises(sorted);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromises();
  }, [fetchPromises]);

  async function handleAction(id: string, action: "suspend" | "cancel" | "resume") {
    const label = action === "cancel" ? "해지" : action === "resume" ? "재개" : "일시중지";
    if (!confirm(`약정을 ${label}하시겠습니까?`)) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/donor/promises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        if (data.code === "BILLING_KEY_MISSING") {
          alert("결제 수단이 등록되지 않아 재개할 수 없습니다.\n관리자에게 카드 재등록을 요청해주세요.");
        } else {
          alert(data.error ?? "처리 중 오류가 발생했습니다.");
        }
        return;
      }
      await fetchPromises();
    } finally {
      setActioning(null);
    }
  }

  function openAmountDialog(p: DonorPromise) {
    setAmountDialog({ open: true, promise: p });
  }

  async function handleAmountSubmit(newAmount: number, reason: string | null) {
    if (!amountDialog.open) return;
    const id = amountDialog.promise.id;
    setActioning(id);
    try {
      const res = await fetch(`/api/donor/promises/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changeAmount", amount: newAmount, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert((data && data.error) ?? "처리 중 오류가 발생했습니다.");
        return;
      }
      setAmountDialog({ open: false });
      await fetchPromises();
    } finally {
      setActioning(null);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-[var(--muted-foreground)]">
        불러오는 중...
      </div>
    );
  }

  return (
    <>
    {amountDialog.open && (
      <AmountChangeDialog
        open={amountDialog.open}
        onOpenChange={(o) => { if (!o) setAmountDialog({ open: false }); }}
        promiseId={amountDialog.promise.id}
        currentAmount={Number(amountDialog.promise.amount ?? 0)}
        onSubmit={handleAmountSubmit}
        submitting={actioning === amountDialog.promise.id}
      />
    )}

    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text)]">내 약정</h1>
        <div className="text-sm text-[var(--muted-foreground)]">
          총 {promises.length.toLocaleString("ko-KR")}건
        </div>
      </div>

      {promises.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--muted-foreground)]">
          등록된 약정이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {promises.map((p) => {
            const isActive = p.status === "active";
            const isSuspended = p.status === "suspended";
            const canAct = isActive || isSuspended;

            return (
              <div
                key={p.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-[var(--text)]">
                        {p.campaigns?.title ?? "일반 후원"}
                      </span>
                      <Badge
                        className={`border-0 font-medium ${STATUS_BADGE_CLS[p.status]}`}
                      >
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {TYPE_LABEL[p.type]}
                      </span>
                    </div>

                    <div className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">
                      {p.promise_code}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-[var(--muted-foreground)] sm:grid-cols-4">
                      <div>
                        <span className="block text-xs">약정 금액</span>
                        <span className="font-medium text-[var(--text)]">
                          {formatAmount(p.amount)}
                        </span>
                      </div>
                      {p.type === "regular" && (
                        <div>
                          <span className="block text-xs">결제일</span>
                          <span className="font-medium text-[var(--text)]">
                            매월 {p.pay_day ?? "-"}일
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs">시작일</span>
                        <span className="font-medium text-[var(--text)]">
                          {formatDate(p.started_at)}
                        </span>
                      </div>
                      {p.ended_at && (
                        <div>
                          <span className="block text-xs">종료일</span>
                          <span className="font-medium text-[var(--text)]">
                            {formatDate(p.ended_at)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {canAct && (
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {isActive && (
                        <>
                          <button
                            type="button"
                            disabled={actioning === p.id}
                            onClick={() => openAmountDialog(p)}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            금액 변경
                          </button>
                          <button
                            type="button"
                            disabled={actioning === p.id}
                            onClick={() => handleAction(p.id, "suspend")}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            일시중지
                          </button>
                        </>
                      )}
                      {isSuspended && (
                        <button
                          type="button"
                          disabled={actioning === p.id}
                          onClick={() => handleAction(p.id, "resume")}
                          className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          재개
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={actioning === p.id}
                        onClick={() => handleAction(p.id, "cancel")}
                        className="rounded-md border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-xs font-medium text-[var(--negative)] transition-opacity hover:opacity-80 disabled:opacity-50"
                      >
                        해지
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
