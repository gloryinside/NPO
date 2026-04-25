import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/secrets/crypto";

/**
 * ERP 아웃바운드 웹훅 큐.
 *
 * 사용:
 *   await enqueueErpEvent(supabase, orgId, 'payment.paid', { paymentId, ... });
 *
 * cron이 매분 단위로 큐를 처리.
 *   - 실패 시: exponential backoff (60s * 2^n)
 *   - 5회 실패 시: dead_letter
 */

export type ErpEventType =
  | "payment.paid"
  | "payment.failed"
  | "payment.refunded"
  | "promise.created"
  | "promise.cancelled"
  | "promise.suspended"
  | "promise.resumed"
  | "member.created"
  | "member.updated"
  | "receipt.issued";

export async function enqueueErpEvent(
  supabase: SupabaseClient,
  orgId: string,
  eventType: ErpEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  // org_secrets에서 webhook URL + signing key 조회
  const { data: secrets } = await supabase
    .from("org_secrets")
    .select("erp_webhook_url, erp_api_key_enc")
    .eq("org_id", orgId)
    .maybeSingle();

  const url = (secrets as { erp_webhook_url?: string | null } | null)?.erp_webhook_url;
  if (!url) return; // 설정 없으면 큐 적재 안 함

  const signature = await computeSignature(orgId, payload, secrets);

  await supabase.from("erp_outbound_webhooks").insert({
    org_id: orgId,
    event_type: eventType,
    payload,
    target_url: url,
    signature,
    status: "pending",
    next_attempt_at: new Date().toISOString(),
  });
}

async function computeSignature(
  orgId: string,
  payload: Record<string, unknown>,
  secrets: unknown,
): Promise<string | null> {
  const enc = (secrets as { erp_api_key_enc?: string | null } | null)?.erp_api_key_enc;
  if (!enc) return null;
  try {
    const key = await decryptSecret(enc);
    if (!key) return null;
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(JSON.stringify(payload));
    return hmac.digest("hex");
  } catch (err) {
    console.error(`[erp-outbound] signature failed for org ${orgId}:`, err);
    return null;
  }
}

/**
 * 큐 처리. cron이 호출.
 */
export async function processOutboundQueue(
  supabase: SupabaseClient,
  batchSize: number = 50,
): Promise<{ sent: number; failed: number; deadLetter: number }> {
  const now = new Date().toISOString();
  const { data: pending } = await supabase
    .from("erp_outbound_webhooks")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at")
    .limit(batchSize);

  if (!pending?.length) return { sent: 0, failed: 0, deadLetter: 0 };

  let sent = 0;
  let failed = 0;
  let deadLetter = 0;

  for (const item of pending as Array<{
    id: string; org_id: string; event_type: string; payload: unknown;
    target_url: string; signature: string | null; attempt_count: number;
  }>) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Event-Type": item.event_type,
        "X-Webhook-Id": item.id,
      };
      if (item.signature) headers["X-Signature-SHA256"] = item.signature;

      const res = await fetch(item.target_url, {
        method: "POST",
        headers,
        body: JSON.stringify(item.payload),
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        await supabase
          .from("erp_outbound_webhooks")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            last_response_status: res.status,
            attempt_count: item.attempt_count + 1,
          })
          .eq("id", item.id);
        sent++;
      } else {
        const errBody = await res.text().catch(() => "");
        await markFailed(supabase, item.id, item.attempt_count + 1, `HTTP ${res.status}: ${errBody.slice(0, 500)}`, res.status);
        if (item.attempt_count + 1 >= 5) deadLetter++;
        else failed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await markFailed(supabase, item.id, item.attempt_count + 1, msg, null);
      if (item.attempt_count + 1 >= 5) deadLetter++;
      else failed++;
    }
  }

  return { sent, failed, deadLetter };
}

async function markFailed(
  supabase: SupabaseClient,
  id: string,
  newAttemptCount: number,
  error: string,
  responseStatus: number | null,
): Promise<void> {
  if (newAttemptCount >= 5) {
    await supabase
      .from("erp_outbound_webhooks")
      .update({
        status: "dead_letter",
        last_error: error,
        last_response_status: responseStatus,
        attempt_count: newAttemptCount,
      })
      .eq("id", id);
    return;
  }

  // exponential backoff: 60s * 2^attemptCount → 60, 120, 240, 480, 960초
  const backoffSec = 60 * Math.pow(2, newAttemptCount - 1);
  const nextAt = new Date(Date.now() + backoffSec * 1000).toISOString();

  await supabase
    .from("erp_outbound_webhooks")
    .update({
      last_error: error,
      last_response_status: responseStatus,
      attempt_count: newAttemptCount,
      next_attempt_at: nextAt,
    })
    .eq("id", id);
}
