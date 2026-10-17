import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { newAgentToken, parseAgentInput } from "@/lib/f2f/agents";

/**
 * GET  /api/admin/f2f-agents — 현장 모금 링크 목록 + 모금가별 신청 실적
 * POST /api/admin/f2f-agents — 링크 만들기 { name, code, campaignId, days }. 응답의 path 는 이때 한 번만 보인다.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();

  const [{ data: agents, error }, { data: promises }] = await Promise.all([
    supabase
      .from("f2f_agents")
      .select("id, name, code, active, expires_at, created_at, campaign_id, campaigns(title)")
      .eq("org_id", tenant.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("promises")
      .select("f2f_agent_id, status, amount")
      .eq("org_id", tenant.id)
      .not("f2f_agent_id", "is", null),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = new Map<string, { signups: number; activeSignups: number; monthly: number }>();
  for (const p of (promises ?? []) as Array<{ f2f_agent_id: string; status: string; amount: number | null }>) {
    const s = stats.get(p.f2f_agent_id) ?? { signups: 0, activeSignups: 0, monthly: 0 };
    s.signups += 1;
    if (p.status === "active") {
      s.activeSignups += 1;
      s.monthly += Number(p.amount ?? 0);
    }
    stats.set(p.f2f_agent_id, s);
  }

  return NextResponse.json({
    items: (agents ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      code: a.code,
      active: a.active,
      expiresAt: a.expires_at,
      createdAt: a.created_at,
      campaignTitle: (a.campaigns as unknown as { title?: string } | null)?.title ?? null,
      ...(stats.get(a.id) ?? { signups: 0, activeSignups: 0, monthly: 0 }),
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  // 링크로 받은 서명은 출금동의로 기록되므로, 관리자 화면에서 출금동의를 기록할 수 있는 사람(회계 담당)만 링크를 다룬다
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const input = parseAgentInput(parsed.body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", input.value.campaignId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!campaign || campaign.status !== "active") {
    return NextResponse.json({ error: "진행 중인 캠페인을 골라 주세요." }, { status: 400 });
  }

  const { token, hash } = newAgentToken();
  const expiresAt = new Date(Date.now() + input.value.days * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("f2f_agents")
    .insert({
      org_id: tenant.id,
      campaign_id: campaign.id,
      name: input.value.name,
      code: input.value.code,
      token_hash: hash,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 쓰고 있는 코드입니다." }, { status: 409 });
    return NextResponse.json({ error: "링크를 만들지 못했습니다." }, { status: 500 });
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "f2f.agent_create",
    resourceType: "f2f_agent",
    resourceId: data.id,
    summary: `현장 모금 링크 발급 (${input.value.name}/${input.value.code}, ${input.value.days}일)`,
  });
  return NextResponse.json({ id: data.id, path: `/f2f/${token}`, expiresAt }, { status: 201 });
}
