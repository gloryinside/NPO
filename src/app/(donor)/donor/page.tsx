import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaymentWithRelations } from "@/types/payment";
import type { PromiseWithRelations } from "@/types/promise";
import { DonorProfileSection } from "@/components/donor/donor-profile-section";
import { PledgeCancelButton } from "@/components/donor/pledge-cancel-button";
import { PaymentCancelButton } from "@/components/donor/payment-cancel-button";
import { PaymentRetryButton } from "@/components/donor/payment-retry-button";
import { getDashboardActions } from "@/lib/donor/dashboard-actions";
import { getUpcomingPaymentsThisMonth } from "@/lib/donor/upcoming-payments";
import { ActionRequiredBanner } from "@/components/donor/dashboard/action-required-banner";
import { UpcomingPaymentsCard } from "@/components/donor/dashboard/upcoming-payments-card";

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

const STATUS_LABEL: Record<string, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
  pending_billing: "결제수단 대기",
};

const STATUS_DOT: Record<string, string> = {
  active: "var(--positive)",
  suspended: "var(--warning)",
  cancelled: "var(--negative)",
  completed: "var(--muted-foreground)",
  pending_billing: "var(--warning)",
};

const PAY_STATUS_LABEL: Record<string, string> = {
  paid: "완료",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환불",
  pending: "대기",
};

const PAY_STATUS_COLOR: Record<string, string> = {
  paid: "var(--positive)",
  unpaid: "var(--warning)",
  failed: "var(--negative)",
  cancelled: "var(--muted-foreground)",
  refunded: "var(--muted-foreground)",
  pending: "var(--info)",
};

export default async function DonorHomePage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");
  const { member } = session;
  const supabase = createSupabaseAdminClient();

  const { data: activePromisesData } = await supabase
    .from("promises")
    .select("*, campaigns(id, title)")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const activePromises =
    (activePromisesData as unknown as PromiseWithRelations[]) ?? [];

  const { data: recentPaymentsData } = await supabase
    .from("payments")
    .select("*, campaigns(id, title)")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("pay_date", { ascending: false, nullsFirst: false })
    .range(0, 4);

  const recentPayments =
    (recentPaymentsData as unknown as PaymentWithRelations[]) ?? [];

  const { data: latestReceiptData } = await supabase
    .from("receipts")
    .select("id, year, total_amount, pdf_url")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestReceipt = latestReceiptData as {
    id: string;
    year: number;
    total_amount: number;
    pdf_url: string | null;
  } | null;

  const { data: paidSumData } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", member.org_id)
    .eq("member_id", member.id)
    .eq("pay_status", "paid");

  const totalAmount = (paidSumData ?? []).reduce(
    (sum: number, row: { amount: number | null }) =>
      sum + Number(row.amount ?? 0),
    0
  );

  const [actions, upcomingPayments] = await Promise.all([
    getDashboardActions(supabase, member.org_id, member.id),
    getUpcomingPaymentsThisMonth(supabase, member.org_id, member.id),
  ]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "좋은 아침이에요";
    if (h < 18) return "안녕하세요";
    return "좋은 저녁이에요";
  })();

  return (
    <div className="space-y-8">
      {/* ── 히어로 헤더 ── */}
      <section
        className="rounded-2xl p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
          {greeting} 👋
        </p>
        <h1
          className="mt-1 text-2xl font-bold"
          style={{ color: "var(--text)" }}
        >
          {member.name}님
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          지금까지의 후원이 세상을 바꾸고 있습니다.
        </p>

        {/* 핵심 지표 */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatPill
            label="누적 후원액"
            value={formatAmount(totalAmount)}
            accent
          />
          <StatPill
            label="활성 약정"
            value={`${activePromises.length}건`}
          />
          <StatPill
            label="이번 달 예정"
            value={
              upcomingPayments.length > 0
                ? formatAmount(
                    upcomingPayments.reduce(
                      (s, p) => s + Number(p.amount ?? 0),
                      0
                    )
                  )
                : "없음"
            }
          />
        </div>
      </section>

      {/* ── 액션 배너 ── */}
      <ActionRequiredBanner actions={actions} />

      {/* ── 빠른 이동 ── */}
      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/donor/impact", label: "✨ 나의 임팩트", accent: true },
          { href: "/donor/promises", label: "📋 약정 관리", accent: false },
          { href: "/donor/payments", label: "💳 납입 내역", accent: false },
          { href: "/donor/receipts", label: "🧾 영수증", accent: false },
        ].map(({ href, label, accent }) => (
          <a
            key={href}
            href={href}
            className="rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              textDecoration: "none",
              background: accent
                ? "var(--accent)"
                : "var(--surface-2)",
              color: accent ? "#fff" : "var(--text)",
              border: accent
                ? "none"
                : "1px solid var(--border)",
            }}
          >
            {label}
          </a>
        ))}
      </nav>

      {/* ── 활성 약정 ── */}
      {activePromises.length > 0 && (
        <section>
          <SectionHeader
            title="활성 약정"
            count={activePromises.length}
            href="/donor/promises"
            linkLabel="전체 보기"
          />
          <div className="space-y-2">
            {activePromises.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: STATUS_DOT["active"] }}
                  />
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {p.campaigns?.title ?? "정기후원"}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatAmount(p.amount)} · 매월{" "}
                      {(p as unknown as { pay_day?: number }).pay_day ?? "-"}일
                    </p>
                  </div>
                </div>
                <PledgeCancelButton pledgeId={p.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 이번 달 예정 납입 ── */}
      <UpcomingPaymentsCard payments={upcomingPayments} />

      {/* ── 최근 납입 내역 ── */}
      <section>
        <SectionHeader
          title="최근 납입 내역"
          href="/donor/payments"
          linkLabel="전체 보기"
        />
        <div
          className="overflow-hidden rounded-xl"
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
          }}
        >
          {recentPayments.length === 0 ? (
            <div
              className="p-10 text-center text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              납입 내역이 없습니다.
            </div>
          ) : (
            <ul>
              {recentPayments.map((p, idx) => {
                const status = (p as unknown as { pay_status: string }).pay_status ?? "paid";
                const daysSince = p.pay_date
                  ? (Date.now() - new Date(p.pay_date as string).getTime()) /
                    86400000
                  : Infinity;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm font-medium"
                        style={{ color: "var(--text)" }}
                      >
                        {p.campaigns?.title ?? "일반 후원"}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {formatDate(p.pay_date as string | null)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-xs font-medium"
                        style={{ color: PAY_STATUS_COLOR[status] ?? "var(--muted-foreground)" }}
                      >
                        {PAY_STATUS_LABEL[status] ?? status}
                      </span>
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--text)" }}
                      >
                        {formatAmount(p.amount)}
                      </span>
                      {status === "paid" && daysSince <= 7 && (
                        <PaymentCancelButton paymentId={p.id} />
                      )}
                      {(status === "failed" || status === "unpaid") && (
                        <PaymentRetryButton paymentId={p.id} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* ── 영수증 ── */}
      {latestReceipt && (
        <section>
          <SectionHeader
            title="기부금 영수증"
            href="/donor/receipts"
            linkLabel="전체 보기"
          />
          <div
            className="flex items-center justify-between rounded-xl px-4 py-4"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
                {latestReceipt.year}년 기부금 영수증
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {formatAmount(latestReceipt.total_amount)}
              </p>
            </div>
            {latestReceipt.pdf_url ? (
              <a
                href={`/api/donor/receipts/${latestReceipt.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                PDF 다운로드
              </a>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                준비 중
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── 프로필 ── */}
      <section>
        <SectionHeader title="내 정보" />
        <DonorProfileSection
          member={{
            id: member.id,
            name: member.name,
            phone: member.phone ?? null,
            email: member.email ?? null,
            birth_date: member.birth_date ?? null,
          }}
        />
      </section>
    </div>
  );
}

/* ── 서브 컴포넌트 ── */

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        background: accent
          ? "var(--accent)"
          : "color-mix(in srgb, var(--surface) 70%, transparent)",
        border: accent
          ? "none"
          : "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
      }}
    >
      <p
        className="text-xs"
        style={{ color: accent ? "rgba(255,255,255,0.75)" : "var(--muted-foreground)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-lg font-bold"
        style={{ color: accent ? "#fff" : "var(--text)" }}
      >
        {value}
      </p>
    </div>
  );
}

function SectionHeader({
  title,
  count,
  href,
  linkLabel,
}: {
  title: string;
  count?: number;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2
        className="flex items-center gap-2 text-base font-semibold"
        style={{ color: "var(--text)" }}
      >
        {title}
        {count != null && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            {count}
          </span>
        )}
      </h2>
      {href && linkLabel && (
        <a
          href={href}
          className="text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)", textDecoration: "none" }}
        >
          {linkLabel} →
        </a>
      )}
    </div>
  );
}
