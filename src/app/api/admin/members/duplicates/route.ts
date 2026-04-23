import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { detectDuplicateMembers } from "@/lib/members/duplicate-detection";

/**
 * G-D102: 회원 중복 후보 조회 (관리자 전용).
 *   GET /api/admin/members/duplicates
 *
 * 응답: { groups: Array<{ key, matchType, members[] }> }
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const supabase = createSupabaseAdminClient();
  const groups = await detectDuplicateMembers(supabase, guard.ctx.tenant.id);
  return NextResponse.json({
    groupCount: groups.length,
    groups,
  });
}
