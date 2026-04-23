import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";

/**
 * G-D199: 회원 병합 실행.
 *
 * POST /api/admin/members/merge
 *   body: { primaryId, duplicateIds: string[] }
 *
 * 동작:
 *   1. duplicateIds 에 속한 member 의 promises/payments/receipts/cheer_messages/referral_codes/
 *      member_audit_log 의 member_id 를 primaryId 로 재할당
 *   2. duplicateIds 는 soft-delete (status='withdrawn', PII 마스킹)
 *   3. primary 의 notes 에 "merged from: <code1>, <code2>" 추가
 *   4. audit_logs 기록
 *
 * 권한: super 또는 support. duplicateIds 최대 10개.
 * 트랜잭션 보호는 RPC 없이 순차 update — 실패 시 일부만 병합될 수 있어 로그로 복구.
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["super", "support"]))) {
    return NextResponse.json(
      { error: "super 또는 support 권한 필요" },
      { status: 403 }
    );
  }

  let body: { primaryId?: unknown; duplicateIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const primaryId =
    typeof body.primaryId === "string" ? body.primaryId : "";
  const duplicateIds = Array.isArray(body.duplicateIds)
    ? body.duplicateIds.filter((x): x is string => typeof x === "string")
    : [];
  if (!primaryId || duplicateIds.length === 0) {
    return NextResponse.json(
      { error: "primaryId 와 duplicateIds 필수" },
      { status: 400 }
    );
  }
  if (duplicateIds.includes(primaryId)) {
    return NextResponse.json(
      { error: "primaryId 가 duplicateIds 에 포함될 수 없습니다." },
      { status: 400 }
    );
  }
  if (duplicateIds.length > 10) {
    return NextResponse.json(
      { error: "한 번에 10개까지 병합 가능" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 모든 대상이 같은 org 인지 확인
  const { data: members } = await supabase
    .from("members")
    .select("id, member_code, name, note")
    .eq("org_id", tenant.id)
    .in("id", [primaryId, ...duplicateIds]);
  const rows = (members ?? []) as Array<{
    id: string;
    member_code: string | null;
    name: string | null;
    note: string | null;
  }>;
  if (rows.length !== 1 + duplicateIds.length) {
    return NextResponse.json(
      { error: "일부 member 를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  const primary = rows.find((r) => r.id === primaryId)!;
  const dups = rows.filter((r) => r.id !== primaryId);

  // 재할당할 테이블 목록
  const tables = [
    "promises",
    "payments",
    "receipts",
    "cheer_messages",
    "referral_codes",
    "member_audit_log",
    "notification_log",
  ] as const;
  const moved: Record<string, number> = {};
  for (const table of tables) {
    let total = 0;
    for (const dup of dups) {
      const { data: rows } = await supabase
        .from(table)
        .update({ member_id: primary.id })
        .eq("member_id", dup.id)
        .select("id");
      total += (rows ?? []).length;
    }
    moved[table] = total;
  }

  // duplicate 들을 withdrawn 으로 마스킹
  const now = new Date().toISOString();
  for (const dup of dups) {
    const suffix = dup.id.slice(0, 8);
    await supabase
      .from("members")
      .update({
        status: "withdrawn",
        name: `병합됨_${suffix}`,
        email: `merged+${suffix}@deleted.local`,
        phone: null,
        supabase_uid: null,
        deleted_at: now,
        updated_at: now,
      })
      .eq("id", dup.id)
      .eq("org_id", tenant.id);
  }

  // primary note 업데이트
  const mergedCodes = dups
    .map((d) => d.member_code ?? d.id.slice(0, 8))
    .join(", ");
  const newNote =
    (primary.note ? primary.note + "\n" : "") +
    `[${now.slice(0, 10)}] 병합: ${mergedCodes}`;
  await supabase.from("members").update({ note: newNote }).eq("id", primary.id);

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "member.update",
    resourceType: "member_merge",
    resourceId: primary.id,
    summary: `회원 병합 (${dups.length}건 → ${primary.member_code ?? primary.id.slice(0, 8)})`,
    metadata: {
      primaryId,
      duplicateIds,
      moved,
      mergedCodes,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, primaryId, merged: dups.length, moved });
}
