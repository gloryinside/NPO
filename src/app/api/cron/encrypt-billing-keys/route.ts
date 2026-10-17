import { runCron } from "@/lib/cron/runner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sealBillingKey } from "@/lib/billing/billing-key-store";

/**
 * 1회성: 평문으로 저장된 빌링키를 암호화(enc:v{n}:…)로 이전한다. 스케줄 없음 — 수동 실행.
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/encrypt-billing-keys
 * 여러 번 실행해도 안전(이미 enc: 인 행은 건너뜀). 한 번에 500건씩.
 * 조건부 UPDATE(값이 그대로일 때만)로 그 사이 카드 변경과 충돌하지 않는다.
 */
export async function GET(req: Request) {
  return runCron(req, "cron:encrypt-billing-keys", async () => {
    const supabase = createSupabaseAdminClient();
    const { data: rows, error } = await supabase
      .from("promises")
      .select("id, toss_billing_key")
      .not("toss_billing_key", "is", null)
      .not("toss_billing_key", "like", "enc:%")
      .limit(500);
    if (error) throw new Error(error.message);

    let sealed = 0;
    for (const r of rows ?? []) {
      const plain = r.toss_billing_key as string;
      const { error: upErr } = await supabase
        .from("promises")
        .update({ toss_billing_key: await sealBillingKey(plain) })
        .eq("id", r.id)
        .eq("toss_billing_key", plain);
      if (!upErr) sealed++;
    }
    return { sealed, remaining: Math.max(0, (rows?.length ?? 0) - sealed) };
  });
}
