"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/layer";
import { Button } from "@/components/ui/button";

/**
 * 로그인 만료·보안 확인 실패를 감지해 쉬운 말로 알려 준다(후원자·관리자 공용).
 *
 * 전역 fetch 를 감싸서 apiPrefix 로 시작하는 요청의 응답이:
 *   - 401, 또는 로그인 화면으로 리다이렉트됨 → 로그인 만료 안내
 *   - 403 CSRF_FORBIDDEN → 새로고침 안내
 *   - 403 MFA_REQUIRED → 관리자 2단계 인증 화면으로 이동
 * 한 번 감지되면 다른 요청으로 다시 열리지 않게 한다.
 *
 * 관리자 API 일부는 페이지용 가드(requireAdminUser)를 써서 만료 시 401 대신 로그인 페이지로
 * 리다이렉트된다. fetch는 그 HTML을 200으로 받아 "알 수 없는 오류"가 됐기 때문에 리다이렉트도 본다.
 */
type Props = {
  apiPrefix: string;
  loginHref: string;
  /** 감지하지 않을 주소(예: 세션 연장 요청 자체) */
  ignore?: string[];
  /** 만료 시 몇 초 뒤 로그인 화면으로 보낼지 — 없으면 보내지 않는다 */
  autoRedirectSeconds?: number;
  /** 안내를 닫을 수 있게 할지 — 관리자는 쓰던 내용을 복사해 둘 수 있게 닫기를 허용 */
  dismissible?: boolean;
  expiredBody: string;
};

type State = "idle" | "expired" | "csrf";

function urlOf(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
}

export function SessionExpiredGuard({ apiPrefix, loginHref, ignore = [], autoRedirectSeconds, dismissible, expiredBody }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const stateRef = useRef<State>("idle");
  const [dismissed, setDismissed] = useState(false);
  const loginPath = loginHref.split("?")[0];

  useEffect(() => {
    const origFetch = window.fetch;
    const set = (s: State) => {
      stateRef.current = s;
      setState(s);
    };

    async function patched(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const res = await origFetch(input, init);
      if (stateRef.current !== "idle") return res;
      const url = urlOf(input);
      if (!url.includes(apiPrefix) || ignore.some((p) => url.includes(p))) return res;

      if (res.status === 401) {
        set("expired");
        return res;
      }
      if (res.redirected) {
        try {
          if (new URL(res.url).pathname.startsWith(loginPath)) set("expired");
        } catch {
          // no-op
        }
        return res;
      }
      if (res.status === 403) {
        const data = (await res.clone().json().catch(() => null)) as { code?: string; next?: string } | null;
        if (data?.code === "CSRF_FORBIDDEN") set("csrf");
        // 관리자 2단계 인증이 필요해짐 — 코드 입력·등록 화면으로(정해진 주소로만)
        if (data?.code === "MFA_REQUIRED" && (data.next === "/admin/mfa" || data.next === "/admin/mfa/setup")) {
          stateRef.current = "expired";
          window.location.assign(data.next);
        }
      }
      return res;
    }

    window.fetch = patched;
    return () => {
      window.fetch = origFetch;
    };
    // 설정 값은 마운트 시점 기준으로 충분하다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state !== "expired" || !autoRedirectSeconds) return;
    const t = setTimeout(() => router.push(loginHref), autoRedirectSeconds * 1000);
    return () => clearTimeout(t);
  }, [state, router, loginHref, autoRedirectSeconds]);

  if (state === "idle" || dismissed) return null;

  const content =
    state === "expired"
      ? {
          icon: "🕐",
          title: "로그인이 만료되었어요",
          body: expiredBody,
          cta: { label: "다시 로그인", onClick: () => router.push(loginHref) },
        }
      : {
          icon: "⚠️",
          title: "요청이 거부되었어요",
          body: "보안 확인에 실패했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
          cta: { label: "새로고침", onClick: () => window.location.reload() },
        };

  // dismissible이 아니면 닫을 수 없다(Esc·바깥 클릭·X 모두 막음):
  //  만료 상태에서는 이 화면에서 할 수 있는 일이 없고, CSRF 상태는 새로고침 전까지 요청이 계속 거부된다.
  const canClose = dismissible === true;
  return (
    <Modal
      open
      onClose={canClose ? () => setDismissed(true) : () => {}}
      hideClose={!canClose}
      size="sm"
      title={content.title}
      footer={
        <>
          {canClose && (
            <Button variant="outline" onClick={() => setDismissed(true)}>
              닫기
            </Button>
          )}
          <Button onClick={content.cta.onClick}>{content.cta.label}</Button>
        </>
      }
    >
      <p className="mb-2 text-3xl" aria-hidden>
        {content.icon}
      </p>
      <p className="text-[var(--muted-foreground)]">{content.body}</p>
    </Modal>
  );
}
