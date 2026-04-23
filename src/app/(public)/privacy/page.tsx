import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultPrivacyPolicy } from "@/lib/legal/default-templates";
import { renderSimpleMarkdown } from "@/lib/markdown/simple-render";
import { sanitizeHtml } from "@/lib/sanitize";

export const metadata = { title: "개인정보처리방침" };
export const revalidate = 3600;

export default async function PrivacyPage() {
  const tenant = await getTenant();
  if (!tenant) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p>잘못된 접근입니다.</p>
      </main>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("name, privacy_policy_markdown, contact_email, contact_address")
    .eq("id", tenant.id)
    .maybeSingle();

  const md =
    data?.privacy_policy_markdown ??
    defaultPrivacyPolicy({
      orgName: data?.name ?? tenant.name,
      contactEmail: data?.contact_email ?? null,
      contactAddress: data?.contact_address ?? null,
    });

  // renderSimpleMarkdown 이 입력을 escape 한 뒤 지정 태그만 재생성하므로 안전하지만,
  // 방어선 추가로 sanitizeHtml 을 한 번 더 통과시킨다.
  const html = sanitizeHtml(renderSimpleMarkdown(md));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article
        className="prose-legal"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
