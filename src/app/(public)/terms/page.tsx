import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { defaultTerms } from "@/lib/legal/default-templates";
import { renderSimpleMarkdown } from "@/lib/markdown/simple-render";
import { sanitizeHtml } from "@/lib/sanitize";

export const metadata = { title: "이용약관" };
export const revalidate = 3600;

export default async function TermsPage() {
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
    .select("name, terms_markdown")
    .eq("id", tenant.id)
    .maybeSingle();

  const md =
    data?.terms_markdown ??
    defaultTerms({ orgName: data?.name ?? tenant.name });

  const html = sanitizeHtml(renderSimpleMarkdown(md));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <article
        className="prose-legal"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
