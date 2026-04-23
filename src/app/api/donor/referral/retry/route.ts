import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureReferralCode } from "@/lib/donor/referral";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D32: 추천 코드 발급 재시도 엔드포인트.
 *
 * ensureReferralCode 내부가 10회까지 재시도하지만, 드물게 모두 실패하면
 * 사용자에게 수동 retry 경로 제공.
 */
export async function POST(req: Request) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const result = await ensureReferralCode(
    admin,
    session.member.org_id,
    session.member.id
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: "코드 발급에 실패했습니다.", detail: result.error },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, code: result.code.code });
}
