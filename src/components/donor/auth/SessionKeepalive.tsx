"use client";

import { useEffect, useRef } from "react";

/**
 * G-D30: OTP 세션 슬라이딩 갱신.
 *
 * 사용자 활동(click/key) 감지 시 5분 쿨다운으로 bump 호출.
 * - 비활성 30분 이상이면 서버에서 401 → 다음 네비게이션 시 로그인 페이지로 리다이렉트
 * - 네트워크 오류는 무시 (UX에 영향 주지 않음)
 */
const BUMP_INTERVAL_MS = 5 * 60 * 1000; // 5분

export function SessionKeepalive() {
  const lastBumpRef = useRef<number>(0);

  useEffect(() => {
    function bumpIfNeeded() {
      const now = Date.now();
      if (now - lastBumpRef.current < BUMP_INTERVAL_MS) return;
      lastBumpRef.current = now;
      fetch("/api/donor/session/bump", { method: "POST" }).catch(() => {});
    }

    // 첫 마운트 시 한 번
    bumpIfNeeded();

    window.addEventListener("click", bumpIfNeeded, { passive: true });
    window.addEventListener("keydown", bumpIfNeeded, { passive: true });

    return () => {
      window.removeEventListener("click", bumpIfNeeded);
      window.removeEventListener("keydown", bumpIfNeeded);
    };
  }, []);

  return null;
}
