import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueErpEvent } from "@/lib/erp/outbound-queue";

/**
 * POST /api/admin/revenue-journals/[id]/post
 *   approved 결의를 ERP outbound queue에 적재 (event=revenue_journal.posted).
 *   외부 ERP가 처리 후 external_voucher_no 를 PATCH 해주면 완료.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: journal } = await supabase
    .from("revenue_journals")
    .select("id, journal_no, journal_date, total_amount, payment_count, status, description")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!journal) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (journal.status !== "approved") {
    return NextResponse.json({ error: "approved 상태만 전송 가능" }, { status: 400 });
  }

  // 라인 조회
  const { data: lines } = await supabase
    .from("revenue_journal_lines")
    .select("payment_id, amount, debit_account_id, credit_account_id, bp_code, program_id, unit_id")
    .eq("journal_id", id);

  // ERP queue에 push (재시도+DLQ는 outbound-queue가 담당)
  await enqueueErpEvent(supabase, tenant.id, "payment.paid" as never, {
    type: "revenue_journal",
    journal: {
      id: journal.id,
      no: journal.journal_no,
      date: journal.journal_date,
      totalAmount: Number(journal.total_amount),
      paymentCount: journal.payment_count,
      description: journal.description,
    },
    lines: lines ?? [],
  });

  await supabase
    .from("revenue_journals")
    .update({
      status: "posted",
      posted_to_erp_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
