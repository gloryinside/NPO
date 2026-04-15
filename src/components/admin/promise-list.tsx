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
import type {
  PromiseStatus,
  PromiseType,
  PromiseWithRelations,
} from "@/types/promise";

type Props = {
  promises: PromiseWithRelations[];
  total: number;
  initialStatus: string;
};

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: "active", label: "진행중" },
  { value: "suspended", label: "일시중지" },
  { value: "completed", label: "완료" },
  { value: "cancelled", label: "해지" },
  { value: "all", label: "전체" },
];

const STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
};

const TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

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
      {STATUS_LABEL[status]}
    </Badge>
  );
}

function PromiseTypeBadge({ type }: { type: PromiseType }) {
  const styles: Record<PromiseType, React.CSSProperties> = {
    regular: { background: "rgba(56,189,248,0.15)", color: "var(--info)" },
    onetime: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
  };
  return (
    <Badge style={styles[type]} className="border-0 font-medium">
      {TYPE_LABEL[type]}
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

export function PromiseList({ promises, total, initialStatus }: Props) {
  const router = useRouter();

  const selectStatus = (next: string) => {
    const params = new URLSearchParams();
    if (next && next !== "active") params.set("status", next);
    const qs = params.toString();
    router.replace(qs ? `/admin/promises?${qs}` : "/admin/promises");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          약정 관리
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
                약정코드
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                후원자
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
                시작일
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                상태
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promises.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  약정 내역이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              promises.map((p) => (
                <TableRow
                  key={p.id}
                  style={{
                    borderColor: "var(--border)",
                    cursor: p.member_id ? "pointer" : "default",
                  }}
                  onClick={() => {
                    if (p.member_id) {
                      router.push(`/admin/members/${p.member_id}`);
                    }
                  }}
                >
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {p.promise_code}
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
                  <TableCell>
                    <PromiseTypeBadge type={p.type} />
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
                    {p.pay_day ? `매월 ${p.pay_day}일` : "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(p.started_at)}
                  </TableCell>
                  <TableCell>
                    <PromiseStatusBadge status={p.status} />
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
