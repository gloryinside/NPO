import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { parseSegmentName as parseName, parseSegmentFilter, segmentMemberIds } from "@/lib/members/segments";

/**
 * GET  /api/admin/segments — 저장된 명단과 지금 인원
 * POST /api/admin/segments — 저장 body: { name, filters }
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("member_segments")
    .select("id, name, filters, updated_at")
    .eq("org_id", tenant.id)
    .order("name");
  const segments = await Promise.all(
    ((data ?? []) as Array<{ id: string; name: string; filters: unknown; updated_at: string }>).map(async (s) => {
      const filters = parseSegmentFilter(s.filters);
      const count = (await segmentMemberIds(supabase, tenant.id, filters)).length;
      return { ...s, filters, count };
    }),
  );
  return NextResponse.json({ segments });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const name = parseName(parsed.body.name);
  if (!name) return NextResponse.json({ error: "명단 이름을 60자 안으로 입력해 주세요." }, { status: 400 });
  const filters = parseSegmentFilter(parsed.body.filters);

  const { data, error } = await createSupabaseAdminClient()
    .from("member_segments")
    .insert({ org_id: tenant.id, name, filters, created_by: user.id })
    .select("id")
    .single();
  if (error?.code === "23505") return NextResponse.json({ error: "같은 이름의 명단이 이미 있습니다." }, { status: 409 });
  if (error || !data) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
