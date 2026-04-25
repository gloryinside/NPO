import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authenticateV1 } from "@/lib/erp/v1-auth";

/**
 * GET /api/v1/journal-vouchers
 *   ERP가 결의 목록 조회.
 *   ?status=approved|posted&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 응답: 결의 + 라인 + 차변/대변 계정 코드 (ERP가 바로 분개 등록 가능)
 *
 * PATCH /api/v1/journal-vouchers?journalNo=...  — ERP 처리 후 외부 전표번호 회신
 *   body: { externalVoucherNo, status?: 'posted' }
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateV1(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const orgId = authResult.orgId;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const from = sp.get("from");
  const to = sp.get("to");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("revenue_journals")
    .select("id, journal_no, journal_date, description, total_amount, payment_count, status, posted_to_erp_at, external_voucher_no")
    .eq("org_id", orgId)
    .order("journal_date", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  if (from) q = q.gte("journal_date", from);
  if (to) q = q.lte("journal_date", to);

  const { data: journals, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 라인 같이 조회
  const ids = (journals ?? []).map((j) => j.id);
  let linesMap = new Map<string, unknown[]>();
  if (ids.length > 0) {
    const { data: lines } = await supabase
      .from("revenue_journal_lines")
      .select(
        "journal_id, payment_id, amount, debit_account_id, credit_account_id, bp_code, program_id, unit_id, debit:debit_account_id(code, name), credit:credit_account_id(code, name), payments(payment_code, pay_date, members(member_code, name))"
      )
      .in("journal_id", ids);
    linesMap = new Map();
    for (const l of (lines ?? []) as Array<{ journal_id: string }>) {
      const arr = linesMap.get(l.journal_id) ?? [];
      arr.push(l);
      linesMap.set(l.journal_id, arr);
    }
  }

  return NextResponse.json({
    items: (journals ?? []).map((j) => ({
      ...j,
      lines: linesMap.get(j.id) ?? [],
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const authResult = await authenticateV1(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const orgId = authResult.orgId;
  const journalNo = req.nextUrl.searchParams.get("journalNo");
  if (!journalNo) return NextResponse.json({ error: "journalNo required" }, { status: 400 });

  let body: { externalVoucherNo?: unknown; status?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (typeof body.externalVoucherNo === "string") update.external_voucher_no = body.externalVoucherNo;
  if (body.status === "posted") {
    update.status = "posted";
    update.posted_to_erp_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no updates" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("revenue_journals")
    .update(update)
    .eq("org_id", orgId)
    .eq("journal_no", journalNo)
    .select("id, journal_no, status, external_voucher_no")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "journal not found" }, { status: 404 });
  return NextResponse.json(data);
}
