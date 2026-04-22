import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberConsultations } from "@/components/admin/member-consultations";
import { MemberEditForm } from "@/components/admin/member-edit-form";
import { AccountStateBadge } from "@/components/admin/members/account-state-badge";
import { InviteButton } from "@/components/admin/members/invite-button";
import { ManualPaymentDialog } from "@/components/admin/payments/manual-payment-dialog";
import { RetryButton } from "@/components/admin/payments/retry-button";
import { resolveAccountStatesBatch } from "@/lib/members/account-state";
import type { Member, MemberStatus, MemberType } from "@/types/member";
import type { PromiseStatus, PromiseType } from "@/types/promise";
import type { PayStatus, IncomeStatus } from "@/types/payment";

type RouteParams = Promise<{ id: string }>;

type PromiseRow = {
  id: string;
  promise_code: string;
  type: PromiseType;
  amount: number;
  pay_day: number | null;
  pay_method: string;
  status: PromiseStatus;
  started_at: string | null;
  ended_at: string | null;
  toss_billing_key: string | null;
  campaigns: { id: string; title: string } | null;
};

type PaymentRow = {
  id: string;
  payment_code: string;
  amount: number;
  pay_date: string | null;
  pay_status: PayStatus;
  income_status: IncomeStatus;
  pg_method: string | null;
  pay_method: string | null;
  campaigns: { id: string; title: string } | null;
  promises: { toss_billing_key: string | null } | null;
};

const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  active: "활성",
  inactive: "비활성",
  deceased: "사망",
};

const MEMBER_TYPE_LABEL: Record<MemberType, string> = {
  individual: "개인",
  corporate: "법인",
};

const PROMISE_STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
  pending_billing: "결제수단 대기",
};

const PROMISE_TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  paid: "완료",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환��",
  pending: "대기",
};

const INCOME_STATUS_LABEL: Record<IncomeStatus, string> = {
  pending: "수입대기",
  processing: "수입진행",
  confirmed: "수입완료",
  excluded: "수입제외",
};

function formatAmount(value: number | null | undefined) {
  if (value == null) return "-";
  return `${new Intl.NumberFormat("ko-KR").format(Number(value))}원`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const styles: Record<MemberStatus, React.CSSProperties> = {
    active: { background: "var(--positive-soft)", color: "var(--positive)" },
    inactive: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    deceased: { background: "var(--negative-soft)", color: "var(--negative)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {MEMBER_STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "var(--positive-soft)", color: "var(--positive)" },
    suspended: { background: "var(--warning-soft)", color: "var(--warning)" },
    cancelled: { background: "var(--negative-soft)", color: "var(--negative)" },
    completed: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    pending_billing: { background: "var(--warning-soft)", color: "var(--warning)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {PROMISE_STATUS_LABEL[status]}
    </Badge>
  );
}

function PayStatusBadge({ status }: { status: PayStatus }) {
  const styles: Record<PayStatus, React.CSSProperties> = {
    paid: { background: "var(--positive-soft)", color: "var(--positive)" },
    pending: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    unpaid: { background: "rgba(136,136,170,0.15)", color: "var(--muted-foreground)" },
    failed: { background: "var(--negative-soft)", color: "var(--negative)" },
    cancelled: { background: "var(--negative-soft)", color: "var(--negative)" },
    refunded: { background: "var(--warning-soft)", color: "var(--warning)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {PAY_STATUS_LABEL[status]}
    </Badge>
  );
}

export default async function MemberDetailPage({
  params,
}: {
  params: RouteParams;
}) {
  await requireAdminUser();
  const { id } = await params;

  let member: Member | null = null;
  let promises: PromiseRow[] = [];
  let payments: PaymentRow[] = [];
  let stats = {
    totalAmount: 0,
    paymentCount: 0,
    activePromiseCount: 0,
    unpaidAmount: 0,
    unpaidCount: 0,
  };
  let accountState: Awaited<ReturnType<typeof resolveAccountStatesBatch>> extends Map<string, infer V> ? V : never = {
    state: "unlinked" as const,
    lastInviteSentAt: null,
  };

  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    const { data: memberData } = await supabase
      .from("members")
      .select("*")
      .eq("id", id)
      .eq("org_id", tenant.id)
      .maybeSingle();

    if (!memberData) notFound();
    member = memberData as Member;

    const [promisesRes, paymentsRes, stateMap] = await Promise.all([
      supabase
        .from("promises")
        .select(
          "id, promise_code, type, amount, pay_day, pay_method, status, started_at, ended_at, toss_billing_key, campaigns(id, title)"
        )
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, payment_code, amount, pay_date, pay_status, income_status, pg_method, pay_method, campaigns(id, title), promises(toss_billing_key)"
        )
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("pay_date", { ascending: false })
        .limit(100),
      resolveAccountStatesBatch(supabase, [
        { id: member.id, supabase_uid: member.supabase_uid },
      ]),
    ]);

    promises = (promisesRes.data as unknown as PromiseRow[]) ?? [];
    payments = (paymentsRes.data as unknown as PaymentRow[]) ?? [];
    accountState = stateMap.get(member.id) ?? accountState;

    const paidPayments = payments.filter((p) => p.pay_status === "paid");
    const unpaidPayments = payments.filter((p) =>
      p.pay_status === "unpaid" || p.pay_status === "failed"
    );
    stats = {
      totalAmount: paidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      paymentCount: paidPayments.length,
      activePromiseCount: promises.filter((p) => p.status === "active").length,
      unpaidAmount: unpaidPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      ),
      unpaidCount: unpaidPayments.length,
    };
  } catch {
    notFound();
  }

  if (!member) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/members" className="text-sm text-[var(--muted-foreground)]">
          ← 후원자 목록
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span className="font-mono text-sm text-[var(--muted-foreground)]">
          {member.member_code}
        </span>
        <h1 className="text-2xl font-bold text-[var(--text)]">{member.name}</h1>
        <MemberStatusBadge status={member.status} />
        <AccountStateBadge state={accountState.state} />
        <div className="ml-auto flex items-center gap-2">
          {accountState.state !== "linked" && member.email && (
            <InviteButton
              memberId={member.id}
              lastSentAt={accountState.lastInviteSentAt}
            />
          )}
          {accountState.state !== "linked" && !member.email && (
            <span className="text-xs text-[var(--muted-foreground)]">
              이메일 없음 · 초대 불가
            </span>
          )}
          <ManualPaymentDialog
            memberId={member.id}
            memberName={member.name}
            trigger={
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] border-[var(--border)] text-[var(--text)] bg-[var(--surface)]"
              >
                수기 납부 기록
              </button>
            }
          />
          <a
            href={`/api/admin/receipts/${member.id}?year=${new Date().getFullYear()}`}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] border-[var(--border)] text-[var(--text)] bg-[var(--surface)]"
            download
          >
            영수증 발급
          </a>
        </div>
      </div>

      {/* 요약 카드 5개: 총납입/건수/활성약정/미납액/미납건수 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="총 납입액" value={formatAmount(stats.totalAmount)} />
        <StatCard label="납입 건수" value={`${stats.paymentCount.toLocaleString("ko-KR")}건`} />
        <StatCard label="활성 약정 수" value={`${stats.activePromiseCount.toLocaleString("ko-KR")}건`} />
        <StatCard
          label="미납액"
          value={formatAmount(stats.unpaidAmount)}
          highlight={stats.unpaidCount > 0}
        />
        <StatCard
          label="미납 건수"
          value={`${stats.unpaidCount.toLocaleString("ko-KR")}건`}
          highlight={stats.unpaidCount > 0}
        />
      </div>

      {/* 탭 구조 */}
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="bg-[var(--surface-2)] border border-[var(--border)]">
          <TabsTrigger value="basic">기본정보</TabsTrigger>
          <TabsTrigger value="payment-info">결제정보</TabsTrigger>
          <TabsTrigger value="payments">납입이력</TabsTrigger>
          <TabsTrigger value="consultations">상담이력</TabsTrigger>
        </TabsList>

        {/* 기본정보 탭 */}
        <TabsContent value="basic">
          <div className="mb-4 rounded-lg border p-4 border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--muted-foreground)] mb-1.5">
                  계정 상태
                </div>
                <div className="flex items-center gap-2">
                  <AccountStateBadge state={accountState.state} />
                  <span className="text-sm text-[var(--text)]">
                    {accountState.state === "linked"
                      ? "로그인 연결됨"
                      : accountState.state === "invited"
                        ? "초대 메일 발송됨"
                        : accountState.state === "invite_expired"
                          ? "초대 만료 — 재발송 가능"
                          : "로그인 계정 미연결"}
                  </span>
                </div>
                {accountState.lastInviteSentAt && (
                  <div className="text-xs mt-1.5 text-[var(--muted-foreground)]">
                    최근 초대 메일: {formatDate(accountState.lastInviteSentAt)}
                  </div>
                )}
              </div>
              {accountState.state !== "linked" && member.email && (
                <InviteButton
                  memberId={member.id}
                  lastSentAt={accountState.lastInviteSentAt}
                />
              )}
            </div>
          </div>
          <MemberEditForm member={member} />
        </TabsContent>

        {/* 결제정보 탭 (약정 목록 + 결제수단) */}
        <TabsContent value="payment-info">
          <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-medium text-[var(--muted-foreground)]">약정 내역</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead className="text-[var(--muted-foreground)]">약정코드</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">캠페인</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">유형</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">금액</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">납입일</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제수단</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">기간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promises.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                      약정 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  promises.map((p) => (
                    <TableRow key={p.id} className="border-[var(--border)]">
                      <TableCell className="font-mono text-sm text-[var(--muted-foreground)]">
                        {p.promise_code}
                      </TableCell>
                      <TableCell className="text-[var(--text)]">
                        {p.campaigns?.title ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--muted-foreground)]">
                        {PROMISE_TYPE_LABEL[p.type]}
                      </TableCell>
                      <TableCell className="text-[var(--text)]">
                        {formatAmount(p.amount)}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--muted-foreground)]">
                        {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--muted-foreground)]">
                        {p.pay_method}
                        {p.toss_billing_key ? " (자동)" : ""}
                      </TableCell>
                      <TableCell><PromiseStatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-sm text-[var(--muted-foreground)]">
                        {p.started_at ? formatDate(p.started_at) : "-"}
                        {p.ended_at ? ` ~ ${formatDate(p.ended_at)}` : " ~"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 납입이력 탭 */}
        <TabsContent value="payments">
          <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead className="text-[var(--muted-foreground)]">결제코드</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">캠페인</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">금액</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제일</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">납부상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">수입상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제수단</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-right">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                      납입 내역이 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((p) => {
                    const retryable =
                      (p.pay_status === "failed" || p.pay_status === "unpaid") &&
                      !!p.promises?.toss_billing_key;
                    return (
                      <TableRow key={p.id} className="border-[var(--border)]">
                        <TableCell className="font-mono text-sm text-[var(--muted-foreground)]">
                          {p.payment_code}
                        </TableCell>
                        <TableCell className="text-[var(--text)]">
                          {p.campaigns?.title ?? "-"}
                        </TableCell>
                        <TableCell className="text-[var(--text)]">
                          {formatAmount(p.amount)}
                        </TableCell>
                        <TableCell className="text-sm text-[var(--muted-foreground)]">
                          {formatDate(p.pay_date)}
                        </TableCell>
                        <TableCell><PayStatusBadge status={p.pay_status} /></TableCell>
                        <TableCell>
                          <Badge className="border-0 font-medium bg-[rgba(136,136,170,0.15)] text-[var(--muted-foreground)]">
                            {INCOME_STATUS_LABEL[p.income_status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-[var(--muted-foreground)]">
                          {p.pg_method ?? p.pay_method ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {retryable ? <RetryButton paymentId={p.id} /> : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* 상담이력 탭 */}
        <TabsContent value="consultations">
          <MemberConsultations memberId={member.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: highlight ? "var(--warning)" : "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="text-sm mb-1 text-[var(--muted-foreground)]">{label}</div>
      <div
        className="text-xl font-semibold"
        style={{ color: highlight ? "var(--warning)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}
