import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePaymentCode, generateMemberCode } from "@/lib/codes";
import { getOrgTossKeys } from "@/lib/toss/keys";

/**
 * POST /api/donations/prepare
 *
 * 공개(비로그인) 엔드포인트. Toss 결제 위젯 호출 직전에 호출된다.
 * - 캠페인을 검증하고 (org_id 일치 + status='active')
 * - 후원자를 members 테이블에 upsert 하며
 * - idempotency_key 와 payment_code 를 발급해 pending payments 행을 생성한다.
 *
 * Note: member_code / payment_code 의 seq 생성은 단순 count 기반이라
 * 동시 요청에서 경쟁 조건이 있을 수 있다. Phase 1 용 수준으로 허용.
 */
export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { campaignId, amount, memberName, memberPhone, memberEmail } = body as {
    campaignId?: string;
    amount?: number;
    memberName?: string;
    memberPhone?: string;
    memberEmail?: string;
  };

  if (!campaignId || typeof campaignId !== "string") {
    return NextResponse.json(
      { error: "campaignId는 필수입니다." },
      { status: 400 }
    );
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "amount는 양수여야 합니다." },
      { status: 400 }
    );
  }
  if (!memberName || typeof memberName !== "string" || memberName.trim() === "") {
    return NextResponse.json(
      { error: "후원자 이름은 필수입니다." },
      { status: 400 }
    );
  }

  const phone =
    typeof memberPhone === "string" && memberPhone.trim() !== ""
      ? memberPhone.trim()
      : null;
  const email =
    typeof memberEmail === "string" && memberEmail.trim() !== ""
      ? memberEmail.trim()
      : null;

  const supabase = createSupabaseAdminClient();

  // 1. 캠페인 검증 (테넌트 + active 필수)
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, org_id, title, status")
    .eq("id", campaignId)
    .eq("org_id", tenant.id)
    .eq("status", "active")
    .maybeSingle();

  if (campaignError) {
    return NextResponse.json(
      { error: campaignError.message },
      { status: 500 }
    );
  }
  if (!campaign) {
    return NextResponse.json(
      { error: "유효하지 않은 캠페인입니다." },
      { status: 404 }
    );
  }

  // 1b. 테넌트별 Toss client key 로드 — 없으면 결제 진행 불가
  const { tossClientKey } = await getOrgTossKeys(tenant.id);
  if (!tossClientKey) {
    return NextResponse.json(
      { error: "이 기관은 결제 설정이 되어있지 않습니다." },
      { status: 400 }
    );
  }

  // 2. 기존 member 검색 — phone 우선, 없으면 email 로 매칭
  let memberId: string | null = null;

  if (phone) {
    const { data: byPhone } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", tenant.id)
      .eq("phone", phone)
      .maybeSingle();
    if (byPhone?.id) {
      memberId = byPhone.id as string;
    }
  }

  if (!memberId && email) {
    const { data: byEmail } = await supabase
      .from("members")
      .select("id")
      .eq("org_id", tenant.id)
      .eq("email", email)
      .maybeSingle();
    if (byEmail?.id) {
      memberId = byEmail.id as string;
    }
  }

  // 3. 없으면 새 member 생성
  if (!memberId) {
    const year = new Date().getFullYear();
    const { count: memberCount, error: memberCountError } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", tenant.id);

    if (memberCountError) {
      return NextResponse.json(
        { error: memberCountError.message },
        { status: 500 }
      );
    }

    const memberSeq = (memberCount ?? 0) + 1;
    const memberCode = generateMemberCode(year, memberSeq);

    const { data: newMember, error: memberInsertError } = await supabase
      .from("members")
      .insert({
        org_id: tenant.id,
        member_code: memberCode,
        name: memberName.trim(),
        phone,
        email,
      })
      .select("id")
      .single();

    if (memberInsertError || !newMember) {
      return NextResponse.json(
        { error: memberInsertError?.message ?? "후원자 생성 실패" },
        { status: 500 }
      );
    }
    memberId = newMember.id as string;
  }

  // 4. payment_code 생성 (당해년도 payments count 기준)
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const { count: paymentCount, error: paymentCountError } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .gte("created_at", yearStart)
    .lt("created_at", yearEnd);

  if (paymentCountError) {
    return NextResponse.json(
      { error: paymentCountError.message },
      { status: 500 }
    );
  }

  const paymentSeq = (paymentCount ?? 0) + 1;
  const paymentCode = generatePaymentCode(year, paymentSeq);
  const idempotencyKey = randomUUID();
  const nowIso = new Date().toISOString();
  const payDate = nowIso.slice(0, 10);

  // 5. pending payments 행 생성
  const { data: payment, error: paymentInsertError } = await supabase
    .from("payments")
    .insert({
      org_id: tenant.id,
      payment_code: paymentCode,
      member_id: memberId,
      campaign_id: campaign.id,
      amount,
      pay_date: payDate,
      pay_status: "pending",
      income_status: "pending",
      idempotency_key: idempotencyKey,
      requested_at: nowIso,
    })
    .select("id, payment_code, amount, idempotency_key")
    .single();

  if (paymentInsertError || !payment) {
    return NextResponse.json(
      { error: paymentInsertError?.message ?? "결제 준비 실패" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    orderId: payment.idempotency_key,
    paymentId: payment.id,
    paymentCode: payment.payment_code,
    amount: payment.amount,
    memberName: memberName.trim(),
    customerName: memberName.trim(),
    customerEmail: email,
    memberEmail: email,
    orderName: campaign.title,
    tossClientKey,
  });
}
