import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { readJsonObject } from "@/lib/http/body";

const VALID_TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;

/**
 * PATCH /api/admin/members/[id]/tier  — 회원 등급 수동 지정/해제
 *   body: { tier: '...' | null, override: boolean }
 *   override=true 면 자동 분류 cron이 덮어쓰지 않음
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id: memberId } = await params;

  const parsed = await readJsonObject<{ tier?: unknown; override?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const override = body.override === true;
  const tier = typeof body.tier === "string" ? body.tier : null;
  if (tier !== null && !VALID_TIERS.includes(tier as (typeof VALID_TIERS)[number])) {
    return NextResponse.json(
      { error: `tier는 ${VALID_TIERS.join(" | ")} 중 하나` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {
    tier_overridden: override,
    tier_updated_at: new Date().toISOString(),
  };
  if (tier) update.tier = tier;

  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .select("tier, tier_overridden")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "member.update",
    resourceType: "member",
    resourceId: memberId,
    summary: override ? `등급 수동 지정 (${tier ?? '-'})` : `등급 자동 분류로 복원`,
    metadata: { tier, override },
  }).catch(() => {});

  return NextResponse.json({ member: data });
}
