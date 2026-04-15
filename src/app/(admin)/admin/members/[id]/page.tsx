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
import type { Member, MemberStatus, MemberType } from "@/types/member";
import type { PromiseStatus, PromiseType } from "@/types/promise";
import type { PayStatus } from "@/types/payment";

type RouteParams = Promise<{ id: string }>;

type PromiseRow = {
  id: string;
  promise_code: string;
  type: PromiseType;
  amount: number;
  pay_day: number | null;
  status: PromiseStatus;
  started_at: string | null;
  ended_at: string | null;
  campaigns: { id: string; title: string } | null;
};

type PaymentRow = {
  id: string;
  payment_code: string;
  amount: number;
  pay_date: string | null;
  pay_status: PayStatus;
  pg_method: string | null;
  campaigns: { id: string; title: string } | null;
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
  refunded: "환불",
  pending: "대기",
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
    active: { background: "rgba(34,197,94,0.15)", color: "var(--positive)" },
    inactive: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    deceased: { background: "rgba(239,68,68,0.15)", color: "var(--negative)" },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {MEMBER_STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseStatusBadge({ status }: { status: PromiseStatus }) {
  const styles: Record<PromiseStatus, React.CSSProperties> = {
    active: { background: "rgba(34,197,94,0.15)", color: "var(--positive)" },
    suspended: { background: "rgba(245,158,11,0.15)", color: "var(--warning)" },
    cancelled: { background: "rgba(239,68,68,0.15)", color: "var(--negative)" },
    completed: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {PROMISE_STATUS_LABEL[status]}
    </Badge>
  );
}

function PayStatusBadge({ status }: { status: PayStatus }) {
  const styles: Record<PayStatus, React.CSSProperties> = {
    paid: { background: "rgba(34,197,94,0.15)", color: "var(--positive)" },
    pending: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    unpaid: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    failed: { background: "rgba(239,68,68,0.15)", color: "var(--negative)" },
    cancelled: {
      background: "rgba(239,68,68,0.15)",
      color: "var(--negative)",
    },
    refunded: { background: "rgba(245,158,11,0.15)", color: "var(--warning)" },
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
  let stats = { totalAmount: 0, paymentCount: 0, activePromiseCount: 0 };

  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();

    const { data: memberData } = await supabase
      .from("members")
      .select("*")
      .eq("id", id)
      .eq("org_id", tenant.id)
      .maybeSingle();

    if (!memberData) {
      notFound();
    }
    member = memberData as Member;

    const [promisesRes, paymentsRes] = await Promise.all([
      supabase
        .from("promises")
        .select(
          "id, promise_code, type, amount, pay_day, status, started_at, ended_at, campaigns(id, title)"
        )
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, payment_code, amount, pay_date, pay_status, pg_method, campaigns(id, title)"
        )
        .eq("org_id", tenant.id)
        .eq("member_id", id)
        .order("pay_date", { ascending: false })
        .limit(100),
    ]);

    promises = (promisesRes.data as unknown as PromiseRow[]) ?? [];
    payments = (paymentsRes.data as unknown as PaymentRow[]) ?? [];

    const paidPayments = payments.filter((p) => p.pay_status === "paid");
    stats = {
      totalAmount: paidPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      ),
      paymentCount: paidPayments.length,
      activePromiseCount: promises.filter((p) => p.status === "active").length,
    };
  } catch {
    notFound();
  }

  if (!member) {
    notFound();
  }

  const infoRows: Array<{ label: string; value: React.ReactNode }> = [
    { label: "연락처", value: member.phone ?? "-" },
    { label: "이메일", value: member.email ?? "-" },
    { label: "생년월일", value: formatDate(member.birth_date) },
    { label: "회원유형", value: MEMBER_TYPE_LABEL[member.member_type] },
    { label: "가입경로", value: member.join_path ?? "-" },
    { label: "메모", value: member.note ?? "-" },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/members"
          className="text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          ← 후원자 목록
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <span
          className="font-mono text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {member.member_code}
        </span>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          {member.name}
        </h1>
        <MemberStatusBadge status={member.status} />
        <a
          href={`/api/admin/receipts/${member.id}?year=${new Date().getFullYear()}`}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--muted)]"
          style={{
            borderColor: "var(--border)",
            color: "var(--text)",
            background: "var(--surface)",
          }}
          download
        >
          영수증 발급
        </a>
      </div>

      <div
        className="rounded-lg border p-6 mb-6"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <h2
          className="text-sm font-medium mb-4"
          style={{ color: "var(--muted-foreground)" }}
        >
          기본 정보
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {infoRows.map((row) => (
            <div key={row.label} className="flex gap-4">
              <div
                className="w-20 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {row.label}
              </div>
              <div className="text-sm" style={{ color: "var(--text)" }}>
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="총 납입액" value={formatAmount(stats.totalAmount)} />
        <StatCard
          label="납입 건수"
          value={`${stats.paymentCount.toLocaleString("ko-KR")}건`}
        />
        <StatCard
          label="활성 약정 수"
          value={`${stats.activePromiseCount.toLocaleString("ko-KR")}건`}
        />
      </div>

      <section className="mb-8">
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "var(--text)" }}
        >
          약정 내역
        </h2>
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "var(--border)" }}>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  약정코드
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  캠페인
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  유형
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  금액
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  납입일
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  상태
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  기간
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promises.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    약정 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                promises.map((p) => (
                  <TableRow
                    key={p.id}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <TableCell
                      className="font-mono text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {p.promise_code}
                    </TableCell>
                    <TableCell style={{ color: "var(--text)" }}>
                      {p.campaigns?.title ?? "-"}
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {PROMISE_TYPE_LABEL[p.type]}
                    </TableCell>
                    <TableCell style={{ color: "var(--text)" }}>
                      {formatAmount(p.amount)}
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
                    </TableCell>
                    <TableCell>
                      <PromiseStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {p.started_at ? formatDate(p.started_at) : "-"}
                      {p.ended_at ? ` ~ ${formatDate(p.ended_at)}` : " ~"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2
          className="text-lg font-semibold mb-3"
          style={{ color: "var(--text)" }}
        >
          최근 납입 내역
          <span
            className="ml-2 text-sm font-normal"
            style={{ color: "var(--muted-foreground)" }}
          >
            (최대 100건)
          </span>
        </h2>
        <div
          className="rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: "var(--border)" }}>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  결제코드
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  캠페인
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  금액
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  결제일
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  상태
                </TableHead>
                <TableHead style={{ color: "var(--muted-foreground)" }}>
                  결제수단
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    납입 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow
                    key={p.id}
                    style={{ borderColor: "var(--border)" }}
                  >
                    <TableCell
                      className="font-mono text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {p.payment_code}
                    </TableCell>
                    <TableCell style={{ color: "var(--text)" }}>
                      {p.campaigns?.title ?? "-"}
                    </TableCell>
                    <TableCell style={{ color: "var(--text)" }}>
                      {formatAmount(p.amount)}
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {formatDate(p.pay_date)}
                    </TableCell>
                    <TableCell>
                      <PayStatusBadge status={p.pay_status} />
                    </TableCell>
                    <TableCell
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {p.pg_method ?? "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div
        className="text-sm mb-1"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
      <div className="text-xl font-semibold" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
