"use client";

import { useReportWebVitals } from "next/web-vitals";

/**
 * G-D122: 웹 성능 지표(Core Web Vitals) 클라이언트 수집.
 *
 * next/web-vitals 은 LCP/CLS/FID/INP/TTFB/FCP 를 개별 콜백으로 전달.
 * 프로덕션에선 /api/observability/web-vitals 로 배치 전송 → 내부 로그 수집.
 * 개발환경은 콘솔만 출력 (부하 방지).
 */
export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV !== "production") {
      if (typeof console !== "undefined") {
        console.debug("[web-vitals]", metric.name, metric.value);
      }
      return;
    }
    // Production: fire-and-forget, sendBeacon 우선
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        navigationType: metric.navigationType,
        path: window.location.pathname,
      });
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/observability/web-vitals", blob);
      } else {
        void fetch("/api/observability/web-vitals", {
          method: "POST",
          body,
          headers: { "content-type": "application/json" },
          keepalive: true,
        });
      }
    } catch {
      // no-op
    }
  });
  return null;
}
