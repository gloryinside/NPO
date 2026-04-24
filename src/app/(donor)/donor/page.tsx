import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDashboardSnapshot } from "@/lib/donor/dashboard-snapshot";
import { HeroSection } from "@/components/donor/dashboard/hero-section";
import {
  ActionBannerSkeleton,
  DashboardBodySkeleton,
} from "@/components/donor/dashboard/dashboard-skeleton";
import { ActionRequiredBanner } from "@/components/donor/dashboard/action-required-banner";
import { UpcomingPaymentsCard } from "@/components/donor/dashboard/upcoming-payments-card";
import { DonorProfileSection } from "@/components/donor/donor-profile-section";
import { PledgeCancelButton } from "@/components/donor/pledge-cancel-button";
import { PaymentCancelButton } from "@/components/donor/payment-cancel-button";
import { PaymentRetryButton } from "@/components/donor/payment-retry-button";
import type { DonorDashboardSnapshot } from "@/types/dashboard";
import type { Member } from "@/types/member";

function formatAmount(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

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

  // 단일 RPC — 기존 7개 쿼리를 통합 (RTT 6→1)
  const snapshot = await getDashboardSnapshot(
    supabase,
    member.org_id,
    member.id,
  );

  if (!snapshot) {
    return (
      <div
        className="p-8 text-center text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        대시보드를 불러오는 중 오류가 발생했습니다. 잠시 후 새로고침해 주세요.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── 히어로 — 즉시 렌더 ── */}
      <HeroSection memberName={member.name} snapshot={snapshot} />

      {/* ── 액션 배너 (스트리밍) ── */}
      <Suspense fallback={<ActionBannerSkeleton />}>
        <ActionRequiredBanner
          actions={{
            failedPayments: snapshot.action_failed_count,
            missingRrnReceipts: snapshot.action_rrn_count,
            recentAdminChanges: snapshot.action_changes_count,
          }}
        />
      </Suspense>

      {/* ── 카드 만료 임박 (G-D50) ── */}
      {snapshot.expiring_cards.length > 0 && (
        <section
          role="alert"
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--warning)",
            background: "var(--warning-soft)",
          }}
        >
          <p
            className="text-sm font-semibold"
            style={{ color: "var(--warning)" }}
          >
            <span aria-hidden="true">💳</span> 결제 카드 만료 임박
          </p>
          <ul
            className="mt-2 space-y-1 text-xs"
            style={{ color: "var(--text)" }}
          >
            {snapshot.expiring_cards.map((c) => (
              <li key={c.promise_id}>
                <b>{c.campaign_title ?? "정기후원"}</b> — {c.expiry_year}/
                {String(c.expiry_month).padStart(2, "0")} 만료
                {c.days_until_expiry < 0
                  ? " (이미 만료)"
                  : ` (D-${c.days_until_expiry})`}
              </li>
            ))}
          </ul>
          <a
            href="/donor/promises"
            className="mt-3 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--warning)", textDecoration: "none" }}
          >
            카드 업데이트하기 →
          </a>
        </section>
      )}

      {/* ── 첫 후원 온보딩 (G-D57) ── */}
      {snapshot.active_promises.length === 0 && snapshot.total_paid === 0 && (
        <section
          className="rounded-2xl p-6 text-center"
          style={{
            background:
              "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface) 100%)",
            border: "1px solid var(--accent)",
          }}
        >
          <p className="text-4xl mb-3" aria-hidden="true">
            🎁
          </p>
          <p
            className="text-base font-semibold"
            style={{ color: "var(--text)" }}
          >
            첫 후원을 시작해보세요
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            작은 정기후원부터 변화가 시작됩니다.
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)", textDecoration: "none" }}
          >
            캠페인 둘러보기 →
          </a>
        </section>
      )}

      {/* ── 빠른 이동 ── */}
      <nav
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        aria-label="빠른 이동"
      >
        {[
          { href: "/donor/impact", icon: "✨", label: "임팩트", accent: true },
          { href: "/donor/promises", icon: "📋", label: "약정", accent: false },
          { href: "/donor/payments", icon: "💳", label: "납입", accent: false },
          { href: "/donor/receipts", icon: "🧾", label: "영수증", accent: false },
          { href: "/donor/cheer", icon: "💬", label: "응원", accent: false },
        ].map(({ href, icon, label, accent }) => (
          <a
            key={href}
            href={href}
            className="rounded-xl px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              textDecoration: "none",
              background: accent ? "var(--accent)" : "var(--surface-2)",
              color: accent ? "#fff" : "var(--text)",
              border: accent ? "none" : "1px solid var(--border)",
            }}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </a>
        ))}
      </nav>

      {/* ── 약정·납입·영수증·프로필 (스트리밍) ── */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody snapshot={snapshot} member={member} />
      </Suspense>
    </div>
  );
}

function DashboardBody({
  snapshot,
  member,
}: {
  snapshot: DonorDashboardSnapshot;
  member: Member;
}) {
  return (
    <div className="space-y-8">
      {/* 활성 약정 */}
      {snapshot.active_promises.length > 0 && (
        <section>
          <SectionHeader
            title="활성 약정"
            count={snapshot.active_promises.length}
            href="/donor/promises"
            linkLabel="전체 보기"
          />
          <div className="space-y-2">
            {snapshot.active_promises.map((p) => (
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
                    style={{ background: "var(--positive)" }}
                    aria-hidden="true"
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
                      {formatAmount(p.amount)} · 매월 {p.pay_day ?? "-"}일
                    </p>
                  </div>
                </div>
                <PledgeCancelButton pledgeId={p.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 이번 달 예정 납입 */}
      <UpcomingPaymentsCard
        payments={snapshot.upcoming_payments.map((u) => ({
          promiseId: u.promise_id,
          campaignId: null,
          campaignTitle: u.campaign_title,
          amount: u.amount,
          scheduledDate: u.scheduled_date,
        }))}
      />

      {/* 최근 납입 내역 */}
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
          {snapshot.recent_payments.length === 0 ? (
            <div
              className="p-10 text-center text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              납입 내역이 없습니다.
            </div>
          ) : (
            <ul>
              {snapshot.recent_payments.map((p, idx) => {
                const status = p.pay_status ?? "paid";
                const daysSince = p.pay_date
                  ? (Date.now() - new Date(p.pay_date).getTime()) / 86400000
                  : Infinity;
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderTop:
                        idx === 0 ? "none" : "1px solid var(--border)",
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
                        {formatDate(p.pay_date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color:
                            PAY_STATUS_COLOR[status] ??
                            "var(--muted-foreground)",
                        }}
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

      {/* 영수증 */}
      {snapshot.latest_receipt && (
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
              <p
                className="text-sm font-medium"
                style={{ color: "var(--text)" }}
              >
                {snapshot.latest_receipt.year}년 기부금 영수증
              </p>
              <p
                className="mt-0.5 text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {formatAmount(snapshot.latest_receipt.total_amount)}
              </p>
            </div>
            {snapshot.latest_receipt.pdf_url ? (
              <a
                href={`/api/donor/receipts/${snapshot.latest_receipt.id}/download`}
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

      {/* 프로필 */}
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
