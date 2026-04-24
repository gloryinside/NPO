import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/admin/donation-channels/[id]/settlements  — 정산 이력
 * POST /api/admin/donation-channels/[id]/settlements  — 정산 등록 (회수액 입력)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: channelId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("channel_settlements")
    .select("id, settlement_date, cash_amount, count_donors, collected_by, deposited_to_bank, bank_deposit_date, notes")
    .eq("org_id", tenant.id)
    .eq("channel_id", channelId)
    .order("settlement_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalCash = (data ?? []).reduce(
    (acc: number, r: { cash_amount: number | null }) => acc + Number(r.cash_amount ?? 0),
    0
  );
  return NextResponse.json({ items: data ?? [], totalCash });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: channelId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const settlementDate = typeof body.settlementDate === "string" ? body.settlementDate : "";
  const cashAmount = Number(body.cashAmount ?? NaN);
  if (!settlementDate || !(cashAmount >= 0)) {
    return NextResponse.json(
      { error: "settlementDate, cashAmount(>=0) 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("channel_settlements")
    .insert({
      org_id: tenant.id,
      channel_id: channelId,
      settlement_date: settlementDate,
      cash_amount: cashAmount,
      count_donors: Number.isInteger(body.countDonors) ? body.countDonors : null,
      collected_by: typeof body.collectedBy === "string" ? body.collectedBy : null,
      deposited_to_bank: body.depositedToBank === true,
      bank_deposit_date: typeof body.bankDepositDate === "string" ? body.bankDepositDate : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
