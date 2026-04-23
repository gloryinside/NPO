import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { retryChargePayment } from "@/lib/payments/retry-charge";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D06 / G-D24: 후원자 본인 결제 재시도
 *
 * POST /api/donor/payments/{id}/retry
 *  - 본인 소유 payment 만 재시도 가능
 *  - 상태는 failed/unpaid 만 허용
 *  - rate limit: member 1h/3회 + payment 1d/5회 (retry-charge 내부)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // 본인 소유 검증 (tenant + member)
  const { data: row } = await supabase
    .from("payments")
    .select("id, member_id, org_id")
    .eq("id", id)
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { error: "해당 결제를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const result = await retryChargePayment({
    supabase,
    orgId: session.member.org_id,
    paymentId: id,
  });

  if (!result.ok) {
    switch (result.error) {
      case "NOT_FOUND":
        return NextResponse.json(
          { error: "결제를 찾을 수 없습니다." },
          { status: 404 }
        );
      case "INVALID_STATUS":
        return NextResponse.json(
          { error: "실패/미납 상태의 결제만 재시도할 수 있습니다." },
          { status: 400 }
        );
      case "BILLING_KEY_MISSING":
        return NextResponse.json(
          {
            error:
              "결제 수단이 등록되지 않아 재시도할 수 없습니다. 약정 페이지에서 카드를 등록해주세요.",
            code: "BILLING_KEY_MISSING",
          },
          { status: 400 }
        );
      case "RATE_LIMITED":
        return NextResponse.json(
          {
            error: "재시도 횟수 제한에 도달했습니다. 잠시 후 다시 시도해주세요.",
            retryAfterMs: result.retryAfterMs,
          },
          { status: 429 }
        );
      case "TOSS_UNAVAILABLE":
        return NextResponse.json(
          { error: "결제 서비스에 일시적인 문제가 있습니다." },
          { status: 503 }
        );
      default:
        return NextResponse.json({ error: "재시도 실패" }, { status: 500 });
    }
  }

  // ok:true → Toss 호출 완료. success 필드로 성공/실패 구분
  return NextResponse.json({
    ok: true,
    success: result.success,
    message: result.message,
  });
}
