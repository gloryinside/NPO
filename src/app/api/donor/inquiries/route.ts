import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";

const CATEGORIES = ["general", "payment", "receipt", "donation", "other"] as const;

// GET /api/donor/inquiries — 내 문의 목록
export async function GET() {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("inquiries")
    .select("id, category, subject, status, created_at, answered_at, inquiry_replies(id, author_role, body, created_at)")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data });
}

// POST /api/donor/inquiries — 문의 작성
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const rl = enforceDonorLimit(session.member.id, "inquiry:post", "default");
  if (!rl.allowed) return limitResponse(rl);

  let body: { subject?: unknown; body?: unknown; category?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const category = CATEGORIES.includes(body.category as typeof CATEGORIES[number])
    ? (body.category as string)
    : "general";

  if (!subject || subject.length > 200)
    return NextResponse.json({ error: "제목을 입력해주세요. (200자 이하)" }, { status: 400 });
  if (!text || text.length > 3000)
    return NextResponse.json({ error: "내용을 입력해주세요. (3000자 이하)" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("inquiries")
    .insert({
      org_id: session.member.org_id,
      member_id: session.member.id,
      category,
      subject,
      body: text,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
