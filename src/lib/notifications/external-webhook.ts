import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 외부 webhook (Slack/Discord/일반) 발송 유틸.
 *
 * 사용:
 *   await dispatchExternalWebhooks(supabase, orgId, 'payment.paid', {
 *     amount: 100000, donorName: '...', campaignTitle: '...'
 *   });
 *
 * fire-and-forget. 실패해도 호출자에게 영향 X.
 */

export type ExternalEventType =
  | "payment.paid"
  | "payment.failed"
  | "payment.refunded"
  | "promise.created"
  | "promise.cancelled"
  | "churn.high"
  | "discrepancy.detected"
  | "expense.approved";

interface SlackBlock {
  text?: { type: string; text: string };
  type?: string;
  fields?: Array<{ type: string; text: string }>;
}

function formatPayloadForSlack(eventType: string, payload: Record<string, unknown>): {
  text: string;
  blocks?: SlackBlock[];
} {
  const amount = payload.amount as number | undefined;
  const formatted = amount ? `${amount.toLocaleString("ko-KR")}원` : "";
  const donor = (payload.donorName ?? payload.memberName ?? "") as string;
  const campaign = (payload.campaignTitle ?? "") as string;

  const titleMap: Record<string, string> = {
    "payment.paid": `💚 신규 후원: ${formatted}`,
    "payment.failed": `⚠️ 결제 실패: ${formatted}`,
    "payment.refunded": `↩️ 환불: ${formatted}`,
    "promise.created": `🎉 새 정기약정: ${formatted}`,
    "promise.cancelled": `❌ 약정 해지: ${formatted}`,
    "churn.high": `🚨 이탈 위험 후원자 발견`,
    "discrepancy.detected": `🔴 정산 불일치 감지`,
    "expense.approved": `✅ 지출 승인: ${formatted}`,
  };
  const title = titleMap[eventType] ?? eventType;
  const detail = donor || campaign
    ? `${donor ? `${donor}님` : ""}${donor && campaign ? " · " : ""}${campaign}`
    : "";

  return {
    text: title,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*${title}*${detail ? `\n${detail}` : ""}` } },
    ],
  };
}

async function postToSlack(url: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`Slack ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function postToGeneric(url: string, eventType: string, payload: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Event-Type": eventType },
    body: JSON.stringify({ event: eventType, payload, timestamp: new Date().toISOString() }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Webhook ${res.status}`);
}

export async function dispatchExternalWebhooks(
  supabase: SupabaseClient,
  orgId: string,
  eventType: ExternalEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: subs } = await supabase
    .from("external_webhook_subscriptions")
    .select("id, name, channel, webhook_url, event_types, min_amount")
    .eq("org_id", orgId)
    .eq("active", true);

  if (!subs?.length) return;

  for (const s of subs as Array<{
    id: string; name: string; channel: string; webhook_url: string;
    event_types: string[]; min_amount: number | null;
  }>) {
    if (!s.event_types?.includes(eventType)) continue;

    // min_amount 필터
    const amount = payload.amount as number | undefined;
    if (s.min_amount != null && amount != null && amount < Number(s.min_amount)) continue;

    try {
      if (s.channel === "slack" || s.channel === "discord") {
        const slackPayload = formatPayloadForSlack(eventType, payload);
        await postToSlack(s.webhook_url, slackPayload as Record<string, unknown>);
      } else {
        await postToGeneric(s.webhook_url, eventType, payload);
      }
      await supabase
        .from("external_webhook_subscriptions")
        .update({
          delivered_count: ((subs.find((x) => x.id === s.id) as { delivered_count?: number } | undefined)?.delivered_count ?? 0) + 1,
          last_delivered_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", s.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[external-webhook] ${s.name} failed:`, msg);
      await supabase
        .from("external_webhook_subscriptions")
        .update({
          failed_count: ((subs.find((x) => x.id === s.id) as { failed_count?: number } | undefined)?.failed_count ?? 0) + 1,
          last_error: msg.slice(0, 500),
        })
        .eq("id", s.id);
    }
  }
}
