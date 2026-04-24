"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { AmountChangeDialog } from "@/components/donor/promises/AmountChangeDialog";
import { UpdateBillingKeyDialog } from "@/components/donor/promises/UpdateBillingKeyDialog";
import { CancelConfirmModal } from "@/components/donor/cancel-confirm-modal";
import { EmptyState } from "@/components/donor/ui/EmptyState";
import { InlineLoading } from "@/components/donor/ui/PageLoading";
import { useDonorT } from "@/lib/i18n/use-donor-t";
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
          alert(t("donor.promises.error.billing_key_missing"));
        } else {
          alert(data.error ?? t("donor.promises.error.generic"));
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
        alert((data && data.error) ?? t("donor.promises.error.generic"));
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

        {promises.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t("donor.promises.empty.title")}
            description={t("donor.promises.empty.description")}
            cta={{ href: "/", label: t("donor.promises.empty.cta") }}
          />
        ) : livePromises.length === 0 && !showEnded ? (
          <EmptyState
            icon="📭"
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

/**
 * SP-3: 결제일 인라인 편집 필드. active 약정만 편집 가능.
 */
function PayDayField({
  promise,
  busy,
  editable,
  onSaved,
  t,
}: {
  promise: DonorPromise;
  busy: boolean;
  editable: boolean;
  onSaved: () => void | Promise<void>;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<number>(promise.pay_day ?? 1);
  const [saving, setSaving] = useState(false);
  const currentLabel = t("donor.promises.pay_day_value", { day: promise.pay_day ?? "-" });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/donor/promises/${promise.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePayDay", pay_day: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? t("donor.promises.pay_day_failed"));
        return;
      }
      setEditing(false);
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  if (!editable || !editing) {
    return (
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{t("donor.promises.field.pay_day")}</p>
        <p className="mt-0.5 flex items-center gap-2 text-sm font-medium text-[var(--text)]">
          {currentLabel}
          {editable && (
            <button
              type="button"
              onClick={() => {
                setValue(promise.pay_day ?? 1);
                setEditing(true);
              }}
              disabled={busy}
              className="text-xs font-medium disabled:opacity-50"
              style={{ color: "var(--accent)" }}
            >
              {t("donor.promises.pay_day_change")}
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-[var(--muted-foreground)]">{t("donor.promises.field.pay_day")}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <label
          htmlFor={`pay-day-${promise.id}`}
          className="sr-only"
        >
          {t("donor.promises.pay_day_label")}
        </label>
        <select
          id={`pay-day-${promise.id}`}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          disabled={saving}
          className="rounded border px-2 py-1 text-sm"
          style={{
            background: "var(--surface)",
            color: "var(--text)",
            borderColor: "var(--border)",
          }}
        >
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {t("donor.promises.pay_day_value", { day: d })}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={save}
          disabled={saving || value === promise.pay_day}
          className="text-xs font-medium disabled:opacity-50"
          style={{ color: "var(--accent)" }}
        >
          {saving ? t("donor.promises.pay_day_saving") : t("donor.promises.pay_day_save")}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t("donor.promises.pay_day_cancel")}
        </button>
      </div>
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
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-medium transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
      style={VARIANT_STYLE[variant]}
    >
      {busy ? "…" : label}
    </button>
  );
}
