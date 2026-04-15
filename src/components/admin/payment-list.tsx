"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PayStatus, PaymentWithRelations } from "@/types/payment";

type Props = {
  payments: PaymentWithRelations[];
  total: number;
  initialStatus: string;
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "전체" },
  { value: "paid", label: "완료" },
  { value: "pending", label: "대기" },
  { value: "failed", label: "실패" },
];

const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  paid: "완료",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환불",
  pending: "대기",
};

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

export function PaymentList({ payments, total, initialStatus }: Props) {
  const router = useRouter();

  const selectStatus = (next: string) => {
    const params = new URLSearchParams();
    if (next && next !== "all") params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `/admin/payments?${qs}` : "/admin/payments");
  };

  const handleRowClick = (p: PaymentWithRelations) => {
    if (p.receipt_url) {
      window.open(p.receipt_url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          납입 관리
        </h1>
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          총 {total.toLocaleString("ko-KR")}건
        </div>
      </div>

      <div className="flex gap-1 mb-4">
        {STATUS_TABS.map((tab) => {
          const isActive = initialStatus === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => selectStatus(tab.value)}
              className="px-3 py-1.5 text-sm rounded-md border transition-colors"
              style={{
                background: isActive ? "var(--accent)" : "var(--surface-2)",
                borderColor: isActive ? "var(--accent)" : "var(--border)",
                color: isActive ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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
                후원자
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
                결제방법
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  납입 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  style={{
                    borderColor: "var(--border)",
                    cursor: p.receipt_url ? "pointer" : "default",
                  }}
                  onClick={() => handleRowClick(p)}
                >
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.payment_code}
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    {p.members?.name ?? "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.campaigns?.title ?? "-"}
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
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
    </div>
  );
}
