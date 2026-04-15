import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type OrgTossKeys = {
  tossClientKey: string | null;
  tossSecretKey: string | null;
  tossWebhookSecret: string | null;
};

/**
 * 특정 org 의 Toss 키를 로드한다.
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
    .select("toss_client_key, toss_secret_key, toss_webhook_secret")
    .eq("org_id", orgId)
    .maybeSingle();

  return {
    tossClientKey: (data?.toss_client_key as string | null) ?? null,
    tossSecretKey: (data?.toss_secret_key as string | null) ?? null,
    tossWebhookSecret: (data?.toss_webhook_secret as string | null) ?? null,
  };
}
