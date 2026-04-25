import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_TYPE = new Set(["nps", "csat", "custom"]);
const VALID_STATUS = new Set(["draft", "open", "closed"]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .select("id, title, survey_type, status, open_at, close_at, created_at")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title 필수" }, { status: 400 });

  const surveyType = typeof body.surveyType === "string" && VALID_TYPE.has(body.surveyType)
    ? body.surveyType : "nps";
  const status = typeof body.status === "string" && VALID_STATUS.has(body.status)
    ? body.status : "draft";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("surveys")
    .insert({
      org_id: tenant.id,
      title,
      description: typeof body.description === "string" ? body.description : null,
      survey_type: surveyType,
      questions: surveyType === "custom" ? body.questions ?? [] : null,
      open_at: typeof body.openAt === "string" ? body.openAt : new Date().toISOString(),
      close_at: typeof body.closeAt === "string" ? body.closeAt : null,
      status,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
