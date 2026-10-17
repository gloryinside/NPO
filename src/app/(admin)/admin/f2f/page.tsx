import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { F2fBoard } from "@/components/admin/f2f-board";

export const metadata = { title: "현장 모금(태블릿)" };

export default async function AdminF2fPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { data: campaigns } = await createSupabaseAdminClient()
    .from("campaigns")
    .select("id, title")
    .eq("org_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return <F2fBoard campaigns={(campaigns ?? []) as { id: string; title: string }[]} />;
}
