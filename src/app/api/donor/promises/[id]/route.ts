import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { changePromiseAmount } from "@/lib/promises/amount-change";
import { renderAmountChangeEmail } from "@/lib/promises/amount-change-email";
import { sendEmail } from "@/lib/email/send-email";
import { logNotification, wasSentForRefWithin } from "@/lib/email/notification-log";
import { getNotificationPrefs } from "@/lib/donor/notification-prefs";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";

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
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rl = enforceDonorLimit(session.member.id, "promise:patch");
  if (!rl.allowed) return limitResponse(rl);


  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (
    action !== "suspend" &&
    action !== "cancel" &&
    action !== "changeAmount" &&
    action !== "resume" &&
    action !== "changePayDay"
  ) {
    return NextResponse.json(
      {
        error:
          "action 은 suspend, cancel, resume, changeAmount, changePayDay 중 하나여야 합니다.",
      },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership: promise must belong to this member in this org
  const { data: promise, error: findErr } = await supabase
    .from("promises")
    .select(
      "id, status, member_id, org_id, toss_billing_key, type, amount, campaign_id"
    )
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

  if (action === "resume" && promise.status !== "suspended") {
    return NextResponse.json(
      { error: "일시중지 상태의 약정만 재개할 수 있습니다." },
      { status: 400 }
    );
  }

  // resume: 정기후원인데 billingKey가 없으면 카드 재등록 필요 신호 반환
  if (action === "resume" && promise.type === "regular" && !promise.toss_billing_key) {
    return NextResponse.json(
      { error: "결제 수단이 등록되지 않았습니다. 관리자에게 카드 재등록을 요청해주세요.", code: "BILLING_KEY_MISSING" },
      { status: 400 }
    );
  }

  // changeAmount: active 약정의 금액 변경
  // Phase 5-C: lib로 위임 — 이력 기록 + pending payments 동기화 포함
  if (action === "changeAmount") {
    if (promise.status !== "active") {
      return NextResponse.json(
        { error: "진행중인 약정만 금액을 변경할 수 있습니다." },
        { status: 400 }
      );
    }
    // G-107: 시간당 5회 rate limit — member 기준, DB 이력으로 확인
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const { count: recentCount } = await supabase
      .from("promise_amount_changes")
      .select("id", { count: "exact", head: true })
      .eq("member_id", session.member.id)
      .eq("actor", "member")
      .gte("created_at", oneHourAgo);
    if ((recentCount ?? 0) >= 5) {
      return NextResponse.json(
        { error: "1시간 내 변경 횟수 한도(5회)를 초과했습니다.", code: "RATE_LIMITED" },
        { status: 429 }
      );
    }

    const newAmount = Number(body.amount);
    const reasonRaw = body.reason;
    const reason =
      typeof reasonRaw === "string" && reasonRaw.trim().length > 0
        ? reasonRaw.trim().slice(0, 500)
        : null;
    const currentAmount = Number(promise.amount ?? 0);

    if (currentAmount > 0 && currentAmount === newAmount) {
      return NextResponse.json(
        { error: "현재 금액과 동일합니다." },
        { status: 400 }
      );
    }

    const result = await changePromiseAmount({
      supabase,
      promiseId: promise.id,
      orgId: promise.org_id,
      memberId: session.member.id,
      currentAmount,
      newAmount,
      actor: "member",
      actorId: session.user?.id ?? null,
      reason,
    });

    if (!result.ok) {
      const messages: Record<typeof result.error, string> = {
        invalid_amount: "유효한 금액을 입력하세요.",
        below_minimum: "후원 금액은 1,000원 이상이어야 합니다.",
        above_maximum: "후원 금액은 1억원을 초과할 수 없습니다.",
        update_failed: "업데이트 실패",
      };
      return NextResponse.json(
        { error: messages[result.error], code: result.error },
        { status: result.error === "update_failed" ? 500 : 400 }
      );
    }

    // G-106: 업/다운 감사 이메일 fire-and-forget
    // G-115: notification_prefs.amount_change = false 면 opt-out 스킵
    // G-117: 같은 약정에 5분 내 동일 kind 발송 이력이 있으면 debounce 스킵
    // same은 이벤트 가치 적어 스킵. 이메일 실패는 notification-log에 failed 로 기록.
    if (result.direction !== "same" && session.user?.email) {
      const kind = result.direction === "up" ? "up" : "down";
      const notifKind = kind === "up" ? "amount_change_up" as const : "amount_change_down" as const;

      // G-115 opt-out check
      const prefs = await getNotificationPrefs(supabase, session.member.id);
      const debounced = prefs.amount_change
        ? await wasSentForRefWithin(supabase, result.promiseId, notifKind, 5)
        : false;

      if (prefs.amount_change && !debounced) try {
        const [orgRow, campaignRow] = await Promise.all([
          supabase
            .from("orgs")
            .select("name")
            .eq("id", promise.org_id)
            .maybeSingle(),
          promise.campaign_id
            ? supabase
                .from("campaigns")
                .select("title")
                .eq("id", promise.campaign_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        const orgName =
          (orgRow.data as { name?: string } | null)?.name ?? "기관";
        const campaignTitle =
          (campaignRow.data as { title?: string } | null)?.title ?? null;

        const { subject, html } = renderAmountChangeEmail(kind, {
          toEmail: session.user.email,
          memberName: session.member.name ?? "후원자",
          orgName,
          campaignTitle,
          previousAmount: result.previousAmount,
          newAmount: result.newAmount,
        });
        const sendResult = await sendEmail({
          to: session.user.email,
          subject,
          html,
        });
        await logNotification(supabase, {
          orgId: promise.org_id,
          kind: notifKind,
          recipientEmail: session.user.email,
          refId: result.historyId ?? result.promiseId,
          status: sendResult.success ? "sent" : "failed",
          error: sendResult.error ?? null,
        });
      } catch (err) {
        console.error("[amount-change email] 발송 실패:", err);
      }
    }

    return NextResponse.json({
      promise: {
        id: result.promiseId,
        status: "active",
        amount: result.newAmount,
      },
      direction: result.direction,
      previousAmount: result.previousAmount,
      historyId: result.historyId,
    });
  }

  // SP-3: 결제일 변경 — active 약정의 pay_day 를 1~28일로 교체
  if (action === "changePayDay") {
    if (promise.status !== "active") {
      return NextResponse.json(
        { error: "진행중인 약정만 결제일을 변경할 수 있습니다." },
        { status: 400 }
      );
    }
    const day = Number(body.pay_day);
    if (!Number.isFinite(day) || !Number.isInteger(day) || day < 1 || day > 28) {
      return NextResponse.json(
        { error: "결제일은 1~28일 사이의 정수여야 합니다." },
        { status: 400 }
      );
    }

    const { error: updateErr } = await supabase
      .from("promises")
      .update({ pay_day: day, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", session.member.org_id)
      .eq("member_id", session.member.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "결제일 변경에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, pay_day: day });
  }

  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: action === "cancel" ? "cancelled" : action === "resume" ? "active" : "suspended",
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
