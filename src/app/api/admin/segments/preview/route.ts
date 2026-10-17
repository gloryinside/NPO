import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { loadSegmentMembers, parseSegmentFilter, segmentMemberIds } from "@/lib/members/segments";

/** POST /api/admin/segments/preview — 조건에 맞는 인원과 앞쪽 100명. body: { filters } */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const supabase = createSupabaseAdminClient();
  const filters = parseSegmentFilter(parsed.body.filters);
  const ids = await segmentMemberIds(supabase, tenant.id, filters);
  const members = await loadSegmentMembers(supabase, tenant.id, ids, 100);
  return NextResponse.json({ count: ids.length, members });
}
