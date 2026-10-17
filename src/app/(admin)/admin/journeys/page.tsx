import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadJourneySteps } from "@/lib/journey/admin";
import { JourneyBoard } from "@/components/admin/journey-board";

export const metadata = { title: "후원자 여정 메시지" };

export default async function AdminJourneysPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const steps = await loadJourneySteps(createSupabaseAdminClient(), tenant.id);
  return <JourneyBoard steps={steps} />;
}
