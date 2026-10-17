import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdminApi } from "@/lib/auth/api-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user: adminUser } = guard.ctx;
  const { id: memberId } = await params;

  const supabase = createSupabaseAdminClient();

  // [보안] 이 기관의 후원자만 — 예전엔 id만으로 찾아 다른 기관 후원자의 2단계 인증도 지울 수 있었다
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, supabase_uid, org_id")
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (memberErr || !member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (!member.supabase_uid) {
    return NextResponse.json(
      { error: "Member has no linked auth account" },
      { status: 422 }
    );
  }

  // List and delete all TOTP factors
  const { data: factorsData, error: listErr } =
    await supabase.auth.admin.mfa.listFactors({ userId: member.supabase_uid });

  if (listErr) {
    return NextResponse.json(
      { error: "Failed to list MFA factors" },
      { status: 500 }
    );
  }

  const totpFactors = (factorsData?.factors ?? []).filter(
    (f) => f.factor_type === "totp"
  );

  for (const factor of totpFactors) {
    const { error: deleteErr } = await supabase.auth.admin.mfa.deleteFactor({
      userId: member.supabase_uid,
      id: factor.id,
    });
    if (deleteErr) {
      return NextResponse.json(
        { error: `Failed to remove factor ${factor.id}` },
        { status: 500 }
      );
    }
  }

  // Delete backup codes
  await supabase
    .from("member_mfa_backup_codes")
    .delete()
    .eq("member_id", member.id);

  await logAudit({
    orgId: tenant.id,
    actorId: adminUser.id,
    action: "admin.mfa_reset",
    resourceType: "member",
    resourceId: memberId,
    metadata: { factors_removed: totpFactors.length },
  });

  return NextResponse.json({ ok: true, factors_removed: totpFactors.length });
}
