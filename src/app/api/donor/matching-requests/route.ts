import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/donor/matching-requests  — 본인 매칭 신청 이력
 * POST /api/donor/matching-requests  — 매칭 신청 생성
 *   body: { programId, donorPaymentId }
 *   - donorPaymentId 가 본인 결제인지, 아직 신청 안 했는지 검증
 *   - per_donor_annual_cap 체크 (이번 신청 합계가 한도 넘으면 거부)
 *   - requested_match_amount = donor_amount * match_ratio (cap 적용)
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("matching_requests")
    .select(
      "id, program_id, donor_payment_id, donor_amount, requested_match_amount, status, created_at, fulfilled_at, matching_programs(name)"
    )
    .eq("org_id", session.member.org_id)
    .eq("donor_member_id", session.member.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const parsed = await readJsonObject<{ programId?: unknown; donorPaymentId?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const programId = typeof body.programId === "string" ? body.programId : "";
  const donorPaymentId = typeof body.donorPaymentId === "string" ? body.donorPaymentId : "";
  if (!programId || !donorPaymentId) {
    return NextResponse.json({ error: "programId, donorPaymentId 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 결제 본인 검증
  const { data: payment } = await supabase
    .from("payments")
    .select("id, member_id, amount, pay_status, pay_date")
    .eq("id", donorPaymentId)
    .eq("org_id", session.member.org_id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: "결제를 찾을 수 없습니다." }, { status: 404 });
  if (payment.member_id !== session.member.id) {
    return NextResponse.json({ error: "본인의 결제만 신청 가능" }, { status: 403 });
  }
  if (payment.pay_status !== "paid") {
    return NextResponse.json({ error: "완납된 결제만 신청 가능" }, { status: 400 });
  }

  // 프로그램 활성/유효 검증
  const { data: program } = await supabase
    .from("matching_programs")
    .select("id, match_ratio, per_donor_annual_cap, total_annual_cap, active, active_from, active_to")
    .eq("id", programId)
    .eq("org_id", session.member.org_id)
    .maybeSingle();
  if (!program || !program.active) {
    return NextResponse.json({ error: "활성 프로그램이 아닙니다." }, { status: 400 });
  }

  const donorAmount = Number(payment.amount ?? 0);
  let requestedMatch = donorAmount * Number(program.match_ratio);

  // per_donor_annual_cap 체크 (해당 연도 본인 누적 매칭 합계)
  if (program.per_donor_annual_cap != null) {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const { data: prev } = await supabase
      .from("matching_requests")
      .select("requested_match_amount")
      .eq("org_id", session.member.org_id)
      .eq("program_id", programId)
      .eq("donor_member_id", session.member.id)
      .in("status", ["approved", "fulfilled"])
      .gte("created_at", yearStart);
    const used = (prev ?? []).reduce(
      (acc: number, r: { requested_match_amount: number | null }) => acc + Number(r.requested_match_amount ?? 0),
      0
    );
    const remaining = Number(program.per_donor_annual_cap) - used;
    if (remaining <= 0) {
      return NextResponse.json({ error: "연간 한도 소진" }, { status: 400 });
    }
    if (requestedMatch > remaining) requestedMatch = remaining;
  }

  const { data, error } = await supabase
    .from("matching_requests")
    .insert({
      org_id: session.member.org_id,
      program_id: programId,
      donor_member_id: session.member.id,
      donor_payment_id: donorPaymentId,
      donor_amount: donorAmount,
      requested_match_amount: requestedMatch,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 신청한 결제입니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id, requestedMatch });
}
