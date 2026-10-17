import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { autoAllocateToPrograms } from "@/lib/erp/journal-builder";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: paymentId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("payment_program_allocations")
    .select("id, program_id, amount, source, notes, programs(code, name)")
    .eq("org_id", tenant.id)
    .eq("payment_id", paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/payments/[id]/program-allocations
 *   body 없이 호출 → program_funding 룰로 자동 분배
 *   body { allocations: [{programId, amount}] } → 수동 분배 (기존 삭제 후 교체)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: paymentId } = await params;
  const supabase = createSupabaseAdminClient();

  let body: { allocations?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }

  if (Array.isArray(body.allocations)) {
    // 수동 분배: 합 검증 + 교체
    const allocs = body.allocations as Array<{ programId?: unknown; amount?: unknown }>;
    const sum = allocs.reduce((a, x) => a + (typeof x.amount === "number" ? x.amount : 0), 0);

    const { data: payment } = await supabase
      .from("payments").select("amount").eq("id", paymentId)
      .eq("org_id", tenant.id).maybeSingle();
    if (!payment) return NextResponse.json({ error: "payment not found" }, { status: 404 });
    if (Math.abs(sum - Number(payment.amount)) > 0.01) {
      return NextResponse.json({ error: `합계 불일치: ${sum} ≠ ${payment.amount}` }, { status: 400 });
    }

    await supabase.from("payment_program_allocations").delete()
      .eq("payment_id", paymentId).eq("org_id", tenant.id);

    const inserts = allocs
      .filter((a) => typeof a.programId === "string" && typeof a.amount === "number")
      .map((a) => ({
        org_id: tenant.id, payment_id: paymentId,
        program_id: a.programId as string, amount: a.amount as number,
        source: "manual" as const,
      }));
    const { error } = await supabase.from("payment_program_allocations").insert(inserts);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: inserts.length });
  }

  // 자동 분배
  const result = await autoAllocateToPrograms(supabase, tenant.id, paymentId);
  return NextResponse.json(result);
}
