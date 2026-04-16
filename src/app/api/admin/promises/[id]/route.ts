import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/admin/promises/[id]
 * 약정 필드 업데이트:
 *  - status 전환 (active / suspended / cancelled / completed)
 *  - amount 변경
 *  - suspended_until 설정 (일시정지 해제 예정일)
 *  - cancel_reason 해지 사유
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
  const {
    status,
    endedAt,
    amount,
    suspendedUntil,
    cancelReason,
  } = body as {
    status?: string;
    endedAt?: string | null;
    amount?: number;
    suspendedUntil?: string | null;
    cancelReason?: string | null;
  };

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const update: Record<string, unknown> = { updated_at: nowIso };

  // Status change
  if (status !== undefined) {
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `status는 ${allowed.join(" | ")} 중 하나` },
        { status: 400 }
      );
    }
    update.status = status;
    if (status === "cancelled" || status === "completed") {
      update.ended_at = endedAt ?? nowIso.slice(0, 10);
    }
    if (status === "active") {
      // 재개 시 suspended_until 초기화
      update.suspended_until = null;
    }
    if (status === "suspended" && suspendedUntil !== undefined) {
      update.suspended_until = suspendedUntil ?? null;
    }
    if (status === "cancelled" && cancelReason !== undefined) {
      update.cancel_reason = cancelReason ?? null;
    }
  }

  // Amount change (independent of status)
  if (amount !== undefined) {
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "금액은 0보다 커야 합니다." }, { status: 400 });
    }
    update.amount = amount;
  }

  // Standalone suspended_until update
  if (suspendedUntil !== undefined && status === undefined) {
    update.suspended_until = suspendedUntil ?? null;
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
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
