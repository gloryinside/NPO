import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/donor/receipts
 * 후원자 본인의 영수증 목록 조회.
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("receipts")
    .select("id, receipt_code, year, total_amount, pdf_url, issued_at")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("year", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ receipts: data ?? [] });
}
