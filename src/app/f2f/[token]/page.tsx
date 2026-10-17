import type { Metadata } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireTenant } from "@/lib/tenant/context";
import { resolveAgent } from "@/lib/f2f/agents";
import { WizardClient } from "@/app/donate/wizard/WizardClient";
import { FormSettingsSchema, defaultFormSettings } from "@/lib/campaign-builder/form-settings/schema";

// 링크 토큰이 주소에 있다 — 검색에 안 잡히고, 결제창 등 다른 사이트로 넘어갈 때 주소가 새지 않게
export const metadata: Metadata = {
  title: "현장 후원 신청",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * 현장 모금(태블릿) 신청 화면 — 관리자가 만든 모금가 링크(/f2f/<토큰>)로 연다.
 * 후원 신청 화면과 같지만, 로그인 정보를 쓰지 않고 끝나면 다음 분을 위해 화면을 비운다.
 */
export default async function F2fPage({ params }: { params: Promise<{ token: string }> }) {
  const tenant = await requireTenant();
  const { token } = await params;
  const supabase = createSupabaseAdminClient();
  const agent = await resolveAgent(supabase, tenant.id, token);

  const { data: c } = agent
    ? await supabase
        .from("campaigns")
        .select("id, slug, title, status, form_settings, org_id")
        .eq("id", agent.campaignId)
        .eq("org_id", tenant.id)
        .maybeSingle()
    : { data: null };

  if (!agent || !c || c.status !== "active") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[var(--text)]">이 신청 링크는 쓸 수 없어요</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          링크 기간이 끝났거나 중지되었거나, 캠페인이 끝났습니다. 담당자에게 새 링크를 받아 주세요.
        </p>
      </main>
    );
  }

  const settings = FormSettingsSchema.parse({ ...defaultFormSettings(), ...(c.form_settings ?? {}) });

  return (
    <WizardClient
      campaign={{ id: c.id, slug: c.slug, title: c.title, orgId: c.org_id }}
      settings={settings}
      isLoggedIn={false}
      prefill={{}}
      kiosk={{ token, agentName: agent.name }}
    />
  );
}
