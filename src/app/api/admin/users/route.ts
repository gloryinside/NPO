import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/users
 * 현재 테넌트의 어드민 사용자 목록을 반환한다 (user_metadata.role='admin').
 *
 * POST /api/admin/users/invite
 * 이메일로 새 어드민 사용자를 초대한다. Supabase Auth Admin API 사용.
 */

export async function GET() {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Supabase Admin API로 전체 유저 조회 후 role=admin 이면서 현재 테넌트 소속만 필터
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const admins = (data.users ?? [])
    .filter(
      (u) =>
        u.user_metadata?.role === "admin" &&
        u.user_metadata?.org_id === tenant.id
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
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email } = body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@"))
    return NextResponse.json({ error: "유효한 이메일을 입력해주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // inviteUserByEmail: 이메일로 초대 링크 발송 + user_metadata에 role='admin' + org_id 설정
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { role: "admin", org_id: tenant.id },
  });

  if (error) {
    if (error.message.includes("already been registered"))
      return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId)
    return NextResponse.json({ error: "userId 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 삭제 전 해당 유저가 현재 테넌트 소속인지 확인
  const { data: targetUser } = await supabase.auth.admin.getUserById(userId);
  if (
    !targetUser?.user ||
    targetUser.user.user_metadata?.org_id !== tenant.id
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
