import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LandingSectionEditor } from "@/components/landing-builder/LandingSectionEditor";
import { EMPTY_PAGE_CONTENT } from "@/lib/landing-defaults";
import type { LandingPageContent } from "@/types/landing";

export default async function LandingBuilderPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("orgs")
    .select("page_content")
    .eq("id", tenant.id)
    .single();

  const pageContent: LandingPageContent =
    data?.page_content &&
    typeof data.page_content === "object" &&
    "sections" in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <LandingSectionEditor initialPageContent={pageContent} />
    </div>
  );
}
