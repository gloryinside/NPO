import { NextResponse } from "next/server";

/**
 * G-D187: Readiness probe.
 *   - 배포 시 `SHUTTING_DOWN=1` 환경변수를 설정하면 503 반환하여 load balancer 가 트래픽 전환.
 *   - 일반 상태 검사는 /api/health (liveness) 사용.
 */
export async function GET() {
  if (process.env.SHUTTING_DOWN === "1") {
    return NextResponse.json(
      { status: "draining" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  return NextResponse.json(
    { status: "ready" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
