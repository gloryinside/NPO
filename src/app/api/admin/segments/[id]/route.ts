import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { parseSegmentName as parseName, parseSegmentFilter } from "@/lib/members/segments";

type Ctx = { params: Promise<{ id: string }> };

/** PUT — 이름·조건 고치기 / DELETE — 지우기(후원자 정보는 그대로) */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const name = parseName(parsed.body.name);
  if (!name) return NextResponse.json({ error: "명단 이름을 60자 안으로 입력해 주세요." }, { status: 400 });

  const { data, error } = await createSupabaseAdminClient()
    .from("member_segments")
    .update({ name, filters: parseSegmentFilter(parsed.body.filters), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("id");
  if (error?.code === "23505") return NextResponse.json({ error: "같은 이름의 명단이 이미 있습니다." }, { status: 409 });
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "명단을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;
  const { data } = await createSupabaseAdminClient()
    .from("member_segments")
    .delete()
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("id");
  if (!data?.length) return NextResponse.json({ error: "명단을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
