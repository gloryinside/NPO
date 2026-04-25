import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/surveys/[id]/responses
 *   응답 목록 + NPS 집계 (promoter/passive/detractor + NPS 점수)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("survey_responses")
    .select("id, member_id, score, nps_category, comment, answers, responded_at, members(name, email)")
    .eq("org_id", tenant.id)
    .eq("survey_id", id)
    .order("responded_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // NPS 집계
  const counts = { promoter: 0, passive: 0, detractor: 0, total: 0 };
  for (const r of (data ?? []) as Array<{ nps_category: string | null }>) {
    counts.total++;
    if (r.nps_category === "promoter") counts.promoter++;
    else if (r.nps_category === "passive") counts.passive++;
    else if (r.nps_category === "detractor") counts.detractor++;
  }
  const npsScore = counts.total > 0
    ? Math.round(((counts.promoter - counts.detractor) / counts.total) * 100)
    : 0;

  return NextResponse.json({
    items: data ?? [],
    stats: { ...counts, npsScore },
  });
}
