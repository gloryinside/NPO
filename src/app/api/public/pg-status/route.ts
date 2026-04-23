import { NextResponse } from "next/server";
import { getPgStatus } from "@/lib/billing/pg-outage";

/**
 * G-D195: 공개 PG status — 기부 wizard에서 위젯이 polling 하여
 * degraded 시 "가상계좌로 전환" 안내 모달 표시.
 *
 * 미인증 접근 허용 (읽기 전용 통계).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const s = getPgStatus();
  return NextResponse.json(
    {
      ...s,
      suggestion: s.degraded
        ? "Toss 결제에 일시적인 지연이 있습니다. 가상계좌/계좌이체로 전환을 권장합니다."
        : null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
