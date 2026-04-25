import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * POST /api/donor/surveys/[id]/respond
 *   후원자가 설문에 응답.
 *   body: { score?: number, comment?: string, answers?: object }
 *   - NPS: score 0~10 → nps_category 자동 분류
 *   - CSAT: score 1~5
 *   - custom: answers
 *   UNIQUE(survey_id, member_id) — 재응답은 409
 */
function classifyNps(score: number): "promoter" | "passive" | "detractor" {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { id: surveyId } = await params;

  let body: { score?: unknown; comment?: unknown; answers?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const supabase = createSupabaseAdminClient();
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, survey_type, status, close_at")
    .eq("id", surveyId)
    .eq("org_id", session.member.org_id)
    .maybeSingle();
  if (!survey) return NextResponse.json({ error: "설문을 찾을 수 없습니다." }, { status: 404 });
  if (survey.status !== "open") {
    return NextResponse.json({ error: "마감된 설문입니다." }, { status: 400 });
  }
  if (survey.close_at && new Date(survey.close_at) < new Date()) {
    return NextResponse.json({ error: "마감일이 지났습니다." }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    org_id: session.member.org_id,
    survey_id: surveyId,
    member_id: session.member.id,
    comment: typeof body.comment === "string" ? body.comment.trim().slice(0, 2000) : null,
  };

  if (survey.survey_type === "nps") {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 0 || score > 10) {
      return NextResponse.json({ error: "NPS 점수는 0~10" }, { status: 400 });
    }
    insert.score = score;
    insert.nps_category = classifyNps(score);
  } else if (survey.survey_type === "csat") {
    const score = Number(body.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return NextResponse.json({ error: "CSAT 점수는 1~5" }, { status: 400 });
    }
    insert.score = score;
  } else {
    insert.answers = body.answers ?? {};
  }

  const { data, error } = await supabase
    .from("survey_responses")
    .insert(insert)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 응답하셨습니다." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
