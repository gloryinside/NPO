import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LandingSectionEditor } from "@/components/landing-builder/LandingSectionEditor";
import { EMPTY_PAGE_CONTENT } from "@/lib/landing-defaults";
import { migrateToV2 } from "@/lib/landing-migrate";
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

  const pageContent = migrateToV2(
    data?.page_content &&
      typeof data.page_content === "object" &&
      "sections" in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">랜딩페이지 편집</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        기관 홈페이지에 노출될 섹션을 구성하고 게시하세요.
      </p>
      <LandingSectionEditor initialPageContent={pageContent} />
    </div>
  );
}
