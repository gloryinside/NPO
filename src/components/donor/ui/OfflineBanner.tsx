"use client";

import { useEffect, useState } from "react";

/**
 * G-D36: 오프라인/네트워크 에러 배너
 *
 * navigator.onLine 이벤트를 구독하여 끊김을 감지하면 상단에 고정 배너 노출.
 * 서버 렌더 시 `navigator` 접근 불가하므로 마운트 후에만 렌더.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true); // 기본 true — 초기 깜빡임 방지
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (!mounted || online) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed left-0 right-0 top-0 z-50 px-4 py-2 text-center text-xs font-medium"
      style={{
        background: "var(--warning-soft)",
        color: "var(--warning)",
        borderBottom: "1px solid var(--warning)",
      }}
    >
      📡 오프라인 상태입니다. 일부 기능이 제한됩니다.
    </div>
  );
}
