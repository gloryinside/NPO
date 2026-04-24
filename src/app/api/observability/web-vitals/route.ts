import { NextRequest, NextResponse } from "next/server";
import { PostHog } from "posthog-node";
import { reportEvent } from "@/lib/observability/report";

/**
 * G-D122: 클라이언트 Web Vitals 수집 엔드포인트.
 * sendBeacon + keepalive fetch 양쪽을 받아 structured log 로 남김.
 * 인증/CSRF 미적용 — 비인증 방문자 vitals 도 수집 대상.
 *
 * SP-1: PostHog 서버 side 전송 추가. 환경변수(NEXT_PUBLIC_POSTHOG_KEY)
 * 가 설정된 경우에만 활성화 — 미설정 시 기존 reportEvent 로그만 남김.
 */

const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY
  ? new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          name?: string;
          value?: number;
          rating?: string;
          id?: string;
          path?: string;
        }
      | null;
    if (!body || typeof body.name !== "string") {
      return NextResponse.json({ ok: false }, { status: 204 });
    }

    await reportEvent(`webvitals.${body.name}`, {
      domain: "webvitals",
      tags: {
        rating: body.rating ?? null,
        path: body.path ?? null,
      },
      extra: {
        value: body.value,
        id: body.id,
      },
    });

    // PostHog 전송 — /donor 경로에 한정 (mypage 성능 관찰)
    if (posthog && body.path && body.path.startsWith("/donor")) {
      posthog.capture({
        distinctId: `webvital-${body.path}`,
        event: `$web_vital_${body.name.toLowerCase()}`,
        properties: {
          value: body.value,
          rating: body.rating,
          path: body.path,
          $lib: "web-vitals-server",
        },
      });
      await posthog.flush();
    }
  } catch {
    // swallow
  }
  // 204: 응답 본문 없이 성공 — sendBeacon 최적
  return new NextResponse(null, { status: 204 });
}
