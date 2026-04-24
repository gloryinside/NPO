"use client";

import { useEffect } from "react";

/**
 * G-D28: 후원자 포털 에러 바운더리
 *
 * 서버/클라이언트 렌더 실패 시 표시. layout.tsx 아래에 위치하므로
 * 헤더·하단 네비는 유지되고 <main> 영역만 에러 화면으로 바뀐다.
 */
export default function DonorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 프로덕션에서는 Sentry/Logflare 등으로 전송
    console.error("[donor error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <p className="text-5xl mb-4" aria-hidden="true">⚠️</p>
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text)" }}
        >
          일시적인 문제가 발생했습니다
        </h2>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          페이지를 불러오는 중 오류가 생겼습니다. 잠시 후 다시 시도해주세요.
        </p>
        {error.digest && (
          <p
            className="mt-4 font-mono text-xs"
            style={{ color: "var(--muted-foreground)" }}
          >
            오류 코드: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--accent)" }}
          >
            다시 시도
          </button>
          <a
            href="/donor"
            className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}
