import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";
import {
  regenerateBackupCodes,
  countUnusedBackupCodes,
} from "@/lib/auth/backup-codes";

/**
 * SP-5 / 연기 항목 C: TOTP MFA 풀 플로우
 *
 * - GET: 현재 등록된 verified totp factor 목록과 enabled 여부를 반환
 * - POST { action: "enroll" }: 새 unverified factor 생성 → QR 코드/secret 반환
 * - POST { action: "verify", factorId, code }: challengeAndVerify로 단일 스텝 확인
 *   성공 시 members.mfa_enabled = true로 캐시 동기화
 * - POST { action: "unenroll", factorId }: 해제 + 캐시 false
 *
 * 제한: authMethod === 'supabase' 인 사용자만. OTP 사용자는 401 미지원.
 */

const ENROLL_FRIENDLY_NAME = "Authenticator";

async function unsupportedForOtp() {
  return NextResponse.json(
    {
      error:
        "2단계 인증은 이메일/비밀번호 로그인 사용자만 사용할 수 있습니다.",
      code: "OTP_MFA_UNSUPPORTED",
    },
    { status: 400 },
  );
}

export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.authMethod !== "supabase") {
    return NextResponse.json({
      enabled: false,
      factors: [],
      isOtp: true,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totpFactors = (data?.totp ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name ?? null,
    created_at: f.created_at,
  }));

  const admin = createSupabaseAdminClient();
  const backupCount =
    totpFactors.length > 0
      ? await countUnusedBackupCodes(admin, session.member.id)
      : 0;

  return NextResponse.json({
    enabled: totpFactors.length > 0,
    factors: totpFactors,
    isOtp: false,
    backup_codes_remaining: backupCount,
  });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.authMethod !== "supabase") {
    return unsupportedForOtp();
  }

  const rl = enforceDonorLimit(session.member.id, "account:mfa", "sensitive");
  if (!rl.allowed) return limitResponse(rl);

  let body: {
    action?: unknown;
    factorId?: unknown;
    code?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // ── enroll: unverified factor 생성 + QR/secret 반환 ────
  if (action === "enroll") {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: ENROLL_FRIENDLY_NAME,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    });
  }

  // ── verify: enroll 직후 1회 코드로 활성화 (challengeAndVerify) ──
  if (action === "verify") {
    const factorId =
      typeof body.factorId === "string" ? body.factorId : "";
    const code = typeof body.code === "string" ? body.code : "";
    if (!factorId || !code) {
      return NextResponse.json(
        { error: "factorId와 code가 필요합니다." },
        { status: 400 },
      );
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) {
      return NextResponse.json(
        { error: "인증 코드가 올바르지 않습니다." },
        { status: 400 },
      );
    }

    // 캐시 동기화
    await admin
      .from("members")
      .update({ mfa_enabled: true })
      .eq("id", session.member.id);

    // 백업 코드 10개 생성 후 평문을 응답에 1회 노출
    let backupCodes: string[] = [];
    try {
      backupCodes = await regenerateBackupCodes(admin, session.member.id);
    } catch {
      // 백업 코드 생성 실패는 MFA 활성화 자체를 막지 않음 — 사용자는 나중에 재생성 가능
    }

    return NextResponse.json({
      ok: true,
      enabled: true,
      backup_codes: backupCodes,
    });
  }

  // ── unenroll: 해제 ─────────────────────────────────
  if (action === "unenroll") {
    const factorId =
      typeof body.factorId === "string" ? body.factorId : "";
    if (!factorId) {
      return NextResponse.json(
        { error: "factorId가 필요합니다." },
        { status: 400 },
      );
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 다른 verified factor가 남아있는지 확인 후 캐시 갱신
    const { data: remaining } = await supabase.auth.mfa.listFactors();
    const stillEnabled = (remaining?.totp ?? []).length > 0;
    await admin
      .from("members")
      .update({ mfa_enabled: stillEnabled })
      .eq("id", session.member.id);

    // MFA 완전 해제 시 미사용 백업 코드도 제거 — 사용된 이력은 보존
    if (!stillEnabled) {
      await admin
        .from("member_mfa_backup_codes")
        .delete()
        .eq("member_id", session.member.id)
        .is("used_at", null);
    }

    return NextResponse.json({ ok: true, enabled: stillEnabled });
  }

  // ── regenerate_backup: 백업 코드 재생성 ─────────────
  if (action === "regenerate_backup") {
    // MFA 활성 상태여야 함
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    if (!factorsData?.totp || factorsData.totp.length === 0) {
      return NextResponse.json(
        {
          error: "2단계 인증을 먼저 활성화해 주세요.",
          code: "MFA_NOT_ENABLED",
        },
        { status: 400 },
      );
    }

    // 민감 작업 — 현재 세션이 aal2 인지 확인
    const { data: aalData } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel !== "aal2") {
      return NextResponse.json(
        {
          error: "백업 코드 재생성은 2단계 인증 완료 후 가능합니다.",
          code: "AAL2_REQUIRED",
        },
        { status: 403 },
      );
    }

    try {
      const backupCodes = await regenerateBackupCodes(
        admin,
        session.member.id,
      );
      return NextResponse.json({ ok: true, backup_codes: backupCodes });
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "백업 코드 재생성에 실패했습니다.",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      error:
        "action 은 enroll | verify | unenroll | regenerate_backup 중 하나여야 합니다.",
    },
    { status: 400 },
  );
}
