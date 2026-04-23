/**
 * G-D21: 페이지 로딩 폴백 공용 컴포넌트
 *
 * Suspense fallback 또는 클라이언트 초기 로딩 상태에 사용.
 * - animate-pulse 스켈레톤 3개 블록
 * - 최소 높이 고정으로 레이아웃 시프트 방지
 */
export function PageLoading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div
        className="animate-pulse rounded-2xl"
        style={{
          background: "var(--surface-2)",
          height: 120,
        }}
      />
      <div
        className="animate-pulse rounded-xl"
        style={{
          background: "var(--surface-2)",
          height: 72,
        }}
      />
      <div
        className="animate-pulse rounded-xl"
        style={{
          background: "var(--surface-2)",
          height: 160,
        }}
      />
      <p
        className="text-center text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </p>
    </div>
  );
}

/**
 * 인라인(섹션 내부) 로딩 — 작은 영역에 사용.
 */
export function InlineLoading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center py-10 text-sm"
      style={{ color: "var(--muted-foreground)" }}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
