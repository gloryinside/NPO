import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET: 최근 로그인 기록 (member_audit_log ip/ua 기반)
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("member_audit_log")
    .select("id, created_at, ip, user_agent")
    .eq("member_id", session.member.id)
    .not("ip", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ sessions: data ?? [] });
}
