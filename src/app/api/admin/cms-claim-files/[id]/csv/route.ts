import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { csvHeaders } from "@/lib/csv";
import { claimCsvFor } from "@/lib/cms/claim";

/** GET /api/admin/cms-claim-files/[id]/csv — 저장된 청구 명단 다시 내려받기(상태 변경 없음) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const out = await claimCsvFor(createSupabaseAdminClient(), guard.ctx.tenant.id, id);
  if (!out) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(out.csv, { headers: csvHeaders(out.filename) });
}
