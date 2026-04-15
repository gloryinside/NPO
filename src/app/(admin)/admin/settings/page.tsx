import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TossSettingsForm } from "@/components/admin/toss-settings-form";

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
  const { data } = await supabase
    .from("org_secrets")
    .select("toss_client_key, toss_secret_key, toss_webhook_secret")
    .eq("org_id", tenantId)
    .maybeSingle();

  const initialData = {
    tossClientKey: (data?.toss_client_key as string | null) ?? null,
    tossSecretKeyMasked: maskSecret(
      (data?.toss_secret_key as string | null) ?? null
    ),
    tossWebhookSecretMasked: maskSecret(
      (data?.toss_webhook_secret as string | null) ?? null
    ),
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-[var(--text)]">기관 설정</h1>
      <p className="mt-1 mb-8 text-sm text-[var(--muted-foreground)]">
        결제 연동, 기관 프로필 등 기관 전용 설정을 관리합니다.
      </p>
      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          Toss Payments 결제 설정
        </h2>
        <p className="text-xs text-[var(--muted-foreground)] mb-4">
          Toss 가맹점 계정에서 발급받은 키를 입력하세요. 테스트 키로도
          동작합니다.
        </p>
        <TossSettingsForm initialData={initialData} />
      </section>
    </div>
  );
}
