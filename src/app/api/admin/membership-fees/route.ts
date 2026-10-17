import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { kstToday } from "@/lib/billing/kst";
import { feeStatus } from "@/lib/membership/fees";

/** GET /api/admin/membership-fees — 회비에 가입한 회원과 납부 상태(만료일 순) */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { data, error } = await createSupabaseAdminClient()
    .from("members")
    .select("id, name, member_code, phone, fee_plan_id, fee_paid_until")
    .eq("org_id", tenant.id)
    .not("fee_plan_id", "is", null)
    .order("fee_paid_until", { ascending: true, nullsFirst: true })
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const today = kstToday();
  return NextResponse.json({
    items: (data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      memberCode: m.member_code,
      planId: m.fee_plan_id,
      paidUntil: m.fee_paid_until,
      status: feeStatus(m.fee_paid_until as string | null, today),
    })),
  });
}
