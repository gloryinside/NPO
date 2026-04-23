"use client";

import { useRouter } from "next/navigation";

/**
 * G-D52: 연말정산 요약 페이지 연도 전환 select.
 * 서버 컴포넌트는 onChange 불가 → client 분리.
 */
export function TaxYearSelect({
  years,
  value,
}: {
  years: number[];
  value: number;
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2">
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        연도
      </span>
      <select
        value={String(value)}
        onChange={(e) => router.push(`/donor/receipts/tax-summary?year=${e.target.value}`)}
        aria-label="연도 선택"
        className="rounded-md border px-2 py-1 text-sm"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
    </label>
  );
}
