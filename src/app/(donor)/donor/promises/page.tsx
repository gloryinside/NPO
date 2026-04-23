"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { AmountChangeDialog } from "@/components/donor/promises/AmountChangeDialog";
import { UpdateBillingKeyDialog } from "@/components/donor/promises/UpdateBillingKeyDialog";
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
  pending_billing: "결제수단 대기",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

// 카드 상단 액센트 바 색상
const STATUS_ACCENT: Record<PromiseStatus, string> = {
  active: "var(--positive)",
  suspended: "var(--warning)",
  cancelled: "var(--negative)",
  completed: "var(--muted-foreground)",
  pending_billing: "var(--warning)",
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
  const [billingKeyTarget, setBillingKeyTarget] = useState<string | null>(null);

  const fetchPromises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/donor/promises");
      if (!res.ok) return;
      const data = await res.json();
      const all = (data.promises ?? []) as DonorPromise[];
      setPromises(
        [...all].sort(
          (a, b) =>
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromises();
  }, [fetchPromises]);

  async function handleAction(
    id: string,
    action: "suspend" | "cancel" | "resume"
  ) {
    const label =
      action === "cancel" ? "해지" : action === "resume" ? "재개" : "일시중지";
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
          alert(
            "결제 수단이 등록되지 않아 재개할 수 없습니다.\n관리자에게 카드 재등록을 요청해주세요."
          );
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

  // 통계
  const activeCount = promises.filter((p) => p.status === "active").length;
  const totalMonthly = promises
    .filter((p) => p.status === "active" && p.type === "regular")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--muted-foreground)]">
        <span className="animate-pulse">불러오는 중…</span>
      </div>
    );
  }

  return (
    <>
      {amountDialog.open && (
        <AmountChangeDialog
          open={amountDialog.open}
          onOpenChange={(o) => {
            if (!o) setAmountDialog({ open: false });
          }}
          promiseId={amountDialog.promise.id}
          currentAmount={Number(amountDialog.promise.amount ?? 0)}
          onSubmit={handleAmountSubmit}
          submitting={actioning === amountDialog.promise.id}
        />
      )}

      <UpdateBillingKeyDialog
        promiseId={billingKeyTarget}
        onClose={() => setBillingKeyTarget(null)}
        onSuccess={() => {
          setBillingKeyTarget(null);
          fetchPromises();
        }}
      />

      <div className="space-y-6">
        {/* 헤더 + 요약 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">내 약정</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              후원 약정을 관리하세요.
            </p>
          </div>
          {promises.length > 0 && (
            <div className="flex gap-3">
              <SummaryPill label="활성" value={`${activeCount}건`} color="var(--positive)" />
              {totalMonthly > 0 && (
                <SummaryPill
                  label="월 정기 합계"
                  value={`${new Intl.NumberFormat("ko-KR").format(totalMonthly)}원`}
                  color="var(--accent)"
                />
              )}
            </div>
          )}
        </div>

        {promises.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-sm text-[var(--text)]">등록된 약정이 없습니다.</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              캠페인을 통해 첫 후원을 시작해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {promises.map((p) => {
              const isActive = p.status === "active";
              const isSuspended = p.status === "suspended";
              const isPendingBilling = p.status === "pending_billing";
              const isEnded = p.status === "cancelled" || p.status === "completed";
              const canAct = isActive || isSuspended || isPendingBilling;
              const busy = actioning === p.id;

              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
                >
                  {/* 상단 상태 바 */}
                  <div
                    style={{
                      height: 4,
                      background: STATUS_ACCENT[p.status],
                      opacity: isEnded ? 0.35 : 1,
                    }}
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* 좌측 정보 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-[var(--text)]">
                            {p.campaigns?.title ?? "일반 후원"}
                          </span>
                          <Badge
                            className={`border-0 text-xs font-medium ${STATUS_BADGE_CLS[p.status]}`}
                          >
                            {STATUS_LABEL[p.status]}
                          </Badge>
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                            {TYPE_LABEL[p.type]}
                          </span>
                        </div>

                        <p className="mt-1.5 font-mono text-xs text-[var(--muted-foreground)]">
                          {p.promise_code}
                        </p>

                        {/* 핵심 지표 그리드 */}
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                          <MetaField label="약정 금액" value={formatAmount(p.amount)} highlight />
                          {p.type === "regular" && (
                            <MetaField
                              label="결제일"
                              value={`매월 ${p.pay_day ?? "-"}일`}
                            />
                          )}
                          <MetaField label="시작일" value={formatDate(p.started_at)} />
                          {p.ended_at && (
                            <MetaField label="종료일" value={formatDate(p.ended_at)} />
                          )}
                        </div>
                      </div>

                      {/* 우측 액션 */}
                      {canAct && (
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {isActive && (
                            <>
                              <ActionBtn
                                label="금액 변경"
                                busy={busy}
                                onClick={() => setAmountDialog({ open: true, promise: p })}
                              />
                              {p.type === "regular" && (
                                <ActionBtn
                                  label="카드 변경"
                                  busy={busy}
                                  onClick={() => setBillingKeyTarget(p.id)}
                                />
                              )}
                              <ActionBtn
                                label="일시중지"
                                busy={busy}
                                onClick={() => handleAction(p.id, "suspend")}
                              />
                            </>
                          )}
                          {isSuspended && (
                            <ActionBtn
                              label="재개"
                              busy={busy}
                              onClick={() => handleAction(p.id, "resume")}
                              variant="positive"
                            />
                          )}
                          {isPendingBilling && p.type === "regular" && (
                            <ActionBtn
                              label="카드 등록"
                              busy={busy}
                              onClick={() => setBillingKeyTarget(p.id)}
                              variant="warning"
                            />
                          )}
                          <ActionBtn
                            label="해지"
                            busy={busy}
                            onClick={() => handleAction(p.id, "cancel")}
                            variant="danger"
                          />
                        </div>
                      )}
                    </div>
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

/* ── 서브 컴포넌트 ── */

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function MetaField({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p
        className="mt-0.5 text-sm font-medium"
        style={{ color: highlight ? "var(--accent)" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

type ActionBtnVariant = "default" | "positive" | "warning" | "danger";

const VARIANT_STYLE: Record<ActionBtnVariant, React.CSSProperties> = {
  default: {
    background: "var(--surface-2)",
    color: "var(--text)",
    border: "1px solid var(--border)",
  },
  positive: {
    background: "var(--positive-soft)",
    color: "var(--positive)",
    border: "1px solid var(--positive)",
  },
  warning: {
    background: "var(--warning-soft)",
    color: "var(--warning)",
    border: "1px solid var(--warning)",
  },
  danger: {
    background: "rgba(239,68,68,0.08)",
    color: "var(--negative)",
    border: "1px solid rgba(239,68,68,0.4)",
  },
};

function ActionBtn({
  label,
  busy,
  onClick,
  variant = "default",
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  variant?: ActionBtnVariant;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
      style={VARIANT_STYLE[variant]}
    >
      {busy ? "…" : label}
    </button>
  );
}
