import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdminUser();
  const { id: memberId } = await params;

  const supabase = createSupabaseAdminClient();

  // Resolve supabase_uid from member record
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id, supabase_uid, org_id")
    .eq("id", memberId)
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
    .eq("member_id", memberId);

  await logAudit({
    orgId: member.org_id,
    actorId: adminUser.id,
    action: "admin.mfa_reset",
    resourceType: "member",
    resourceId: memberId,
    metadata: { factors_removed: totpFactors.length },
  });

  return NextResponse.json({ ok: true, factors_removed: totpFactors.length });
}
