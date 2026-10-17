import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";
import { writeMemberAudit } from "@/lib/donor/audit-log";
import { readJsonObject } from "@/lib/http/body";

/**
 * G-D98: 마케팅 동의 토글 엔드포인트.
 *
 * PATCH { marketingConsent: boolean }
 *   - members.marketing_consent + marketing_consent_at 갱신
 *   - member_audit_log 에 profile_update 로 기록
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("members")
    .select("marketing_consent, marketing_consent_at")
    .eq("id", session.member.id)
    .maybeSingle();
  return NextResponse.json({
    marketingConsent: Boolean(data?.marketing_consent),
    updatedAt: data?.marketing_consent_at ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = enforceDonorLimit(session.member.id, "consent:patch");
  if (!rl.allowed) return limitResponse(rl);

  const parsed = await readJsonObject<{ marketingConsent?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body.marketingConsent !== "boolean") {
    return NextResponse.json(
      { error: "marketingConsent boolean 필수" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("members")
    .update({
      marketing_consent: body.marketingConsent,
      marketing_consent_at: now,
    })
    .eq("id", session.member.id)
    .eq("org_id", session.member.org_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeMemberAudit(admin, {
    orgId: session.member.org_id,
    memberId: session.member.id,
    action: "profile_update",
    diff: { marketing_consent: { after: body.marketingConsent } },
  });

  return NextResponse.json({
    ok: true,
    marketingConsent: body.marketingConsent,
    updatedAt: now,
  });
}
