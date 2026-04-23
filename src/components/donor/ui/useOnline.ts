"use client";

import { useEffect, useState } from "react";

/**
 * G-D49: 클라이언트 온라인 상태 구독 훅.
 * SSR 안전: 초기 렌더에서 true 반환하여 깜빡임 방지, 마운트 후 실제 값으로 보정.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    function up() {
      setOnline(true);
    }
    function down() {
      setOnline(false);
    }
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}
