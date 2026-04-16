import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

const ALLOWED_PAY_STATUS = ["paid", "unpaid", "failed", "cancelled", "refunded", "pending"] as const;

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await requireAdminUser();

  const { id } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "납입 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const { pay_status, deposit_date, income_status } = body as {
    pay_status?: string;
    deposit_date?: string | null;
    income_status?: string;
  };

  if (pay_status !== undefined) {
    if (!ALLOWED_PAY_STATUS.includes(pay_status as typeof ALLOWED_PAY_STATUS[number])) {
      return NextResponse.json({ error: "유효하지 않은 납부 상태입니다." }, { status: 400 });
    }
    update.pay_status = pay_status;
    // 납부완료 처리 시 deposit_date를 오늘로 자동 설정
    if (pay_status === "paid" && !deposit_date) {
      update.deposit_date = new Date().toISOString().slice(0, 10);
    }
  }

  if (deposit_date !== undefined) {
    update.deposit_date = deposit_date;
  }

  if (income_status !== undefined) {
    const ALLOWED_INCOME = ["pending", "processing", "confirmed", "excluded"];
    if (!ALLOWED_INCOME.includes(income_status)) {
      return NextResponse.json({ error: "유효하지 않은 수입 상태입니다." }, { status: 400 });
    }
    update.income_status = income_status;
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const { data: payment, error } = await supabase
    .from("payments")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("id, pay_status, deposit_date, income_status, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 감사 로그 — 상태 전환만 기록
  if (pay_status === "paid") {
    await logAudit({
      orgId: tenant.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "payment.mark_paid",
      resourceType: "payment",
      resourceId: id,
      summary: "수기 납부완료 처리",
      metadata: { deposit_date: update.deposit_date },
    });
  } else if (pay_status === "unpaid") {
    await logAudit({
      orgId: tenant.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "payment.retry_cms",
      resourceType: "payment",
      resourceId: id,
      summary: "CMS 재출금 예약 (unpaid 초기화)",
    });
  } else if (income_status === "confirmed") {
    await logAudit({
      orgId: tenant.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: "payment.confirm_income",
      resourceType: "payment",
      resourceId: id,
      summary: "수입 확정 처리",
    });
  }

  return NextResponse.json({ payment });
}
