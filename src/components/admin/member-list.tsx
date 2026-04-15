"use client";

import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import type { Member, MemberStatus } from "@/types/member";

type Props = {
  members: Member[];
  total: number;
  initialQuery: string;
  initialStatus: string;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "deceased", label: "사망" },
  { value: "all", label: "전체" },
];

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "활성",
  inactive: "비활성",
  deceased: "사망",
};

function StatusBadge({ status }: { status: MemberStatus }) {
  const styles: Record<MemberStatus, React.CSSProperties> = {
    active: {
      background: "rgba(34,197,94,0.15)",
      color: "var(--positive)",
    },
    inactive: {
      background: "rgba(136,136,170,0.15)",
      color: "var(--muted-foreground)",
    },
    deceased: {
      background: "rgba(239,68,68,0.15)",
      color: "var(--negative)",
    },
  };
  return (
    <Badge style={styles[status]} className="border-0 font-medium">
      {STATUS_LABELS[status]}
    </Badge>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

export function MemberList({
  members,
  total,
  initialQuery,
  initialStatus,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const buildUrl = (nextQuery: string, nextStatus: string) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextStatus && nextStatus !== "active") params.set("status", nextStatus);
    const qs = params.toString();
    return qs ? `/admin/members?${qs}` : "/admin/members";
  };

  useEffect(() => {
    // 최초 mount에서는 동기화만 하고 라우팅하지 않음
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildUrl(query, status));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          후원자 관리
        </h1>
        <div
          className="text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          총 {total.toLocaleString("ko-KR")}명
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[240px] max-w-md">
          <Input
            placeholder="이름, 연락처, 이메일로 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatus(opt.value)}
                className="px-3 py-1.5 text-sm rounded-md border transition-colors"
                style={{
                  background: isActive ? "var(--accent)" : "var(--surface-2)",
                  borderColor: isActive ? "var(--accent)" : "var(--border)",
                  color: isActive ? "#fff" : "var(--muted-foreground)",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: "var(--border)" }}>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                회원코드
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                이름
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                연락처
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                이메일
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                상태
              </TableHead>
              <TableHead style={{ color: "var(--muted-foreground)" }}>
                등록일
              </TableHead>
              <TableHead
                style={{ color: "var(--muted-foreground)" }}
                className="text-right"
              >
                액션
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center py-12"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  등록된 후원자가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              members.map((m) => (
                <TableRow
                  key={m.id}
                  style={{ borderColor: "var(--border)", cursor: "pointer" }}
                  onClick={() => router.push(`/admin/members/${m.id}`)}
                >
                  <TableCell
                    className="font-mono text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {m.member_code}
                  </TableCell>
                  <TableCell
                    className="font-medium"
                    style={{ color: "var(--text)" }}
                  >
                    {m.name}
                  </TableCell>
                  <TableCell style={{ color: "var(--text)" }}>
                    {m.phone ?? "-"}
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {m.email ?? "-"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={m.status} />
                  </TableCell>
                  <TableCell
                    className="text-sm"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(m.created_at)}
                  </TableCell>
                  <TableCell
                    className="text-right text-sm"
                    style={{ color: "var(--accent)" }}
                  >
                    상세 →
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
