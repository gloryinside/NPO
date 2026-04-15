import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CampaignList } from "@/components/admin/campaign-list";
import type { Campaign } from "@/types/campaign";

export default async function CampaignsPage() {
  await requireAdminUser();

  let campaigns: Campaign[] = [];
  try {
    const tenant = await requireTenant();
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", tenant.id)
      .order("created_at", { ascending: false });
    campaigns = (data as Campaign[]) ?? [];
  } catch {
    // tenant not found — render empty list
  }

  return <CampaignList campaigns={campaigns} />;
}
