import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth/api-guard";

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;


  const body = (await req.json()) as {
    year: number;
    fileUrl: string;
    memberCount: number;
    totalAmount: number;
  };

  if (!body.year || !body.fileUrl) {
    return NextResponse.json({ error: "year, fileUrl 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { error } = await supabase.from("nts_export_logs").insert({
    org_id: tenant.id,
    year: body.year,
    file_url: body.fileUrl,
    member_count: body.memberCount,
    total_amount: body.totalAmount,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
