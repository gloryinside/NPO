import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/email-ab-stats?scenario=donation_thanks
 *   AB 테스트 통계: variant별 발송수/오픈율/클릭율
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const scenario = req.nextUrl.searchParams.get("scenario");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("email_ab_dispatches")
    .select(
      "template_id, variant, opened_at, clicked_at, email_templates!inner(scenario)"
    )
    .eq("org_id", tenant.id);
  if (scenario) {
    q = q.eq("email_templates.scenario", scenario);
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // variant별 집계
  type Stats = { sent: number; opened: number; clicked: number };
  const byVariant = new Map<string, Stats>();
  for (const r of (data ?? []) as Array<{
    variant: string | null; opened_at: string | null; clicked_at: string | null;
  }>) {
    const key = r.variant ?? "(default)";
    const cur = byVariant.get(key) ?? { sent: 0, opened: 0, clicked: 0 };
    cur.sent++;
    if (r.opened_at) cur.opened++;
    if (r.clicked_at) cur.clicked++;
    byVariant.set(key, cur);
  }

  const items = Array.from(byVariant.entries()).map(([variant, s]) => ({
    variant,
    ...s,
    open_rate: s.sent > 0 ? (s.opened / s.sent) * 100 : 0,
    click_rate: s.sent > 0 ? (s.clicked / s.sent) * 100 : 0,
  }));

  return NextResponse.json({ items });
}
