import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TossSettingsForm } from "@/components/admin/toss-settings-form";
import { OrgProfileForm } from "@/components/admin/org-profile-form";

function maskSecret(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••";
  return value.slice(0, 8) + "••••" + value.slice(-4);
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
      .select("toss_client_key, toss_secret_key, toss_webhook_secret")
      .eq("org_id", tenantId)
      .maybeSingle(),
    supabase
      .from("orgs")
      .select(
        "name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats"
      )
      .eq("id", tenantId)
      .single(),
  ]);

  const initialToss = {
    tossClientKey: (secretsData?.toss_client_key as string | null) ?? null,
    tossSecretKeyMasked: maskSecret(
      (secretsData?.toss_secret_key as string | null) ?? null
    ),
    tossWebhookSecretMasked: maskSecret(
      (secretsData?.toss_webhook_secret as string | null) ?? null
    ),
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

      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          Toss Payments 결제 설정
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          Toss 가맹점 계정에서 발급받은 키를 입력하세요. 테스트 키로도
          동작합니다.
        </p>
        <TossSettingsForm initialData={initialToss} />
      </section>
    </div>
  );
}
