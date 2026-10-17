"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { PromiseStatus, PromiseType } from "@/types/promise";

/** 후원자 "내 정기후원" 화면의 표시용 조각과 타입 */

export type CampaignRef =
  | {
      id: string;
      title: string;
      impact_unit_amount: number | null;
      impact_unit_label: string | null;
    }
  | null;

export type HistoryEntry = { month: string; status: "paid" | "failed" | "none" };

export type PromiseStats = {
  promise_id: string;
  total_paid: number;
  paid_count: number;
  failed_count: number;
  history_12m: HistoryEntry[];
};

export type DonorPromise = {
  id: string;
  promise_code: string;
  status: PromiseStatus;
  type: PromiseType;
  amount: number | null;
  pay_day: number | null;
  started_at: string | null;
  ended_at: string | null;
  campaigns: CampaignRef;
  stats: PromiseStats;
};

/* ── 서브 컴포넌트 ── */

export function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-center">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-sm font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

export function MetaField({
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
export function PayDayField({
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
        toast.error(data.error ?? t("donor.promises.pay_day_failed"));
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

/**
 * 약정 카드 상단의 "뿌듯함" 블록.
 *
 * 구성:
 *   1. 누적 지표 3종 (누적 후원액·납입 횟수·연속 개월)
 *   2. 임팩트 환산 문구 (campaign.impact_unit_amount/label 있을 때만)
 *   3. 최근 12개월 스티커 히스토리
 */
export function PromiseImpactBlock({ promise }: { promise: DonorPromise }) {
  const { stats, campaigns } = promise;
  const totalPaid = stats.total_paid;
  const paidCount = stats.paid_count;

  // 연속 개월 — history_12m 끝에서부터 paid 연속 개수
  const streak = (() => {
    let n = 0;
    for (let i = stats.history_12m.length - 1; i >= 0; i--) {
      if (stats.history_12m[i].status === "paid") n++;
      else break;
    }
    return n;
  })();

  const unitAmount = campaigns?.impact_unit_amount ?? null;
  const unitLabel = campaigns?.impact_unit_label ?? null;
  const impactCount =
    unitAmount && unitAmount > 0 ? Math.floor(totalPaid / unitAmount) : null;
  const showImpact =
    impactCount !== null && impactCount > 0 && unitLabel && totalPaid > 0;

  // 아직 납입 이력이 없으면 블록 자체 숨김 (pending_billing / 신규)
  if (totalPaid === 0 && paidCount === 0) return null;

  return (
    <div
      className="border-b px-5 pt-5 pb-4"
      style={{
        borderColor: "var(--border)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, transparent) 0%, transparent 100%)",
      }}
    >
      {/* 누적 지표 3종 */}
      <div className="grid grid-cols-3 gap-3">
        <StatBlock
          label="누적 후원액"
          value={`${new Intl.NumberFormat("ko-KR").format(totalPaid)}원`}
          accent
        />
        <StatBlock label="납입 횟수" value={`${paidCount}회`} />
        <StatBlock
          label="연속 후원"
          value={streak > 0 ? `${streak}개월` : "-"}
        />
      </div>

      {/* 임팩트 환산 문구 */}
      {showImpact && (
        <p
          className="mt-4 rounded-lg px-3 py-2.5 text-sm"
          style={{
            background: "var(--accent-soft)",
            color: "var(--text)",
          }}
        >
          <span aria-hidden="true">💡</span> 지금까지 약{" "}
          <b style={{ color: "var(--accent)" }}>
            {new Intl.NumberFormat("ko-KR").format(impactCount)}
            {unitLabel}
          </b>
          의 변화를 함께 만드셨어요.
        </p>
      )}

      {/* 최근 12개월 스티커 히스토리 */}
      {stats.history_12m.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
            최근 12개월 납입
          </p>
          <HistoryStickerRow entries={stats.history_12m} />
        </div>
      )}
    </div>
  );
}

export function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </p>
      <p
        className="mt-0.5 text-base font-bold"
        style={{ color: accent ? "var(--accent)" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

// 연도 경계가 있는 스티커 행 — 1월이 나올 때마다 연도 라벨을 삽입
export function HistoryStickerRow({ entries }: { entries: HistoryEntry[] }) {
  const items: Array<{ type: "year"; year: string } | { type: "sticker"; entry: HistoryEntry }> = [];
  for (const entry of entries) {
    const mm = entry.month.slice(5); // "MM"
    if (mm === "01") {
      items.push({ type: "year", year: entry.month.slice(0, 4) });
    }
    items.push({ type: "sticker", entry });
  }
  return (
    <div className="flex flex-wrap items-end gap-x-1 gap-y-2">
      {items.map((item, i) =>
        item.type === "year" ? (
          <span
            key={`yr-${item.year}-${i}`}
            className="w-full text-[10px] font-semibold"
            style={{ color: "var(--muted-foreground)", marginBottom: -4 }}
          >
            {item.year}
          </span>
        ) : (
          <HistorySticker key={item.entry.month} month={item.entry.month} status={item.entry.status} />
        )
      )}
    </div>
  );
}

export function HistorySticker({
  month,
  status,
}: {
  month: string;
  status: "paid" | "failed" | "none";
}) {
  const mm = Number(month.slice(5)); // 1~12
  const icon = status === "paid" ? "✓" : status === "failed" ? "✕" : "·";

  const bg =
    status === "paid"
      ? "var(--accent)"
      : status === "failed"
        ? "var(--negative-soft)"
        : "var(--surface-2)";
  const fg =
    status === "paid"
      ? "#fff"
      : status === "failed"
        ? "var(--negative)"
        : "var(--muted-foreground)";
  const border =
    status === "paid"
      ? "none"
      : status === "failed"
        ? "1px solid var(--negative)"
        : "1px dashed var(--border)";

  const label =
    status === "paid"
      ? `${month} 납입 성공`
      : status === "failed"
        ? `${month} 납입 실패`
        : `${month} 납입 없음`;

  return (
    <div
      title={label}
      aria-label={label}
      className="flex flex-col items-center gap-0.5"
    >
      {/* 상태 아이콘 원 */}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full font-semibold"
        style={{ background: bg, color: fg, border, fontSize: 12 }}
      >
        {icon}
      </div>
      {/* 월 라벨 */}
      <span
        className="text-[9px] font-medium leading-none"
        style={{ color: status === "paid" ? "var(--accent)" : "var(--muted-foreground)" }}
      >
        {mm}월
      </span>
    </div>
  );
}

export type ActionBtnVariant = "default" | "positive" | "warning" | "danger";

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

export function ActionBtn({
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
