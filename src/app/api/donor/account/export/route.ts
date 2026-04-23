import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * G-D62: GDPR Article 15 / 개인정보 보호법 본인확인 데이터 내보내기.
 *
 * GET /api/donor/account/export
 *  - 후원자 본인이 자신의 모든 데이터를 JSON으로 일괄 다운로드
 *  - 프로필, 약정, 납입, 영수증 메타, 응원 메시지, 감사 로그 포함
 *  - PDF 파일 자체는 별도 ZIP 엔드포인트 사용 권장
 *  - rate limit: 시간당 2회
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(
    `account:export:${session.member.id}`,
    2,
    60 * 60_000
  );
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 1시간 후 다시 시도해주세요." },
      { status: 429 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { org_id: orgId, id: memberId } = session.member;

  // 필요한 데이터 병렬 fetch
  const [
    profileRes,
    promisesRes,
    paymentsRes,
    receiptsRes,
    cheerRes,
    auditRes,
  ] = await Promise.all([
    admin
      .from("members")
      .select(
        "id, member_code, name, email, phone, birth_date, status, join_path, created_at, updated_at"
      )
      .eq("id", memberId)
      .maybeSingle(),
    admin
      .from("promises")
      .select("*")
      .eq("org_id", orgId)
      .eq("member_id", memberId),
    admin
      .from("payments")
      .select("*")
      .eq("org_id", orgId)
      .eq("member_id", memberId)
      .order("pay_date", { ascending: false }),
    admin
      .from("receipts")
      .select("id, receipt_code, year, total_amount, pdf_url, issued_at")
      .eq("org_id", orgId)
      .eq("member_id", memberId),
    admin
      .from("cheer_messages")
      .select("*")
      .eq("member_id", memberId),
    admin
      .from("member_audit_log")
      .select("action, diff, created_at")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false }),
  ]);

  const dump = {
    exported_at: new Date().toISOString(),
    org_id: orgId,
    profile: profileRes.data ?? null,
    promises: promisesRes.data ?? [],
    payments: paymentsRes.data ?? [],
    receipts: receiptsRes.data ?? [],
    cheer_messages: cheerRes.data ?? [],
    audit_log: auditRes.data ?? [],
    notes: {
      disclaimer:
        "이 파일은 본인의 요청으로 생성되었으며, 민감정보(카드번호·빌링키 원문 등)는 포함되지 않습니다.",
      pdf_note:
        "영수증 PDF 파일은 /donor/receipts 페이지에서 연도별 ZIP으로 별도 다운로드 받으실 수 있습니다.",
    },
  };

  const filename = `donor-data-${memberId.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(dump, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
