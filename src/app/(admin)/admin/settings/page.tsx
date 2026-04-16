import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, maskPlaintext } from "@/lib/secrets/crypto";
import { TossSettingsForm } from "@/components/admin/toss-settings-form";
import { OrgProfileForm } from "@/components/admin/org-profile-form";
import { ErpSettingsForm } from "@/components/admin/erp-settings-form";

function maskSecret(value: string | null): string | null {
  return value ? maskPlaintext(value) : null;
}

export default async function SettingsPage() {
  await requireAdminUser();

  let tenantId: string;
  try {
    const tenant = await requireTenant();
    tenantId = tenant.id;
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">기관 설정</h1>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          테넌트 정보를 확인할 수 없습니다.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: secretsData }, { data: orgData }] = await Promise.all([
    supabase
      .from("org_secrets")
      .select(
        "toss_client_key_enc, toss_secret_key_enc, toss_webhook_secret_enc, erp_api_key_enc, erp_webhook_url"
      )
      .eq("org_id", tenantId)
      .maybeSingle(),
    supabase
      .from("orgs")
      .select(
        "name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats, bank_name, bank_account, account_holder"
      )
      .eq("id", tenantId)
      .single(),
  ]);

  const secretsRow = secretsData as
    | {
        toss_client_key_enc?: string | null;
        toss_secret_key_enc?: string | null;
        toss_webhook_secret_enc?: string | null;
        erp_api_key_enc?: string | null;
        erp_webhook_url?: string | null;
      }
    | null;

  const [tossClientPlain, tossSecretPlain, tossWebhookPlain, erpApiPlain] =
    await Promise.all([
      decryptSecret(secretsRow?.toss_client_key_enc ?? null),
      decryptSecret(secretsRow?.toss_secret_key_enc ?? null),
      decryptSecret(secretsRow?.toss_webhook_secret_enc ?? null),
      decryptSecret(secretsRow?.erp_api_key_enc ?? null),
    ]);

  const initialToss = {
    tossClientKey: tossClientPlain,
    tossSecretKeyMasked: maskSecret(tossSecretPlain),
    tossWebhookSecretMasked: maskSecret(tossWebhookPlain),
  };

  const initialOrg = {
    name: (orgData?.name as string) ?? "",
    business_no: (orgData?.business_no as string | null) ?? null,
    logo_url: (orgData?.logo_url as string | null) ?? null,
    hero_image_url: (orgData?.hero_image_url as string | null) ?? null,
    tagline: (orgData?.tagline as string | null) ?? null,
    about: (orgData?.about as string | null) ?? null,
    contact_email: (orgData?.contact_email as string | null) ?? null,
    contact_phone: (orgData?.contact_phone as string | null) ?? null,
    address: (orgData?.address as string | null) ?? null,
    show_stats: (orgData?.show_stats as boolean) ?? true,
    bank_name: (orgData?.bank_name as string | null) ?? null,
    bank_account: (orgData?.bank_account as string | null) ?? null,
    account_holder: (orgData?.account_holder as string | null) ?? null,
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--text)]">기관 설정</h1>
      <p className="mt-1 mb-8 text-sm text-[var(--muted-foreground)]">
        결제 연동, 기관 프로필 등 기관 전용 설정을 관리합니다.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          기관 프로필
        </h2>
        <OrgProfileForm initialData={initialOrg} />
      </section>

      <hr className="border-[var(--border)] mb-10" />

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          Toss Payments 결제 설정
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          Toss 가맹점 계정에서 발급받은 키를 입력하세요. 테스트 키로도
          동작합니다.
        </p>
        <TossSettingsForm initialData={initialToss} />
      </section>

      <hr className="border-[var(--border)] mb-10" />

      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          ERP 연동 설정
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          ERP API Key는 외부 ERP 시스템이 납입정보를 조회할 때 사용됩니다.
          Webhook URL을 설정하면 납입 확정 시 실시간으로 ERP에 알림이 전송됩니다.
        </p>
        <ErpSettingsForm
          erpApiKeyMasked={maskSecret(erpApiPlain)}
          erpWebhookUrl={secretsRow?.erp_webhook_url ?? null}
        />
      </section>
    </div>
  );
}
