import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/donor/promises/[id]
 *
 * Allows a donor to suspend or cancel their own active promise.
 * Only the owner (verified via member.id + org_id) can mutate.
 *
 * Body: { action: "suspend" | "cancel" }
 *
 * Rules:
 * - suspend: active → suspended
 * - cancel:  active | suspended → cancelled (sets ended_at)
 * - completed promises cannot be changed
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "suspend" && action !== "cancel") {
    return NextResponse.json(
      { error: "action 은 suspend 또는 cancel 이어야 합니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership: promise must belong to this member in this org
  const { data: promise, error: findErr } = await supabase
    .from("promises")
    .select("id, status, member_id, org_id")
    .eq("id", id)
    .eq("member_id", session.member.id)
    .eq("org_id", session.member.org_id)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }
  if (!promise) {
    return NextResponse.json(
      { error: "약정을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (promise.status === "completed" || promise.status === "cancelled") {
    return NextResponse.json(
      { error: "이미 완료 또는 해지된 약정은 변경할 수 없습니다." },
      { status: 400 }
    );
  }

  if (action === "suspend" && promise.status !== "active") {
    return NextResponse.json(
      { error: "진행중인 약정만 일시중지할 수 있습니다." },
      { status: 400 }
    );
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: action === "cancel" ? "cancelled" : "suspended",
    updated_at: nowIso,
  };
  if (action === "cancel") {
    updates.ended_at = nowIso;
  }

  const { data: updated, error: updateErr } = await supabase
    .from("promises")
    .update(updates)
    .eq("id", id)
    .select("id, status, ended_at")
    .single();

  if (updateErr || !updated) {
    return NextResponse.json(
      { error: updateErr?.message ?? "업데이트 실패" },
      { status: 500 }
    );
  }

  return NextResponse.json({ promise: updated });
}
