import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ memberId: string }> };

/**
 * GET /api/admin/receipts/[memberId]/rrn?receiptId=<uuid>
 *
 * 관리자 전용: 특정 영수증의 암호화된 주민등록번호(RRN)를 복호화해 반환한다.
 * - RECEIPTS_ENCRYPTION_KEY 환경변수 필요
 * - 접근 시 감사 로그 기록
 * - 보안 헤더: no-store 캐시 차단
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const admin = await requireAdminUser();

  const { memberId } = await params;
  const { searchParams } = new URL(req.url);
  const receiptId = searchParams.get("receiptId");

  if (!receiptId) {
    return NextResponse.json({ error: "receiptId 파라미터가 필요합니다." }, { status: 400 });
  }

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const encKey = process.env.RECEIPTS_ENCRYPTION_KEY;
  if (!encKey) {
    return NextResponse.json(
      { error: "RRN 복호화 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 영수증 행 조회 — org_id + member_id 으로 scope 확인
  const { data: receipt, error: receiptErr } = await supabase
    .from("receipts")
    .select("id, org_id, member_id, resident_no_encrypted, rrn_retention_expires_at")
    .eq("id", receiptId)
    .eq("org_id", tenant.id)
    .eq("member_id", memberId)
    .maybeSingle();

  if (receiptErr) {
    return NextResponse.json({ error: receiptErr.message }, { status: 500 });
  }
  if (!receipt) {
    return NextResponse.json({ error: "영수증을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = receipt as {
    id: string;
    resident_no_encrypted: string | null;
    rrn_retention_expires_at: string | null;
  };

  if (!row.resident_no_encrypted) {
    return NextResponse.json({ rrn: null, reason: "RRN이 저장되지 않았습니다." });
  }

  // 보존기간 만료 여부 확인
  if (row.rrn_retention_expires_at) {
    const expires = new Date(row.rrn_retention_expires_at);
    if (expires < new Date()) {
      return NextResponse.json({ rrn: null, reason: "보존기간이 만료되었습니다." });
    }
  }

  // DB RPC로 복호화
  const { data: decrypted, error: decErr } = await supabase.rpc("decrypt_rrn_pending", {
    ciphertext: row.resident_no_encrypted,
    passphrase: encKey,
  });

  if (decErr) {
    return NextResponse.json(
      { error: "RRN 복호화 실패: " + decErr.message },
      { status: 500 }
    );
  }

  // 감사 로그 — RRN 조회는 반드시 기록
  void logAudit({
    orgId: tenant.id,
    actorId: admin.id,
    actorEmail: admin.email ?? null,
    action: "receipt.nts_export",
    resourceType: "receipt",
    resourceId: receiptId,
    summary: `영수증 RRN 복호화 조회 (관리자: ${admin.email ?? admin.id})`,
    metadata: { memberId },
  });

  // 주민번호를 마스킹해서도 옵션으로 제공 (XXXXXX-XXXXXXX 형태)
  const raw = (decrypted as string | null) ?? "";
  const masked =
    raw.length === 13
      ? `${raw.slice(0, 6)}-${raw.slice(6, 7)}••••••`
      : raw;

  return new NextResponse(
    JSON.stringify({ rrn: raw, rrnMasked: masked }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
      },
    }
  );
}
