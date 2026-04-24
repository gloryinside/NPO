import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkAndAlertNewDevice } from "@/lib/donor/device-alert";
import { getDashboardSnapshot } from "@/lib/donor/dashboard-snapshot";
import { getT } from "@/lib/i18n/donor";
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
  const t = await getT();

  // 새 기기 로그인 감지 — best-effort, 로그인 차단하지 않음
  const h = await headers();
  const currentIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent") ?? null;
  checkAndAlertNewDevice(supabase, {
    memberId: member.id,
    orgId: member.org_id,
    email: member.email ?? "",
    name: member.name ?? "",
    currentIp,
    userAgent,
  }).catch(() => {});

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
        {t("donor.dashboard.error.load")}
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
            {t("donor.dashboard.card_expiry.title")}
          </p>
          <ul
            className="mt-2 space-y-1 text-xs"
            style={{ color: "var(--text)" }}
          >
            {snapshot.expiring_cards.map((c) => (
              <li key={c.promise_id}>
                <b>
                  {c.campaign_title ??
                    t("donor.dashboard.card_expiry.default_title")}
                </b>{" "}
                — {c.expiry_year}/{String(c.expiry_month).padStart(2, "0")}
                {c.days_until_expiry < 0
                  ? ` (${t("donor.dashboard.card_expiry.expired")})`
                  : ` (D-${c.days_until_expiry})`}
              </li>
            ))}
          </ul>
          <a
            href="/donor/promises"
            className="mt-3 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ background: "var(--warning)", textDecoration: "none" }}
          >
            {t("donor.dashboard.card_expiry.cta")} →
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
            {t("donor.dashboard.onboarding.title")}
          </p>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t("donor.dashboard.onboarding.body")}
          </p>
          <a
            href="/"
            className="mt-4 inline-block rounded-xl px-6 py-2.5 text-sm font-semibold text-white"
            style={{ background: "var(--accent)", textDecoration: "none" }}
          >
            {t("donor.dashboard.onboarding.cta")} →
          </a>
        </section>
      )}

      {/* ── 약정·납입·영수증·프로필 (스트리밍) ── */}
      <Suspense fallback={<DashboardBodySkeleton />}>
        <DashboardBody snapshot={snapshot} member={member} />
      </Suspense>
    </div>
  );
}

async function DashboardBody({
  snapshot,
  member,
}: {
  snapshot: DonorDashboardSnapshot;
  member: Member;
}) {
  const t = await getT();
  return (
    <div className="space-y-8">
      {/* 활성 약정 */}
      {snapshot.active_promises.length > 0 && (
        <section>
          <SectionHeader
            title={t("donor.dashboard.section.active_promises")}
            count={snapshot.active_promises.length}
            href="/donor/promises"
            linkLabel={t("donor.dashboard.section.view_all")}
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
                      {p.campaigns?.title ?? t("common.default_campaign")}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatAmount(p.amount)} · {t("common.monthly")}{" "}
                      {p.pay_day ?? "-"}
                      {t("common.day")}
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
          title={t("donor.dashboard.section.recent_payments")}
          href="/donor/payments"
          linkLabel={t("donor.dashboard.section.view_all")}
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
              {t("donor.dashboard.empty.payments")}
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
                        {p.campaigns?.title ?? t("common.general_donation")}
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
            title={t("donor.dashboard.section.receipts")}
            href="/donor/receipts"
            linkLabel={t("donor.dashboard.section.view_all")}
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
                {t("donor.dashboard.receipt.year_prefix")}
                {snapshot.latest_receipt.year}
                {t("donor.dashboard.receipt.year_suffix")}
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
                {t("common.pdf_download")}
              </a>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t("common.preparing")}
              </span>
            )}
          </div>
        </section>
      )}

      {/* 프로필 */}
      <section>
        <SectionHeader title={t("donor.dashboard.section.my_info")} />
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
