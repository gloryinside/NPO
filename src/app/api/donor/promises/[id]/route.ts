import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/donor/promises/[id]
 *
 * Allows a donor to suspend or cancel their own active promise.
 * Only the owner (verified via member.id + org_id) can mutate.
 *
 * Body: { action: "suspend" | "cancel" }
 *
 * Rules:
 * - suspend: active → suspended
 * - cancel:  active | suspended → cancelled (sets ended_at)
 * - completed promises cannot be changed
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "suspend" && action !== "cancel" && action !== "changeAmount" && action !== "resume") {
    return NextResponse.json(
      { error: "action 은 suspend, cancel, resume, changeAmount 중 하나여야 합니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership: promise must belong to this member in this org
  const { data: promise, error: findErr } = await supabase
    .from("promises")
    .select("id, status, member_id, org_id, toss_billing_key, type")
    .eq("id", id)
    .eq("member_id", session.member.id)
    .eq("org_id", session.member.org_id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!promise) {
    return NextResponse.json(
      { error: "약정을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (promise.status === "completed" || promise.status === "cancelled") {
    return NextResponse.json(
      { error: "이미 완료 또는 해지된 약정은 변경할 수 없습니다." },
      { status: 400 }
    );
  }

  if (action === "suspend" && promise.status !== "active") {
    return NextResponse.json(
      { error: "진행중인 약정만 일시중지할 수 있습니다." },
      { status: 400 }
    );
  }

  if (action === "resume" && promise.status !== "suspended") {
    return NextResponse.json(
      { error: "일시중지 상태의 약정만 재개할 수 있습니다." },
      { status: 400 }
    );
  }

  // resume: 정기후원인데 billingKey가 없으면 카드 재등록 필요 신호 반환
  if (action === "resume" && promise.type === "regular" && !promise.toss_billing_key) {
    return NextResponse.json(
      { error: "결제 수단이 등록되지 않았습니다. 관리자에게 카드 재등록을 요청해주세요.", code: "BILLING_KEY_MISSING" },
      { status: 400 }
    );
  }

  // changeAmount: active 약정의 금액 변경
  if (action === "changeAmount") {
    const newAmount = Number(body.amount);
    if (!Number.isFinite(newAmount) || newAmount <= 0) {
      return NextResponse.json(
        { error: "유효한 금액을 입력하세요." },
        { status: 400 }
      );
    }
    if (promise.status !== "active") {
      return NextResponse.json(
        { error: "진행중인 약정만 금액을 변경할 수 있습니다." },
        { status: 400 }
      );
    }
    const { data: updated, error: updateErr } = await supabase
      .from("promises")
      .update({ amount: newAmount, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status, amount")
      .single();

    // 이 약정에 연결된 미청구 pending payment 금액도 함께 갱신 —
    // processMonthlyCharges가 payment.amount를 참조하므로 (promise.amount 아님)
    // 동기화하지 않으면 변경 전 금액으로 청구된다.
    await supabase
      .from("payments")
      .update({ amount: newAmount })
      .eq("promise_id", id)
      .eq("pay_status", "pending")
      .is("toss_payment_key", null);

    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message ?? "업데이트 실패" },
        { status: 500 }
      );
    }
    return NextResponse.json({ promise: updated });
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: action === "cancel" ? "cancelled" : action === "resume" ? "active" : "suspended",
    updated_at: nowIso,
  };
  if (action === "cancel") {
    updates.ended_at = nowIso;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("promises")
    .update(updates)
    .eq("id", id)
    .select("id, status, ended_at")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "업데이트 실패" },
      { status: 500 }
    );
  }

  return NextResponse.json({ promise: updated });
}
