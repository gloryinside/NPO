import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AbTestBoard } from "@/components/admin/ab-test-board";

export const metadata = { title: "신청 화면 A/B 비교" };

export default async function AbTestsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { data } = await createSupabaseAdminClient()
    .from("campaigns").select("id, title").eq("org_id", tenant.id).eq("status", "active").order("created_at", { ascending: false });
  return <AbTestBoard campaigns={(data ?? []) as { id: string; title: string }[]} />;
}
