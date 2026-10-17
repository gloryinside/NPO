import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadJourneySteps } from "@/lib/journey/admin";

/** GET /api/admin/journeys — 여정 메시지 단계 설정과 최근 30일 발송 수 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const steps = await loadJourneySteps(createSupabaseAdminClient(), guard.ctx.tenant.id);
  return NextResponse.json({ steps });
}
