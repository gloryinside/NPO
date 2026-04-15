import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePromiseCode } from "@/lib/codes";

/**
 * POST /api/admin/promises
 * 어드민이 약정을 수동으로 생성한다.
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

  const { memberId, campaignId, type, amount, payDay, payMethod, startedAt } =
    body as {
      memberId?: string;
      campaignId?: string;
      type?: string;
      amount?: number;
      payDay?: number | null;
      payMethod?: string;
      startedAt?: string;
    };

  if (!memberId || typeof memberId !== "string")
    return NextResponse.json({ error: "memberId 필수" }, { status: 400 });
  if (!campaignId || typeof campaignId !== "string")
    return NextResponse.json({ error: "campaignId 필수" }, { status: 400 });
  if (!type || !["regular", "onetime"].includes(type))
    return NextResponse.json(
      { error: "type은 regular 또는 onetime" },
      { status: 400 }
    );
  if (typeof amount !== "number" || amount <= 0)
    return NextResponse.json({ error: "amount 양수 필수" }, { status: 400 });
  if (!payMethod || typeof payMethod !== "string")
    return NextResponse.json({ error: "payMethod 필수" }, { status: 400 });
  if (type === "regular" && (payDay == null || payDay < 1 || payDay > 28))
    return NextResponse.json(
      { error: "정기 약정은 납입일(1~28) 필수" },
      { status: 400 }
    );

  const supabase = createSupabaseAdminClient();

  // 테넌트 소속 member/campaign 검증
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

  const year = new Date().getFullYear();
  const { count: promiseCount } = await supabase
    .from("promises")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const seq = (promiseCount ?? 0) + 1;
  const promiseCode = generatePromiseCode(year, seq);
  const nowIso = new Date().toISOString();
  const startDate = startedAt ?? nowIso.slice(0, 10);

  const { data: promise, error } = await supabase
    .from("promises")
    .insert({
      org_id: tenant.id,
      promise_code: promiseCode,
      member_id: memberId,
      campaign_id: campaignId,
      type,
      amount,
      pay_day: type === "regular" ? (payDay ?? null) : null,
      pay_method: payMethod,
      status: "active",
      started_at: startDate,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ promise }, { status: 201 });
}
