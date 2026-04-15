import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/promises/[id]
 * 약정 상태 변경 (suspended / cancelled / completed / active 로 전환).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = ["active", "suspended", "cancelled", "completed"];
  const { status, endedAt } = body as {
    status?: string;
    endedAt?: string | null;
  };

  if (!status || !allowed.includes(status)) {
    return NextResponse.json(
      { error: `status는 ${allowed.join(" | ")} 중 하나` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const update: Record<string, unknown> = {
    status,
    updated_at: nowIso,
  };
  if (endedAt !== undefined) update.ended_at = endedAt;
  if (status === "cancelled" || status === "completed") {
    update.ended_at = endedAt ?? nowIso.slice(0, 10);
  }

  const { data, error } = await supabase
    .from("promises")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("*")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json(
      { error: "약정을 찾을 수 없습니다." },
      { status: 404 }
    );

  return NextResponse.json({ promise: data });
}
