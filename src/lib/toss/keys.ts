import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/secrets/crypto";

export type OrgTossKeys = {
  tossClientKey: string | null;
  tossSecretKey: string | null;
  tossWebhookSecret: string | null;
};

/**
 * 특정 org 의 Toss 키를 로드한다.
 *
 * 암호화된 *_enc 컬럼에서 pgcrypto로 복호화한다.
 * passphrase는 ORG_SECRETS_KEY env var.
 *
 * service-role client 를 사용해 RLS 를 우회한다 (결제 플로우/웹훅에서 tenant 세션이
 * 없거나 익명 요청이므로 RLS 를 우회해야 한다).
 *
 * 값이 없으면 null 필드를 담은 객체를 반환한다 — 호출부에서 필수 키 존재 여부를
 * 검증해야 한다.
 */
export async function getOrgTossKeys(orgId: string): Promise<OrgTossKeys> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("org_secrets")
    .select("toss_client_key_enc, toss_secret_key_enc, toss_webhook_secret_enc")
    .eq("org_id", orgId)
    .maybeSingle();

  const row = data as
    | {
        toss_client_key_enc?: string | null;
        toss_secret_key_enc?: string | null;
        toss_webhook_secret_enc?: string | null;
      }
    | null;

  const [tossClientKey, tossSecretKey, tossWebhookSecret] = await Promise.all([
    decryptSecret(row?.toss_client_key_enc),
    decryptSecret(row?.toss_secret_key_enc),
    decryptSecret(row?.toss_webhook_secret_enc),
  ]);

  return { tossClientKey, tossSecretKey, tossWebhookSecret };
}
