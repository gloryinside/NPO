import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import DonationForm from "@/components/public/donation-form";
import type { Campaign } from "@/types/campaign";

export default async function CampaignDonatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const tenant = await getTenant();
  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
          잘못된 접근입니다.
        </p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("slug", slug)
    .eq("status", "active")
    .single<Campaign>();

  if (error || !campaign) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
          캠페인을 찾을 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p
          className="mb-2 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          후원 캠페인
        </p>
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--text)" }}
        >
          {campaign.title}
        </h1>
      </div>

      <DonationForm campaign={campaign} />
    </div>
  );
}
