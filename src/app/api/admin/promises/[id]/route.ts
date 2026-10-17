import { NextRequest, NextResponse } from "next/server";
import { revokePromiseBilling } from "@/lib/billing/revoke";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit, type AuditAction } from "@/lib/audit";
import {
  renderPromiseStatusChangeEmail,
  type PromiseStatusChangeKind,
} from "@/lib/promises/status-change-email";
import { sendEmail } from "@/lib/email/send-email";
import { logNotification, type NotificationKind } from "@/lib/email/notification-log";

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
  const user = await requireAdminUser();
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

  // 이전 상태 조회 — status가 실제로 바뀐 경우에만 후원자 알림을 발송하기 위함
  const { data: prev } = await supabase
    .from("promises")
    .select("status")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  const previousStatus = (prev as { status?: string } | null)?.status ?? null;

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

  // 해지·종료 → 토스 빌링키 삭제 + 남은 미결제 청구 취소
  if (status === "cancelled" || status === "completed") {
    await revokePromiseBilling(supabase, tenant.id, [id]);
  }

  // 감사 로그 — 상태 변경만 기록 (amount 단일 변경은 noise)
  if (status) {
    const actionMap: Record<string, AuditAction> = {
      suspended: "promise.suspend",
      active: "promise.resume",
      cancelled: "promise.cancel",
      completed: "promise.cancel",
    };
    const action = actionMap[status];
    if (action) {
      const summary =
        status === "cancelled"
          ? `약정 해지${cancelReason ? ` (${cancelReason})` : ""}`
          : status === "suspended"
          ? `약정 일시중지${suspendedUntil ? ` (~${suspendedUntil})` : ""}`
          : status === "active"
          ? "약정 재개"
          : "약정 완료";

      await logAudit({
        orgId: tenant.id,
        actorId: user.id,
        actorEmail: user.email ?? null,
        action,
        resourceType: "promise",
        resourceId: id,
        summary,
        metadata: { status, cancelReason, suspendedUntil },
      });
    }
  }

  // 상태 전이 알림 — 실제로 status가 바뀐 경우에만 후원자에게 통보
  if (status && status !== previousStatus) {
    const kindMap: Partial<Record<string, PromiseStatusChangeKind>> = {
      cancelled: "cancelled",
      suspended: "suspended",
      active: previousStatus === "suspended" ? "resumed" : undefined,
    };
    const notifKind = kindMap[status];
    if (notifKind) {
      void notifyDonorStatusChange({
        supabase,
        orgId: tenant.id,
        promiseId: id,
        kind: notifKind,
        amount: Number(data.amount ?? 0),
        reason: cancelReason ?? null,
        suspendedUntil: suspendedUntil ?? null,
      });
    }
  }

  return NextResponse.json({ promise: data });
}

const NOTIF_KIND_MAP: Record<PromiseStatusChangeKind, NotificationKind> = {
  cancelled: "promise_cancelled",
  suspended: "promise_suspended",
  resumed: "promise_resumed",
};

async function notifyDonorStatusChange(params: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  orgId: string;
  promiseId: string;
  kind: PromiseStatusChangeKind;
  amount: number;
  reason: string | null;
  suspendedUntil: string | null;
}): Promise<void> {
  const { supabase, orgId, promiseId, kind, amount, reason, suspendedUntil } = params;
  try {
    const { data: promise } = await supabase
      .from("promises")
      .select("members(name, email, email_disabled), campaigns(title), orgs(name)")
      .eq("id", promiseId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!promise) return;

    const memberRaw = (promise as { members?: unknown }).members;
    const member = (Array.isArray(memberRaw) ? memberRaw[0] : memberRaw) as
      | { name: string | null; email: string | null; email_disabled: boolean | null }
      | null;
    if (!member?.email || member.email_disabled) return;

    const orgRaw = (promise as { orgs?: unknown }).orgs;
    const org = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as
      | { name: string | null }
      | null;
    const campaignRaw = (promise as { campaigns?: unknown }).campaigns;
    const campaign = (Array.isArray(campaignRaw) ? campaignRaw[0] : campaignRaw) as
      | { title: string | null }
      | null;

    const { subject, html } = renderPromiseStatusChangeEmail(kind, {
      toEmail: member.email,
      memberName: member.name ?? "후원자",
      orgName: org?.name ?? "기관",
      campaignTitle: campaign?.title ?? null,
      amount,
      reason,
      suspendedUntil,
    });

    const sendResult = await sendEmail({ to: member.email, subject, html });
    await logNotification(supabase, {
      orgId,
      kind: NOTIF_KIND_MAP[kind],
      recipientEmail: member.email,
      refId: promiseId,
      status: sendResult.success ? "sent" : "failed",
      error: sendResult.error ?? null,
    });
  } catch (err) {
    console.error("[admin/promises] notify donor status change failed:", err);
  }
}
