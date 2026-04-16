import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

/**
 * PATCH /api/v1/payments/{id}/status — ERP 연동 API: 납입상태 변경
 *
 * 도너스 API 패턴. ERP가 수입결의 처리 후 납입 상태를 변경한다.
 *
 * Body:
 *   incomeStatus  (2=processing, 3=confirmed, 4=excluded)
 *   depositDate   (YYYY-MM-DD, optional)
 *   memo          (string, optional)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  const { id: paymentId } = await params;

  // Bearer token → org_id
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Bearer token required" }, { status: 401 });
  }
  const token = auth.slice(7).trim();

  const supabase = createSupabaseAdminClient();
  const { data: secret } = await supabase
    .from("org_secrets")
    .select("org_id")
    .eq("erp_api_key", token)
    .maybeSingle();

  if (!secret) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  const orgId = secret.org_id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const statusMap: Record<number, string> = {
    2: "processing",
    3: "confirmed",
    4: "excluded",
  };

  const incomeStatusNum = Number(body.incomeStatus);
  const newStatus = statusMap[incomeStatusNum];
  if (!newStatus) {
    return NextResponse.json(
      { error: "incomeStatus must be 2, 3, or 4" },
      { status: 400 }
    );
  }

  // 현재 payment 조회 (org 소속 확인)
  const { data: payment, error: fetchErr } = await supabase
    .from("payments")
    .select("id, income_status, org_id")
    .eq("id", paymentId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (fetchErr || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const previousStatus = payment.income_status;

  const update: Record<string, unknown> = {
    income_status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (body.depositDate && typeof body.depositDate === "string") {
    update.deposit_date = body.depositDate;
  }
  if (body.memo && typeof body.memo === "string") {
    update.note = body.memo;
  }

  const { error: updateErr } = await supabase
    .from("payments")
    .update(update)
    .eq("id", paymentId)
    .eq("org_id", orgId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    paymentIdx: paymentId,
    previousStatus: incomeStatusCode(previousStatus),
    currentStatus: incomeStatusNum,
    updatedAt: new Date().toISOString(),
  });
}

function incomeStatusCode(status: string): number {
  switch (status) {
    case "pending": return 1;
    case "processing": return 2;
    case "confirmed": return 3;
    case "excluded": return 4;
    default: return 0;
  }
}
