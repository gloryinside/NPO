import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";

/**
 * PATCH /api/admin/payments/income-status
 * 관리자가 선택한 납입 건의 수입상태를 일괄 변경한다.
 *
 * Body:
 *   paymentIds    (string[], 필수)
 *   incomeStatus  ("pending" | "processing" | "confirmed" | "excluded", 필수)
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const { paymentIds, incomeStatus } = body as {
    paymentIds?: string[];
    incomeStatus?: string;
  };

  const validStatuses = ["pending", "processing", "confirmed", "excluded"];
  if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
    return NextResponse.json({ error: "paymentIds 필수" }, { status: 400 });
  }
  if (!incomeStatus || !validStatuses.includes(incomeStatus)) {
    return NextResponse.json(
      { error: `incomeStatus: ${validStatuses.join(",")} 중 하나` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("payments")
    .update({
      income_status: incomeStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", tenant.id)
    .in("id", paymentIds)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ updated: data?.length ?? 0 });
}
