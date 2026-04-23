import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { computeDataHealth } from "@/lib/admin/data-health";

export const metadata = { title: "데이터 품질" };

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export default async function AdminDataHealthPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const h = await computeDataHealth(supabase, tenant.id);

  const items: Array<{
    label: string;
    value: string;
    note?: string;
    severity: "ok" | "warn" | "bad";
  }> = [
    {
      label: "총 회원",
      value: `${h.totalMembers.toLocaleString("ko-KR")}명`,
      severity: "ok",
    },
    {
      label: "중복 이메일 회원",
      value: `${h.duplicateEmail}명`,
      note: "/admin/members/duplicates 에서 병합 판정",
      severity: h.duplicateEmail > 0 ? "warn" : "ok",
    },
    {
      label: "중복 전화번호 회원",
      value: `${h.duplicatePhone}명`,
      severity: h.duplicatePhone > 0 ? "warn" : "ok",
    },
    {
      label: "일반후원 결제(캠페인 없음)",
      value: `${h.orphanPayments}건`,
      note: "정책상 허용될 수 있으나, 예상치 못하면 점검",
      severity: "ok",
    },
    {
      label: "PDF 미발급 영수증",
      value: `${h.receiptMissingPdf}건`,
      note: "cron 재실행 또는 수동 재발행",
      severity: h.receiptMissingPdf > 0 ? "warn" : "ok",
    },
    {
      label: "카드키 없는 정기후원",
      value: `${h.activeRegularWithoutBillingKey}건`,
      note: "재청구 불가 — 카드 재등록 유도 캠페인 필요",
      severity: h.activeRegularWithoutBillingKey > 0 ? "bad" : "ok",
    },
    {
      label: "이메일 수신 불가",
      value: `${h.emailDisabledCount}명 (${pct(h.emailDisabledRate)})`,
      note: "hard/complaint 누적으로 자동 disable",
      severity: h.emailDisabledRate > 0.05 ? "warn" : "ok",
    },
    {
      label: "카드 분쟁 위험",
      value: `${h.chargebackRiskCount}명`,
      note: "chargeback_risk=true",
      severity: h.chargebackRiskCount > 0 ? "warn" : "ok",
    },
  ];

  const color = (s: "ok" | "warn" | "bad") =>
    s === "bad"
      ? "var(--negative)"
      : s === "warn"
        ? "var(--warning)"
        : "var(--positive)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">데이터 품질</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          후원자 및 결제 데이터의 이상·보수 대상 지표입니다.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="rounded-2xl border p-5"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p
                className="text-xs uppercase tracking-wider"
                style={{ color: "var(--muted-foreground)" }}
              >
                {it.label}
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{
                  background: `color-mix(in srgb, ${color(it.severity)} 15%, transparent)`,
                  color: color(it.severity),
                }}
              >
                {it.severity === "bad"
                  ? "조치 필요"
                  : it.severity === "warn"
                    ? "주의"
                    : "양호"}
              </span>
            </div>
            <p
              className="mt-2 text-2xl font-bold"
              style={{ color: color(it.severity) }}
            >
              {it.value}
            </p>
            {it.note && (
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {it.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
