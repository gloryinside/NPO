import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_STATUS = new Set(["queued", "preparing", "shipped", "skipped"]);

/**
 * GET /api/admin/gift-shipments?status=queued
 *   기념품 발송 큐 목록.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status") ?? "queued";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("gift_shipments")
    .select(
      "id, member_id, gift_name, trigger_value, status, shipping_address, tracking_no, shipped_at, notes, created_at, members(name, phone, email, address_full)"
    )
    .eq("org_id", tenant.id)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
