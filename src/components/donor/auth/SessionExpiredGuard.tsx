"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/layer";
import { Button } from "@/components/ui/button";

/**
 * G-D47/D48: 세션 만료(401) 및 CSRF(403) 감지 + 사용자 친화 안내
 *
 * 전역 fetch 를 감싸서 /api/donor/* 응답이:
 *   - 401 → 세션 만료 모달 + 3초 후 로그인
 *   - 403 CSRF_FORBIDDEN → 새로고침 안내 모달
 *
 * 한 번 감지되면 중복 감지를 막아 다른 요청으로 모달 재오픈되지 않게 한다.
 */
export function SessionExpiredGuard() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "expired" | "csrf">("idle");
  const stateRef = useRef<"idle" | "expired" | "csrf">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origFetch = window.fetch;

    async function patched(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const res = await origFetch(input, init);

      if (stateRef.current !== "idle") return res;
      if (res.status !== 401 && res.status !== 403) return res;

      // 주소가 donor API 인지 확인
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (!url.includes("/api/donor/")) return res;
      // 세션 bump 엔드포인트 자체의 401 은 무시 (조용히 실패)
      if (url.includes("/api/donor/session/bump")) return res;

      if (res.status === 401) {
        stateRef.current = "expired";
        setState("expired");
        return res;
      }

      // 403 → CSRF 여부 확인 (body peek)
      try {
        const cloned = res.clone();
        const data = (await cloned.json().catch(() => null)) as
          | { code?: string }
          | null;
        if (data?.code === "CSRF_FORBIDDEN") {
          stateRef.current = "csrf";
          setState("csrf");
        }
      } catch {
        // no-op
      }
      return res;
    }

    window.fetch = patched;
    return () => {
      window.fetch = origFetch;
    };
  }, []);

  useEffect(() => {
    if (state !== "expired") return;
    const t = setTimeout(() => {
      router.push("/donor/login?reason=expired");
    }, 3000);
    return () => clearTimeout(t);
  }, [state, router]);

  if (state === "idle") return null;

  const loginHref = "/donor/login?reason=expired";
  const content =
    state === "expired"
      ? {
          icon: "🕐",
          title: "세션이 만료되었습니다",
          body: "30분 이상 활동이 없어 자동 로그아웃됐습니다. 잠시 후 로그인 페이지로 이동합니다.",
          cta: { label: "지금 로그인", onClick: () => router.push(loginHref) },
        }
      : {
          icon: "⚠️",
          title: "요청이 거부되었습니다",
          body: "보안 검증에 실패했습니다. 페이지를 새로고침한 후 다시 시도해주세요.",
          cta: { label: "새로고침", onClick: () => window.location.reload() },
        };

  // 닫을 수 없는 안내 — Esc·바깥 클릭·X 모두 막는다(onClose no-op + hideClose).
  //  - expired: 세션이 이미 끊겨 이 화면에서 할 수 있는 일이 없고, 3초 뒤 어차피 로그인으로 이동한다.
  //  - csrf: 닫아도 새로고침 전까지 요청이 계속 거부되고, stateRef 가 idle 로 돌아가지 않아 다시 안내할 수도 없다.
  // Esc 에 "지금 이동/새로고침"을 묶지 않은 것은, 닫으려던 사람에게 예상치 못한 이동이 되기 때문.
  return (
    <Modal
      open
      onClose={() => {}}
      hideClose
      size="sm"
      title={content.title}
      footer={<Button onClick={content.cta.onClick}>{content.cta.label}</Button>}
    >
      <p className="mb-2 text-3xl" aria-hidden>
        {content.icon}
      </p>
      <p className="text-[var(--muted-foreground)]">{content.body}</p>
    </Modal>
  );
}
