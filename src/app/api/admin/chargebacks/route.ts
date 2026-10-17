import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/chargebacks — 카드 결제 이의 제기(chargeback) 직접 등록.
 *   body: { paymentCode, reason, amount?, tossCaseId? }
 *
 * 토스 웹훅의 분쟁 이벤트는 위조 여부를 확인할 수 없어 받지 않는다. 카드사·토스에서 연락이 오면
 * 담당자가 결제번호로 여기서 등록한다. 등록하면 해당 후원자에 분쟁 표시(chargeback_risk)가 붙는다.
 * finance 또는 super 전용.
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paymentCode = typeof body.paymentCode === "string" ? body.paymentCode.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  const tossCaseId = typeof body.tossCaseId === "string" && body.tossCaseId.trim() ? body.tossCaseId.trim().slice(0, 100) : null;
  if (!paymentCode) return NextResponse.json({ error: "결제번호를 입력해 주세요." }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "이의 제기 사유를 입력해 주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, member_id, pay_status, pay_method")
    .eq("org_id", tenant.id)
    .eq("payment_code", paymentCode)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: `결제번호 ${paymentCode}를 찾을 수 없습니다.` }, { status: 404 });
  if (payment.pay_status !== "paid") {
    return NextResponse.json({ error: "결제가 완료된 건만 이의 제기를 등록할 수 있습니다." }, { status: 400 });
  }

  const paymentAmount = Number(payment.amount);
  const amount = body.amount === undefined || body.amount === null || body.amount === "" ? paymentAmount : Number(body.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > paymentAmount) {
    return NextResponse.json(
      { error: `금액은 1원 이상, 결제금액(${paymentAmount.toLocaleString("ko-KR")}원) 이하로 입력해 주세요.` },
      { status: 400 },
    );
  }

  // 같은 결제에 진행 중인 건이 있으면 중복 등록하지 않는다
  const { data: open } = await supabase
    .from("chargebacks")
    .select("id")
    .eq("org_id", tenant.id)
    .eq("payment_id", payment.id)
    .in("status", ["open", "evidence_submitted"])
    .maybeSingle();
  if (open) return NextResponse.json({ error: "이 결제는 이미 이의 제기가 진행 중입니다." }, { status: 409 });

  const { data: row, error } = await supabase
    .from("chargebacks")
    .insert({
      org_id: tenant.id,
      payment_id: payment.id,
      member_id: payment.member_id,
      amount,
      reason_text: reason,
      toss_case_id: tossCaseId,
      status: "open",
    })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: "등록하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });

  if (payment.member_id) {
    await supabase
      .from("members")
      .update({ chargeback_risk: true })
      .eq("id", payment.member_id)
      .eq("org_id", tenant.id);
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "chargeback.create",
    resourceType: "chargeback",
    resourceId: row.id,
    summary: `카드 이의 제기 등록 ${paymentCode} ${amount.toLocaleString("ko-KR")}원`,
    metadata: { paymentCode, amount, tossCaseId },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
