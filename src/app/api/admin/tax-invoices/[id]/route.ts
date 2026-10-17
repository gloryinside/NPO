import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["pending", "issued", "sent", "cancelled"]);

/**
 * PATCH /api/admin/tax-invoices/[id]
 *   상태 전환 + 발행 정보 입력
 *   body: { status, invoiceNo?, issueDate?, externalProvider?, externalInvoiceId?, notes? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const status = typeof body.status === "string" ? body.status : null;
  if (status) {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = status;
  }
  if (typeof body.invoiceNo === "string") update.invoice_no = body.invoiceNo;
  if (typeof body.issueDate === "string") update.issue_date = body.issueDate;
  if (typeof body.externalProvider === "string") update.external_provider = body.externalProvider;
  if (typeof body.externalInvoiceId === "string") update.external_invoice_id = body.externalInvoiceId;
  if (typeof body.notes === "string") update.notes = body.notes;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("tax_invoices")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
