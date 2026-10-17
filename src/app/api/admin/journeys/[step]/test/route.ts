import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { readJsonObject } from "@/lib/http/body";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseStepUpdate } from "@/lib/journey/admin";
import { renderJourneyEmail } from "@/lib/journey/render";
import { orgSiteUrl } from "@/lib/journey/runner";
import { stepDef } from "@/lib/journey/steps";
import { sendEmail } from "@/lib/email/send-email";
import { rateLimit } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ step: string }> };

/**
 * POST /api/admin/journeys/[step]/test — 지금 고치는 문구를 내 이메일로 미리 받아 보기.
 * 받는 사람은 로그인한 관리자 본인으로 고정(다른 주소로 보내는 데 쓰이지 않게). 분당 5회.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!user.email) return NextResponse.json({ error: "관리자 계정에 이메일이 없습니다." }, { status: 400 });
  if (!rateLimit(`journey:test:${user.id}`, 5, 60_000).allowed) {
    return NextResponse.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429 });
  }
  const { step } = await params;
  const def = stepDef(step);
  if (!def) return NextResponse.json({ error: "없는 단계입니다." }, { status: 404 });

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const input = parseStepUpdate({ ...parsed.body, enabled: true });
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const { data: org } = await createSupabaseAdminClient().from("orgs").select("name, slug").eq("id", tenant.id).single();
  const site = orgSiteUrl(org?.slug ?? null);
  const msg = renderJourneyEmail(
    input.value,
    { 이름: "홍길동", 기관명: org?.name ?? "", 금액: "30,000원", 시작일: "2025-10-17", 후원기간: "1년", 마이페이지: site ? `${site}/donor` : "" },
    { orgName: org?.name ?? "", settingsUrl: site ? `${site}/donor/settings` : null },
  );
  const res = await sendEmail({ to: user.email, subject: `[미리보기] ${msg.subject}`, html: msg.html });
  if (!res.success) return NextResponse.json({ error: "메일을 보내지 못했습니다. 메일 설정을 확인해 주세요." }, { status: 502 });
  return NextResponse.json({ ok: true, to: user.email });
}
