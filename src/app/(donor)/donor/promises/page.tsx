"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { AmountChangeDialog } from "@/components/donor/promises/AmountChangeDialog";
import { UpdateBillingKeyDialog } from "@/components/donor/promises/UpdateBillingKeyDialog";
import { CancelConfirmModal } from "@/components/donor/cancel-confirm-modal";
import { EmptyState } from "@/components/donor/ui/EmptyState";
import { InlineLoading } from "@/components/donor/ui/PageLoading";
import { useDonorT } from "@/lib/i18n/use-donor-t";
import { toast } from "sonner";
import type { PromiseStatus } from "@/types/promise";
import { formatDate, formatKRW as formatAmount } from "@/lib/format";
import {
  SummaryPill,
  MetaField,
  PayDayField,
  PromiseImpactBlock,
  ActionBtn,
  type DonorPromise,
} from "@/components/donor/promises/promise-parts";

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

type AmountDialogState = { open: true; promise: DonorPromise } | { open: false };

type ActionKind = "suspend" | "cancel" | "resume";
type ConfirmTarget = {
  id: string;
  action: ActionKind;
  title: string;
} | null;

export default function DonorPromisesPage() {
  const t = useDonorT();
  const [promises, setPromises] = useState<DonorPromise[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [amountDialog, setAmountDialog] = useState<AmountDialogState>({ open: false });
  const [billingKeyTarget, setBillingKeyTarget] = useState<string | null>(null);

  // 토스 결제창 카드 변경에서 돌아왔을 때 결과 안내 후 주소 정리
  useEffect(() => {
    const url = new URL(window.location.href);
    const card = url.searchParams.get("card");
    if (!card) return;
    if (card === "updated") toast.success("결제수단이 변경되었습니다. 기존 카드의 자동결제 등록은 삭제됩니다.");
    else toast.error("결제수단을 변경하지 못했습니다. 기존 카드는 그대로 유지됩니다.");
    url.searchParams.delete("card");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, []);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);
  // G-D41: 과거 약정(해지/완료) 표시 토글
  const [showEnded, setShowEnded] = useState(false);

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

  function requestAction(promise: DonorPromise, action: ActionKind) {
    setConfirmTarget({
      id: promise.id,
      action,
      title: promise.campaigns?.title ?? t("common.default_campaign"),
    });
  }

  async function executeAction(id: string, action: ActionKind) {
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
          toast.error(t("donor.promises.error.billing_key_missing"));
        } else {
          toast.error(data.error ?? t("donor.promises.error.generic"));
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
        toast.error((data && data.error) ?? t("donor.promises.error.generic"));
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
  // 전체 약정 누적 후원액 합계
  const grandTotalPaid = promises.reduce(
    (s, p) => s + (p.stats?.total_paid ?? 0),
    0
  );

  // G-D41: 현재/과거 약정 분리
  const livePromises = promises.filter(
    (p) => p.status === "active" || p.status === "pending_billing" || p.status === "suspended"
  );
  const endedPromises = promises.filter(
    (p) => p.status === "cancelled" || p.status === "completed"
  );
  const visible = showEnded ? promises : livePromises;

  if (loading) {
    return <InlineLoading label={t("donor.promises.loading")} />;
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

      {confirmTarget && (
        <CancelConfirmModal
          title={t(`donor.promises.confirm.${confirmTarget.action}.title`, { title: confirmTarget.title })}
          message={t(`donor.promises.confirm.${confirmTarget.action}.message`)}
          confirmLabel={t(`donor.promises.action.${confirmTarget.action === "cancel" ? "cancel" : confirmTarget.action}`)}
          onConfirm={async () => {
            const target = confirmTarget;
            setConfirmTarget(null);
            await executeAction(target.id, target.action);
          }}
          onClose={() => setConfirmTarget(null)}
        />
      )}

      <div className="space-y-6">
        {/* 헤더 + 요약 */}
        <div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text)]">{t("donor.promises.title")}</h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {t("donor.promises.subtitle")}
              </p>
            </div>
            {promises.length > 0 && (
              <div className="flex gap-3">
                <SummaryPill label={t("donor.promises.summary.active")} value={`${activeCount}건`} color="var(--positive)" />
                {totalMonthly > 0 && (
                  <SummaryPill
                    label={t("donor.promises.summary.monthly")}
                    value={`${new Intl.NumberFormat("ko-KR").format(totalMonthly)}원`}
                    color="var(--accent)"
                  />
                )}
              </div>
            )}
          </div>

          {/* 전체 누적 후원액 배너 */}
          {grandTotalPaid > 0 && (
            <div
              className="mt-4 flex items-center justify-between rounded-xl px-5 py-3"
              style={{
                background: "linear-gradient(90deg, var(--accent-soft) 0%, var(--surface-2) 100%)",
                border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              }}
            >
              <div>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  내 모든 약정 누적 후원액
                </p>
                <p className="mt-0.5 text-xl font-extrabold" style={{ color: "var(--accent)" }}>
                  {new Intl.NumberFormat("ko-KR").format(grandTotalPaid)}원
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  활성 약정
                </p>
                <p className="mt-0.5 text-base font-bold" style={{ color: "var(--text)" }}>
                  {activeCount}건
                </p>
              </div>
            </div>
          )}
        </div>

        {promises.length === 0 ? (
          <EmptyState
            illustration="promises"
            title={t("donor.promises.empty.title")}
            description={t("donor.promises.empty.description")}
            cta={{ href: "/", label: t("donor.promises.empty.cta") }}
          />
        ) : livePromises.length === 0 && !showEnded ? (
          <EmptyState
            illustration="campaigns"
            title={t("donor.promises.no_live.title")}
            description={t("donor.promises.no_live.description", { count: endedPromises.length })}
            cta={{ href: "/", label: t("donor.promises.no_live.cta") }}
          />
        ) : (
          <div className="space-y-4">
            {visible.map((p) => {
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
                      height: isEnded ? 4 : 6,
                      background: STATUS_ACCENT[p.status],
                      opacity: isEnded ? 0.35 : 1,
                    }}
                  />

                  {/* pending_billing 경고 배너 — 카드 미등록 */}
                  {isPendingBilling && (
                    <div className="flex items-center gap-2 border-b border-[var(--warning)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-5 py-2.5">
                      <span className="text-sm" aria-hidden>⚠️</span>
                      <p className="text-xs font-medium text-[var(--warning)]">
                        카드 등록이 완료되지 않았습니다. 아래 &apos;카드 등록&apos; 버튼을 눌러 정기결제를 활성화해 주세요.
                      </p>
                    </div>
                  )}

                  {/* 뿌듯함 블록 — 진행 중 약정에만 (G-D173) */}
                  {!isEnded && <PromiseImpactBlock promise={p} />}

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      {/* 좌측 정보 */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-[var(--text)]">
                            {p.campaigns?.title ?? t("common.general_donation")}
                          </span>
                          <Badge
                            className={`border-0 text-xs font-medium ${STATUS_BADGE_CLS[p.status]}`}
                          >
                            {t(`donor.promises.${p.status}`)}
                          </Badge>
                          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted-foreground)]">
                            {t(`donor.promises.type.${p.type}`)}
                          </span>
                        </div>

                        <p className="mt-1.5 font-mono text-xs text-[var(--muted-foreground)]">
                          {p.promise_code}
                        </p>

                        {/* 핵심 지표 그리드 */}
                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                          <MetaField label={t("donor.promises.field.amount")} value={formatAmount(p.amount)} highlight />
                          {p.type === "regular" && (
                            <PayDayField
                              promise={p}
                              busy={actioning === p.id}
                              editable={p.status === "active"}
                              onSaved={fetchPromises}
                              t={t}
                            />
                          )}
                          <MetaField label={t("donor.promises.field.started_at")} value={formatDate(p.started_at)} />
                          {p.ended_at && (
                            <MetaField label={t("donor.promises.field.ended_at")} value={formatDate(p.ended_at)} />
                          )}
                        </div>
                      </div>

                      {/* 우측 액션 */}
                      {canAct && (
                        <div className="flex shrink-0 flex-col gap-1.5">
                          {isActive && (
                            <>
                              <ActionBtn
                                label={t("donor.promises.action.amount_change")}
                                busy={busy}
                                onClick={() => setAmountDialog({ open: true, promise: p })}
                              />
                              {p.type === "regular" && (
                                <ActionBtn
                                  label={t("donor.promises.action.card_change")}
                                  busy={busy}
                                  onClick={() => setBillingKeyTarget(p.id)}
                                />
                              )}
                              <ActionBtn
                                label={t("donor.promises.action.suspend")}
                                busy={busy}
                                onClick={() => requestAction(p, "suspend")}
                              />
                            </>
                          )}
                          {isSuspended && (
                            <ActionBtn
                              label={t("donor.promises.action.resume")}
                              busy={busy}
                              onClick={() => requestAction(p, "resume")}
                              variant="positive"
                            />
                          )}
                          {isPendingBilling && p.type === "regular" && (
                            <ActionBtn
                              label={t("donor.promises.action.register_card")}
                              busy={busy}
                              onClick={() => setBillingKeyTarget(p.id)}
                              variant="warning"
                            />
                          )}
                          <ActionBtn
                            label={t("donor.promises.action.cancel")}
                            busy={busy}
                            onClick={() => requestAction(p, "cancel")}
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

        {/* G-D41: 과거 약정 토글 (해지/완료 있을 때만) */}
        {endedPromises.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setShowEnded((v) => !v)}
              {...{ "aria-pressed": (showEnded ? "true" : "false") as "true" | "false" }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-opacity hover:opacity-80"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-2)",
                color: "var(--muted-foreground)",
              }}
            >
              {showEnded
                ? t("donor.promises.toggle.hide_ended")
                : t("donor.promises.toggle.show_ended", { count: endedPromises.length })}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
