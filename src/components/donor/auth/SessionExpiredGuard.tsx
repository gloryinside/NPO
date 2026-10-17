"use client";

import { SessionExpiredGuard as Guard } from "@/components/common/session-expired-guard";

/** 후원자 화면: 만료되면 3초 뒤 로그인으로 이동(세션 연장 요청 자체의 401은 무시) */
export function SessionExpiredGuard() {
  return (
    <Guard
      apiPrefix="/api/donor/"
      loginHref="/donor/login?reason=expired"
      ignore={["/api/donor/session/bump"]}
      autoRedirectSeconds={3}
      expiredBody="30분 이상 활동이 없어 자동으로 로그아웃됐어요. 잠시 후 로그인 화면으로 이동합니다."
    />
  );
}
