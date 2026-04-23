"use client";

import { useState } from "react";

/**
 * G-D34: 납입내역 CSV 내보내기 날짜 범위 선택 UI
 *
 * - 기본은 상위 필터(year/month/status) 유지
 * - "커스텀 날짜 범위" 토글 시 from/to 입력 노출
 * - from/to 가 지정되면 year/month 는 API 측에서 무시됨
 */
export function PaymentsExportBar({
  year,
  month,
  status,
}: {
  year: string;
  month: string;
  status: string;
}) {
  const [custom, setCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams();
  if (custom) {
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  } else {
    if (year) params.set("year", year);
    if (month) params.set("month", month);
  }
  if (status) params.set("status", status);

  const href = `/api/donor/payments/export?${params.toString()}`;
  const canExport = custom ? Boolean(from || to) : true;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setCustom((v) => !v)}
        aria-pressed={custom}
        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{
          borderColor: "var(--border)",
          background: custom ? "var(--accent-soft)" : "var(--surface-2)",
          color: custom ? "var(--accent)" : "var(--muted-foreground)",
        }}
      >
        {custom ? "📅 범위 지정 중" : "📅 커스텀 범위"}
      </button>

      {custom && (
        <>
          <label className="sr-only" htmlFor="export-from">
            시작일
          </label>
          <input
            id="export-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
            }}
          />
          <span
            className="text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            ~
          </span>
          <label className="sr-only" htmlFor="export-to">
            종료일
          </label>
          <input
            id="export-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border px-2 py-1.5 text-xs outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
            }}
          />
        </>
      )}

      <a
        href={canExport ? href : undefined}
        aria-disabled={canExport ? undefined : "true"}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
        style={{
          borderColor: "var(--accent)",
          background: canExport ? "var(--accent-soft)" : "var(--surface-2)",
          color: canExport ? "var(--accent)" : "var(--muted-foreground)",
          textDecoration: "none",
          pointerEvents: canExport ? "auto" : "none",
          opacity: canExport ? 1 : 0.5,
        }}
      >
        📥 CSV 내보내기
      </a>
    </div>
  );
}
