import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

/**
 * GET /api/admin/members/[id]/consultations
 * 후원자의 상담 이력 목록 조회.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: RouteParams }
) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id: memberId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("consultation_logs")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [] });
}

/**
 * POST /api/admin/members/[id]/consultations
 * 새 상담 이력 등록.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: RouteParams }
) {
  const user = await requireAdminUser();
  const tenant = await requireTenant();
  const { id: memberId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { logType, subject, content } = body as {
    logType?: string;
    subject?: string;
    content?: string;
  };

  if (!subject || typeof subject !== "string") {
    return NextResponse.json({ error: "subject 필수" }, { status: 400 });
  }

  const validTypes = ["phone", "email", "visit", "other"];
  const type = validTypes.includes(logType ?? "") ? logType : "phone";

  const supabase = createSupabaseAdminClient();

  // member 소속 확인
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "후원자를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: log, error } = await supabase
    .from("consultation_logs")
    .insert({
      org_id: tenant.id,
      member_id: memberId,
      logged_by: user.id,
      log_type: type,
      subject,
      content: content ?? null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log }, { status: 201 });
}
