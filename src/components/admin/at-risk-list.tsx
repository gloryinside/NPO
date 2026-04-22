"use client";

import { useMemo, useState } from "react";
import type { ChurnRiskMember } from "@/lib/stats/churn-risk";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { FilterBar, FilterDropdown } from "@/components/common/filter-bar";

function formatKRW(n: number) {
  return `${new Intl.NumberFormat("ko-KR").format(n)}원`;
}

function formatDate(v: string | null) {
  if (!v) return "-";
  return v.slice(0, 10).replace(/-/g, ".");
}

type SeverityFilter = "critical" | "warning";

function severityOf(m: ChurnRiskMember): SeverityFilter {
  return m.unpaidCount >= 3 ? "critical" : "warning";
}

export function AtRiskList({ members }: { members: ChurnRiskMember[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severity, setSeverity] = useState<SeverityFilter | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !m.memberName.toLowerCase().includes(q)) return false;
      if (severity && severityOf(m) !== severity) return false;
      return true;
    });
  }, [members, searchQuery, severity]);

  const columns: DataTableColumn<ChurnRiskMember>[] = [
    {
      key: "name",
      header: "후원자",
      render: (m) => (
        <a
          href={`/admin/members/${m.memberId}`}
          className="font-medium text-[var(--text)] hover:underline"
        >
          {m.memberName}
        </a>
      ),
    },
    {
      key: "severity",
      header: "심각도",
      width: "80px",
      render: (m) => {
        const sev = severityOf(m);
        const cls =
          sev === "critical"
            ? "bg-[var(--negative-soft)] text-[var(--negative)]"
            : "bg-[var(--warning-soft)] text-[var(--warning)]";
        return (
          <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] ${cls}`}>
            {sev === "critical" ? "심각" : "주의"}
          </span>
        );
      },
    },
    {
      key: "unpaid_count",
      header: "미납 횟수",
      align: "right",
      width: "90px",
      render: (m) => (
        <span className="font-medium text-[var(--text)]">{m.unpaidCount}회</span>
      ),
    },
    {
      key: "total_unpaid",
      header: "미납 합계",
      align: "right",
      width: "130px",
      render: (m) => (
        <span className="font-medium text-[var(--negative)]">
          {formatKRW(m.totalUnpaid)}
        </span>
      ),
    },
    {
      key: "last_pay_date",
      header: "최근 미납일",
      width: "110px",
      render: (m) => (
        <span className="text-[var(--muted-foreground)]">
          {formatDate(m.lastPayDate)}
        </span>
      ),
    },
    {
      key: "contact",
      header: "연락처",
      render: (m) => (
        <div className="flex flex-col text-[11px] text-[var(--muted-foreground)]">
          {m.memberPhone && <span>{m.memberPhone}</span>}
          {m.memberEmail && <span>{m.memberEmail}</span>}
          {!m.memberPhone && !m.memberEmail && "-"}
        </div>
      ),
    },
  ];

  const hasActiveFilters = !!(searchQuery || severity);

  return (
    <div>
      <FilterBar
        searchPlaceholder="후원자명 검색"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        filters={
          <FilterDropdown
            label="심각도"
            value={severity}
            options={[
              { value: "critical", label: "심각 (3회+)" },
              { value: "warning", label: "주의 (2회)" },
            ]}
            onChange={(v) => setSeverity(v)}
          />
        }
        hasActiveFilters={hasActiveFilters}
        onReset={() => {
          setSearchQuery("");
          setSeverity(null);
        }}
      />

      <DataTable<ChurnRiskMember>
        columns={columns}
        rows={filtered}
        rowKey={(m) => m.memberId}
        emptyMessage="이탈 위험 후원자가 없습니다."
        rowActions={(m) => (
          <a
            href={`/admin/members/${m.memberId}`}
            className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--text)] hover:bg-[var(--surface)]"
          >
            프로필
          </a>
        )}
      />
    </div>
  );
}
