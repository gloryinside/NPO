import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptIssueButton } from "@/components/admin/receipt-issue-button";
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

type ReceiptRow = {
  id: string;
  receipt_code: string;
  year: number;
  total_amount: number | null;
  issued_at: string | null;
  status: string | null;
};

const TABS = ["basic", "promises", "payments", "receipts", "consultations", "cheers"] as const;
type TabId = (typeof TABS)[number];

const PAY_METHOD_LABEL: Record<string, string> = {
  card: "카드",
  cms: "자동이체(CMS)",
  transfer: "계좌이체",
  virtual: "가상계좌",
  manual: "직접 받음",
  naverpay: "네이버페이",
  kakaopay: "카카오페이",
  payco: "페이코",
};
const payMethodLabel = (m: string | null | undefined) => (m ? PAY_METHOD_LABEL[m] ?? m : "-");

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

type CheerRow = {
  id: string;
  body: string;
  anonymous: boolean;
  hidden: boolean;
  published: boolean;
  created_at: string;
  featured_at: string | null;
  campaigns: { title: string | null } | null;
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
  volunteer: "자원봉사자",
  prospect: "잠재후원자",
};

const PROMISE_STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
  pending_billing: "카드 등록 대기",
};

const PROMISE_TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  paid: "결제 완료",
  unpaid: "미납",
  failed: "결제 실패",
  cancelled: "취소",
  refunded: "환불",
  pending: "결제 대기",
};

const INCOME_STATUS_LABEL: Record<IncomeStatus, string> = {
  pending: "회계 반영 전",
  processing: "회계 반영 중",
  confirmed: "회계 반영됨",
  excluded: "회계 제외",
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
  searchParams,
}: {
  params: RouteParams;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAdminUser();
  const { id } = await params;
  const { tab } = await searchParams;
  const initialTab: TabId = TABS.includes(tab as TabId) ? (tab as TabId) : "basic";

  let member: Member | null = null;
  let promises: PromiseRow[] = [];
  let payments: PaymentRow[] = [];
  let cheers: CheerRow[] = [];
  let receipts: ReceiptRow[] = [];
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

    const [promisesRes, paymentsRes, stateMap, cheerRes, receiptRes] = await Promise.all([
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
      supabase
        .from("cheer_messages")
        .select("id, body, anonymous, hidden, published, created_at, featured_at, campaigns(title)")
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("receipts")
        .select("id, receipt_code, year, total_amount, issued_at, status")
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("year", { ascending: false })
        .order("issued_at", { ascending: false })
        .limit(50),
    ]);

    promises = (promisesRes.data as unknown as PromiseRow[]) ?? [];
    payments = (paymentsRes.data as unknown as PaymentRow[]) ?? [];
    accountState = stateMap.get(member.id) ?? accountState;
    cheers = (cheerRes.data as unknown as CheerRow[]) ?? [];
    receipts = (receiptRes.data as unknown as ReceiptRow[]) ?? [];

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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="font-mono text-sm text-[var(--muted-foreground)]">
          {member.member_code}
        </span>
        <h1 className="text-2xl font-bold text-[var(--text)]">{member.name}</h1>
        <MemberStatusBadge status={member.status} />
        <AccountStateBadge state={accountState.state} />
        {(member as Member & { chargeback_risk?: boolean }).chargeback_risk && (
          <Link
            href="/admin/chargebacks"
            title="이 후원자의 카드 결제에 이의 제기가 있었어요. 다시 결제하기 전에 확인하세요."
            className="rounded-full bg-[var(--negative-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--negative)] no-underline"
          >
            카드 이의 제기 이력
          </Link>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {accountState.state !== "linked" && member.email && (
            <InviteButton
              memberId={member.id}
              lastSentAt={accountState.lastInviteSentAt}
            />
          )}
          {accountState.state !== "linked" && !member.email && (
            <span className="text-xs text-[var(--muted-foreground)]">
              이메일이 없어 로그인 초대를 보낼 수 없어요
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
                직접 받은 후원 기록
              </button>
            }
          />
          <ReceiptIssueButton
            memberId={member.id}
            year={new Date().getFullYear()}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)] border-[var(--border)] text-[var(--text)] bg-[var(--surface)] disabled:opacity-50"
          />
        </div>
      </div>

      {/* 요약 카드 5개: 후원금/횟수/정기후원/미납 금액/미납 건수 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard label="지금까지 후원금" value={formatAmount(stats.totalAmount)} />
        <StatCard label="후원 횟수" value={`${stats.paymentCount.toLocaleString("ko-KR")}번`} />
        <StatCard label="진행 중인 정기후원" value={`${stats.activePromiseCount.toLocaleString("ko-KR")}건`} />
        <StatCard
          label="미납 금액"
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
      <Tabs defaultValue={initialTab} className="w-full">
        <div className="max-w-full overflow-x-auto">
          <TabsList className="bg-[var(--surface-2)] border border-[var(--border)]">
            <TabsTrigger value="basic">기본 정보</TabsTrigger>
            <TabsTrigger value="promises">정기후원 {promises.length > 0 ? `(${promises.length})` : ""}</TabsTrigger>
            <TabsTrigger value="payments">결제 내역 {payments.length > 0 ? `(${payments.length})` : ""}</TabsTrigger>
            <TabsTrigger value="receipts">기부금영수증 {receipts.length > 0 ? `(${receipts.length})` : ""}</TabsTrigger>
            <TabsTrigger value="consultations">상담 기록</TabsTrigger>
            <TabsTrigger value="cheers">응원 메시지 {cheers.length > 0 ? `(${cheers.length})` : ""}</TabsTrigger>
          </TabsList>
        </div>

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

        {/* 정기후원 탭 (약정 목록 + 결제수단) */}
        <TabsContent value="promises">
          <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-medium text-[var(--muted-foreground)]">정기·일시 후원 약속</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead className="text-[var(--muted-foreground)]">후원 번호</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">캠페인</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">유형</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">금액</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제일</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제수단</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">기간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promises.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                      아직 후원 약속이 없어요. 후원자가 홈페이지에서 후원하면 여기에 생겨요.
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
                        {payMethodLabel(p.pay_method)}
                        {p.toss_billing_key ? " · 자동결제" : ""}
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
                  <TableHead className="text-[var(--muted-foreground)]">결제번호</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">캠페인</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">금액</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제일</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제 상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]" title="회계(ERP)에 수입으로 반영됐는지">회계 반영</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">결제수단</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-right"><span className="sr-only">작업</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-[var(--muted-foreground)]">
                      아직 결제 내역이 없어요. 직접 받은 후원은 위의 ‘직접 받은 후원 기록’으로 남길 수 있어요.
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
                          {p.pg_method ?? payMethodLabel(p.pay_method)}
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

        {/* 기부금영수증 탭 */}
        <TabsContent value="receipts">
          <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
            <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-[var(--border)]">
              <p className="text-sm text-[var(--muted-foreground)]">
                연말정산에 쓰는 기부금영수증이에요. 올해 영수증은 위의 ‘영수증 발급’으로 바로 만들 수 있어요.
              </p>
              <Link href="/admin/receipts" className="text-sm text-[var(--accent)]">
                전체 영수증 관리
              </Link>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--border)]">
                  <TableHead className="text-[var(--muted-foreground)]">연도</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">영수증 번호</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-right">금액</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">발급일</TableHead>
                  <TableHead className="text-[var(--muted-foreground)]">상태</TableHead>
                  <TableHead className="text-[var(--muted-foreground)] text-right"><span className="sr-only">내려받기</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-[var(--muted-foreground)]">
                      아직 발급한 영수증이 없어요.
                    </TableCell>
                  </TableRow>
                ) : (
                  receipts.map((r) => {
                    const valid = !r.status || r.status === "issued";
                    return (
                      <TableRow key={r.id} className="border-[var(--border)]">
                        <TableCell className="text-[var(--text)]">{r.year}년</TableCell>
                        <TableCell className="font-mono text-sm text-[var(--muted-foreground)]">{r.receipt_code}</TableCell>
                        <TableCell className="text-right text-[var(--text)]">{formatAmount(r.total_amount)}</TableCell>
                        <TableCell className="text-sm text-[var(--muted-foreground)]">{formatDate(r.issued_at)}</TableCell>
                        <TableCell className="text-sm">
                          {valid ? (
                            <span className="text-[var(--positive)]">사용 중</span>
                          ) : (
                            <span className="text-[var(--muted-foreground)]" title="다시 발급해서 새 영수증으로 바뀌었거나 취소된 영수증이에요.">
                              {r.status === "cancelled" ? "취소됨" : "새 영수증으로 바뀜"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {valid && (
                            <a
                              href={`/api/admin/receipts/${member.id}?year=${r.year}`}
                              className="text-sm text-[var(--accent)]"
                            >
                              PDF 내려받기
                            </a>
                          )}
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

        {/* 응원메시지 탭 */}
        <TabsContent value="cheers">
          {cheers.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center border-[var(--border)] text-[var(--muted-foreground)]">
              이 후원자가 남긴 응원 메시지가 없어요.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              {cheers.map((c) => {
                const statusLabel = c.hidden
                  ? "숨김"
                  : !c.published
                    ? "승인대기"
                    : "공개중";
                const statusClass = c.hidden
                  ? "text-[var(--negative)]"
                  : !c.published
                    ? "text-[var(--warning)]"
                    : "text-[var(--positive)]";
                return (
                  <li key={c.id} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>{c.campaigns?.title ?? "일반 응원"}</span>
                        <span>·</span>
                        <time>{new Date(c.created_at).toLocaleString("ko-KR")}</time>
                        {c.anonymous && <><span>·</span><span>익명</span></>}
                        {c.featured_at && (
                          <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--accent)]">
                            ⭐ 대표
                          </span>
                        )}
                      </div>
                      <span
                        className={`rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs font-medium ${statusClass}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-[var(--text)]">
                      {c.body}
                    </p>
                    <div className="mt-2 flex justify-end">
                      <a
                        href={`/admin/cheer`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        응원 메시지 관리에서 보기
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
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
