import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePaymentCode } from "@/lib/codes";

/**
 * POST /api/admin/payments
 * 어드민이 오프라인(계좌이체 등) 납입을 수동으로 등록한다.
 * Toss 결제가 아니므로 toss_payment_key 없이 pay_status='paid' 로 즉시 저장.
 */
export async function POST(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { memberId, campaignId, promiseId, amount, payDate, note } = body as {
    memberId?: string;
    campaignId?: string;
    promiseId?: string | null;
    amount?: number;
    payDate?: string;
    note?: string;
  };

  if (!memberId || typeof memberId !== "string")
    return NextResponse.json({ error: "memberId 필수" }, { status: 400 });
  if (typeof amount !== "number" || amount <= 0)
    return NextResponse.json({ error: "amount 양수 필수" }, { status: 400 });
  if (!payDate || typeof payDate !== "string")
    return NextResponse.json({ error: "payDate(YYYY-MM-DD) 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  // 테넌트 소속 member 검증
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!member)
    return NextResponse.json(
      { error: "후원자를 찾을 수 없습니다." },
      { status: 404 }
    );

  // campaignId가 있으면 테넌트 소속 검증
  if (campaignId) {
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("org_id", tenant.id)
      .maybeSingle();
    if (!campaign)
      return NextResponse.json(
        { error: "캠페인을 찾을 수 없습니다." },
        { status: 404 }
      );
  }

  // payment_code 생성
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const { count } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  const seq = (count ?? 0) + 1;
  const paymentCode = generatePaymentCode(year, seq);
  const nowIso = new Date().toISOString();

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      org_id: tenant.id,
      payment_code: paymentCode,
      member_id: memberId,
      campaign_id: campaignId ?? null,
      promise_id: promiseId ?? null,
      amount,
      pay_date: payDate,
      pay_status: "paid",
      income_status: "confirmed",
      pay_method: "manual",
      note: note ?? null,
      approved_at: nowIso,
    })
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ payment }, { status: 201 });
}
