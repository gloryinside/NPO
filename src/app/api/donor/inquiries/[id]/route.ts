import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

// GET /api/donor/inquiries/[id] — 문의 상세 (본인 것만)
export async function GET(_req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("inquiries")
    .select("id, category, subject, body, status, created_at, answered_at, inquiry_replies(id, author_role, body, created_at)")
    .eq("id", id)
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}
