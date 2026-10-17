import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { claimLines } from "@/lib/cms/claim";

/** GET /api/admin/cms-claim-files/[id] — 청구 명단의 줄(후원자·금액·결과) */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: file } = await supabase
    .from("cms_claim_files")
    .select("id")
    .eq("id", id)
    .eq("org_id", guard.ctx.tenant.id)
    .maybeSingle();
  if (!file) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ lines: await claimLines(supabase, guard.ctx.tenant.id, id) });
}
