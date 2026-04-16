"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type Props = {
  years: number[];
  selectedYear: string;
  selectedMonth: string;
  selectedStatus: string;
};

const MONTHS = [
  { value: "", label: "전체 월" },
  { value: "1", label: "1월" },
  { value: "2", label: "2월" },
  { value: "3", label: "3월" },
  { value: "4", label: "4월" },
  { value: "5", label: "5월" },
  { value: "6", label: "6월" },
  { value: "7", label: "7월" },
  { value: "8", label: "8월" },
  { value: "9", label: "9월" },
  { value: "10", label: "10월" },
  { value: "11", label: "11월" },
  { value: "12", label: "12월" },
];

const STATUSES = [
  { value: "", label: "전체 상태" },
  { value: "paid", label: "완료" },
  { value: "unpaid", label: "미납" },
  { value: "pending", label: "대기" },
  { value: "failed", label: "실패" },
  { value: "cancelled", label: "취소" },
  { value: "refunded", label: "환불" },
];

const selectStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  borderColor: "var(--border)",
  color: "var(--text)",
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "0.375rem",
  padding: "0.375rem 0.625rem",
  fontSize: "0.875rem",
  outline: "none",
};

export function DonorPaymentsFilter({
  years,
  selectedYear,
  selectedMonth,
  selectedStatus,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // reset month when year changes
      if (key === "year") params.delete("month");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={selectedYear}
        onChange={(e) => update("year", e.target.value)}
        style={selectStyle}
        aria-label="연도 필터"
      >
        <option value="">전체 연도</option>
        {years.map((y) => (
          <option key={y} value={String(y)}>
            {y}년
          </option>
        ))}
      </select>

      <select
        value={selectedMonth}
        onChange={(e) => update("month", e.target.value)}
        disabled={!selectedYear}
        style={{
          ...selectStyle,
          opacity: selectedYear ? 1 : 0.5,
          cursor: selectedYear ? "auto" : "not-allowed",
        }}
        aria-label="월 필터"
      >
        {MONTHS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        value={selectedStatus}
        onChange={(e) => update("status", e.target.value)}
        style={selectStyle}
        aria-label="상태 필터"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
