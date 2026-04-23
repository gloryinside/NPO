import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { writeMemberAudit } from "@/lib/donor/audit-log";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";

/**
 * PATCH /api/donor/profile
 *
 * 후원자 본인이 자신의 기본 정보(이름/연락처/생년월일)를 수정.
 * email 은 로그인 계정과 연결되어 있으므로 이 엔드포인트에서는 수정 불가.
 * status / member_type 등 관리 속성도 변경 불가.
 *
 * G-D25: 변경 전/후 값을 member_audit_log 에 기록 (best-effort).
 */
export async function PATCH(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rl = enforceDonorLimit(session.member.id, "profile:patch");
  if (!rl.allowed) return limitResponse(rl);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, birthDate } = body as {
    name?: string;
    phone?: string | null;
    birthDate?: string | null;
  };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });
    }
    update.name = name.trim();
  }
  if (phone !== undefined) {
    update.phone = typeof phone === "string" ? phone.trim() || null : null;
  }
  if (birthDate !== undefined) {
    update.birth_date = birthDate && typeof birthDate === "string" ? birthDate : null;
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 감사용 before 스냅샷
  const { data: before } = await supabase
    .from("members")
    .select("name, phone, birth_date")
    .eq("id", session.member.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", session.member.id)
    .eq("org_id", session.member.org_id)
    .select("id, name, phone, email, birth_date, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 변경된 필드만 diff로 기록 (phone은 뒷자리 마스킹)
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  if (update.name !== undefined && before?.name !== update.name) {
    diff.name = { before: before?.name ?? null, after: update.name };
  }
  if (update.phone !== undefined && before?.phone !== update.phone) {
    diff.phone = {
      before: maskPhone(before?.phone ?? null),
      after: maskPhone((update.phone as string | null) ?? null),
    };
  }
  if (update.birth_date !== undefined && before?.birth_date !== update.birth_date) {
    diff.birth_date = {
      before: before?.birth_date ?? null,
      after: update.birth_date,
    };
  }

  if (Object.keys(diff).length > 0) {
    await writeMemberAudit(supabase, {
      orgId: session.member.org_id,
      memberId: session.member.id,
      action: "profile_update",
      diff,
    });
  }

  return NextResponse.json({ member: data });
}

function maskPhone(p: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length < 8) return "***";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}
