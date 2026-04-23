"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

  const content =
    state === "expired"
      ? {
          icon: "🕐",
          title: "세션이 만료되었습니다",
          body: "30분 이상 활동이 없어 자동 로그아웃됐습니다. 잠시 후 로그인 페이지로 이동합니다.",
          cta: { label: "지금 로그인", href: "/donor/login?reason=expired" },
        }
      : {
          icon: "⚠️",
          title: "요청이 거부되었습니다",
          body: "보안 검증에 실패했습니다. 페이지를 새로고침한 후 다시 시도해주세요.",
          cta: null,
        };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-3xl mb-3">{content.icon}</p>
        <h3 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          {content.title}
        </h3>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          {content.body}
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          {content.cta ? (
            <a
              href={content.cta.href}
              className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--accent)", textDecoration: "none" }}
            >
              {content.cta.label}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              새로고침
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
