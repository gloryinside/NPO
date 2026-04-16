import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type WebhookPayload = {
  event: "payment.created" | "payment.updated";
  paymentIdx: string;
  paymentCode: string;
  memberCode: string;
  memberName: string;
  payPrice: number;
  payDate: string | null;
  incomeStatus: "PENDING" | "PROCESSING" | "CONFIRMED" | "EXCLUDED";
  occurredAt: string;
};

/**
 * ERP Webhook Push (비동기, fire-and-forget)
 *
 * org_secrets.erp_webhook_url 이 설정된 경우에만 실행된다.
 * 실패 시 콘솔 경고만 남기고 호출자에게 영향을 주지 않는다.
 */
export async function pushErpWebhook(
  orgId: string,
  payload: WebhookPayload
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { data: secrets } = await supabase
    .from("org_secrets")
    .select("erp_webhook_url, erp_api_key")
    .eq("org_id", orgId)
    .maybeSingle();

  const webhookUrl = (secrets as { erp_webhook_url?: string | null } | null)
    ?.erp_webhook_url;

  if (!webhookUrl) return;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const apiKey = (secrets as { erp_api_key?: string | null } | null)
      ?.erp_api_key;
    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // 3초 타임아웃 (Node.js 18+ AbortSignal.timeout)
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) {
      console.warn(
        `[erp-webhook] push failed — ${res.status} ${res.statusText} → ${webhookUrl}`
      );
    }
  } catch (err) {
    console.warn(
      `[erp-webhook] push error → ${webhookUrl}`,
      err instanceof Error ? err.message : err
    );
  }
}

const INCOME_STATUS_MAP: Record<string, WebhookPayload["incomeStatus"]> = {
  pending: "PENDING",
  processing: "PROCESSING",
  confirmed: "CONFIRMED",
  excluded: "EXCLUDED",
};

export function toWebhookIncomeStatus(
  s: string
): WebhookPayload["incomeStatus"] {
  return INCOME_STATUS_MAP[s] ?? "PENDING";
}
