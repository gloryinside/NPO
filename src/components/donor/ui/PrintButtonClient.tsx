"use client";

/**
 * G-D52: 페이지 인쇄 버튼 (print 스타일과 함께 사용)
 */
export function PrintButtonClient({ label = "인쇄" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface-2)",
        color: "var(--text)",
      }}
    >
      🖨️ {label}
    </button>
  );
}
