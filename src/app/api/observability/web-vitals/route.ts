import { NextRequest, NextResponse } from "next/server";
import { reportEvent } from "@/lib/observability/report";

/**
 * G-D122: 클라이언트 Web Vitals 수집 엔드포인트.
 * sendBeacon + keepalive fetch 양쪽을 받아 structured log 로 남김.
 * 인증/CSRF 미적용 — 비인증 방문자 vitals 도 수집 대상.
 */
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
  } catch {
    // swallow
  }
  // 204: 응답 본문 없이 성공 — sendBeacon 최적
  return new NextResponse(null, { status: 204 });
}
