"use client";

import { useEffect, useState } from "react";

/**
 * G-D09 / G-D37: 모바일 "새 후원" FAB
 *
 * 스크롤이 문서 하단 ~120px 이내로 내려가면 페이드 아웃해
 * 하단 네비바·본문 끝과 시각적 충돌을 방지.
 */
export function DonorFAB() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onScroll() {
      const { scrollY, innerHeight } = window;
      const docH = document.documentElement.scrollHeight;
      const fromBottom = docH - (scrollY + innerHeight);
      // 하단 120px 이내 → 숨김
      setHidden(fromBottom < 120);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <a
      href="/"
      aria-label="새 후원 시작하기"
      aria-hidden={hidden ? "true" : "false"}
      tabIndex={hidden ? -1 : 0}
      className="fixed right-4 z-40 inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 sm:hidden"
      style={{
        background: "var(--accent)",
        bottom: 72, // 하단 네비바 56px + 여백 16px
        textDecoration: "none",
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(12px)" : "translateY(0)",
        pointerEvents: hidden ? "none" : "auto",
      }}
    >
      ❤️ 새 후원
    </a>
  );
}
