import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { kstToday } from "@/lib/billing/kst";
import { nextPeriod, parseFeePayment, type FeeCycle } from "@/lib/membership/fees";

/**
 * GET  /api/admin/membership-fees/payments?memberId= — 회원의 회비 납부 이력
 * POST /api/admin/membership-fees/payments — 납부 기록 { memberId, amount, paidDate, method, notes }
 *   회원이 가입한 회비 종류의 주기만큼 납부 기간을 이어 붙이고 만료일을 늘린다. 회계 담당자만.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const memberId = req.nextUrl.searchParams.get("memberId") ?? "";
  const { data, error } = await createSupabaseAdminClient()
    .from("membership_fee_payments")
    .select("id, amount, paid_date, period_start, period_end, payment_method, notes, membership_fee_plans(name)")
    .eq("org_id", tenant.id)
    .eq("member_id", memberId)
    .order("paid_date", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const input = parseFeePayment(parsed.body, kstToday());
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const v = input.value;

  const supabase = createSupabaseAdminClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, name, fee_paid_until, fee_plan_id, membership_fee_plans(id, cycle)")
    .eq("id", v.memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  const plan = (member?.membership_fee_plans ?? null) as unknown as { id: string; cycle: FeeCycle } | null;
  if (!member || !plan) return NextResponse.json({ error: "회비에 가입한 회원이 아닙니다." }, { status: 400 });

  const period = nextPeriod(plan.cycle, member.fee_paid_until as string | null, v.paidDate);
  const { data: row, error } = await supabase
    .from("membership_fee_payments")
    .insert({
      org_id: tenant.id,
      member_id: member.id,
      fee_plan_id: plan.id,
      amount: v.amount,
      paid_date: v.paidDate,
      period_start: period.start,
      period_end: period.end,
      payment_method: v.method,
      notes: v.notes,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    return NextResponse.json({ error: "같은 기간의 납부가 이미 기록되어 있습니다. 목록을 새로 고쳐 확인해 주세요." }, { status: 409 });
  }
  if (error || !row) return NextResponse.json({ error: "기록하지 못했습니다." }, { status: 500 });

  // 동시에 두 번 기록돼도 만료일이 줄지 않게 — 지금 값보다 뒤일 때만 늘린다
  const prev = member.fee_paid_until as string | null;
  let upd = supabase.from("members").update({ fee_paid_until: period.end }).eq("id", member.id).eq("org_id", tenant.id);
  upd = prev ? upd.lt("fee_paid_until", period.end) : upd.is("fee_paid_until", null);
  const { error: updErr } = await upd;
  if (updErr) console.error("[membership-fees] paid_until update:", updErr.message);

  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "membership.fee_record", resourceType: "member", resourceId: member.id,
    summary: `회비 납부 기록 (${member.name}, ${v.amount.toLocaleString("ko-KR")}원, ${period.start}~${period.end})`,
  });
  return NextResponse.json({ ok: true, id: row.id, period }, { status: 201 });
}
