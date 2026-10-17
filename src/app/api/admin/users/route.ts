import { adminAppMetadata, isAdminOfTenant } from "@/lib/auth/tenant-binding";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";

/**
 * GET /api/admin/users
 * 현재 테넌트의 어드민 사용자 목록을 반환한다 (app_metadata.role='admin').
 *
 * POST /api/admin/users/invite
 * 이메일로 새 어드민 사용자를 초대한다. Supabase Auth Admin API 사용.
 */

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;


  const supabase = createSupabaseAdminClient();

  // Supabase Admin API로 전체 유저 조회 후 role=admin 이면서 현재 테넌트 소속만 필터
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const admins = (data.users ?? [])
    .filter(
      (u) => isAdminOfTenant(u, tenant.id)
    )
    .map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      confirmed: !!u.email_confirmed_at,
    }));

  return NextResponse.json({ users: admins });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;


  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const { email } = body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@"))
    return NextResponse.json({ error: "유효한 이메일을 입력해주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const requestStartedAt = Date.now();

  // inviteUserByEmail: 이메일로 초대 링크 발송.
  // [보안] 권한은 사용자가 바꿀 수 없는 app_metadata에 부여한다(초대 data는 user_metadata로만 들어감)
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

  if (error) {
    if (error.message.includes("already been registered"))
      return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // [보안] 아직 초대를 수락하지 않은(미확인) 기존 계정은 오류 없이 그 계정이 돌아온다.
  // 다른 기관의 대기 중 관리자·미확인 후원자 계정의 권한을 덮어쓰거나, 실패 시 지워 버리지 않도록
  // 이 요청이 새로 만든 계정에만 권한을 주고, 정리(삭제)도 그 경우에만 한다.
  const createdAt = Date.parse(data.user.created_at ?? "");
  const createdByThisRequest = Number.isFinite(createdAt) && createdAt >= requestStartedAt - 5_000;
  const existingRole = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (!createdByThisRequest || existingRole) {
    return NextResponse.json(
      { error: "이미 가입했거나 초대 대기 중인 이메일입니다. 해당 계정 소유자와 확인해 주세요." },
      { status: 409 },
    );
  }

  const { error: grantErr } = await supabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: adminAppMetadata(tenant.id),
  });
  if (grantErr) {
    // 이 요청이 만든 권한 없는 초대 계정만 정리
    await supabase.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: grantErr.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
    },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;


  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "userId 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 삭제 전 해당 유저가 현재 테넌트 소속인지 확인
  const { data: targetUser } = await supabase.auth.admin.getUserById(userId);
  if (
    !targetUser?.user ||
    !isAdminOfTenant(targetUser.user, tenant.id)
  ) {
    return NextResponse.json(
      { error: "해당 사용자는 이 기관에 속하지 않습니다." },
      { status: 403 }
    );
  }

  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
