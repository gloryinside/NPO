import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/http/body";
import { assignVariant, isVisitorId } from "@/lib/ab/form-test";
import { hashVisitor } from "@/lib/ab/form-test-data";

/**
 * POST /api/public/ab/view — { testId, visitorId } 신청 화면 A/B 노출 1건(방문자마다 한 번만 센다)
 * 안은 서버가 방문자 id로 다시 정한다. 방문자 id 원문은 저장하지 않는다(해시).
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const limit = rateLimit(`public:ab-view:${ip}`, 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ ok: false }, { status: 400 });
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const { testId, visitorId } = parsed.body;
  if (typeof testId !== "string" || !/^[0-9a-f-]{36}$/i.test(testId) || !isVisitorId(visitorId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: test } = await supabase
    .from("form_ab_tests")
    .select("id")
    .eq("id", testId)
    .eq("org_id", tenant.id)
    .eq("status", "running")
    .maybeSingle();
  if (!test) return NextResponse.json({ ok: false }, { status: 404 });

  await supabase.from("form_ab_views").upsert(
    { test_id: test.id, org_id: tenant.id, visitor_hash: hashVisitor(visitorId), variant: assignVariant(test.id, visitorId) },
    { onConflict: "test_id,visitor_hash", ignoreDuplicates: true },
  );
  return NextResponse.json({ ok: true });
}
